package v1

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/pkg/errors"
	"golang.org/x/crypto/bcrypt"

	"github.com/usememos/memos/api/auth"
	"github.com/usememos/memos/common/util"
	"github.com/usememos/memos/plugin/idp"
	"github.com/usememos/memos/plugin/idp/oauth2"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

var (
	usernameMatcher = regexp.MustCompile("^[a-z]([a-z0-9-]{2,30}[a-z0-9])?$")
)

type SignIn struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type SSOSignIn struct {
	IdentityProviderID int32  `json:"identityProviderId"`
	Code               string `json:"code"`
	RedirectURI        string `json:"redirectUri"`
}

type SignUp struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func (s *APIV1Service) registerAuthRoutes(g *echo.Group) {
	g.POST("/auth/signin", s.SignIn)
	g.POST("/auth/signin/sso", s.SignInSSO)
	g.POST("/auth/signout", s.SignOut)
	g.POST("/auth/signup", s.SignUp)
}

// SignIn godoc
//
//	@Summary	Sign-in to memos.
//	@Tags		auth
//	@Accept		json
//	@Produce	json
//	@Param		body	body		SignIn		true	"Sign-in object"
//	@Success	200		{object}	store.User	"User information"
//	@Failure	400		{object}	nil			"Malformatted signin request"
//	@Failure	401		{object}	nil			"Password login is deactivated | Incorrect login credentials, please try again"
//	@Failure	403		{object}	nil			"User has been archived with username %s"
//	@Failure	500		{object}	nil			"Failed to find system setting | Failed to unmarshal system setting | Incorrect login credentials, please try again | Failed to generate tokens | Failed to create activity"
//	@Router		/api/v1/auth/signin [POST]
func (s *APIV1Service) SignIn(c echo.Context) error {
	ctx := c.Request().Context()
	signin := &SignIn{}

	disablePasswordLoginSystemSetting, err := s.Store.GetSystemSetting(ctx, &store.FindSystemSetting{
		Name: SystemSettingDisablePasswordLoginName.String(),
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find system setting").SetInternal(err)
	}
	if disablePasswordLoginSystemSetting != nil {
		disablePasswordLogin := false
		err = json.Unmarshal([]byte(disablePasswordLoginSystemSetting.Value), &disablePasswordLogin)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal system setting").SetInternal(err)
		}
		if disablePasswordLogin {
			return echo.NewHTTPError(http.StatusUnauthorized, "Password login is deactivated")
		}
	}

	if err := json.NewDecoder(c.Request().Body).Decode(signin); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Malformatted signin request").SetInternal(err)
	}

	user, err := s.Store.GetUser(ctx, &store.FindUser{
		Username: &signin.Username,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Incorrect login credentials, please try again")
	}
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Incorrect login credentials, please try again")
	} else if user.RowStatus == store.Archived {
		return echo.NewHTTPError(http.StatusForbidden, fmt.Sprintf("User has been archived with username %s", signin.Username))
	}

	// Compare the stored hashed password, with the hashed version of the password that was received.
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(signin.Password)); err != nil {
		// If the two passwords don't match, return a 401 status.
		return echo.NewHTTPError(http.StatusUnauthorized, "Incorrect login credentials, please try again")
	}

	accessToken, err := auth.GenerateAccessToken(user.Username, user.ID, time.Now().Add(auth.AccessTokenDuration), s.Secret)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("failed to generate tokens, err: %s", err)).SetInternal(err)
	}
	if err := s.UpsertAccessTokenToStore(ctx, user, accessToken); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("failed to upsert access token, err: %s", err)).SetInternal(err)
	}
	if err := s.createAuthSignInActivity(c, user); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create activity").SetInternal(err)
	}
	cookieExp := time.Now().Add(auth.CookieExpDuration)
	setTokenCookie(c, auth.AccessTokenCookieName, accessToken, cookieExp)
	userMessage := convertUserFromStore(user)
	return c.JSON(http.StatusOK, userMessage)
}

// SignInSSO godoc
//
//	@Summary	Sign-in to memos using SSO.
//	@Tags		auth
//	@Accept		json
//	@Produce	json
//	@Param		body	body		SSOSignIn	true	"SSO sign-in object"
//	@Success	200		{object}	store.User	"User information"
//	@Failure	400		{object}	nil			"Malformatted signin request"
//	@Failure	401		{object}	nil			"Access denied, identifier does not match the filter."
//	@Failure	403		{object}	nil			"User has been archived with username {username}"
//	@Failure	404		{object}	nil			"Identity provider not found"
//	@Failure	500		{object}	nil			"Failed to find identity provider | Failed to create identity provider instance | Failed to exchange token | Failed to get user info | Failed to compile identifier filter | Incorrect login credentials, please try again | Failed to generate random password | Failed to generate password hash | Failed to create user | Failed to generate tokens | Failed to create activity"
//	@Router		/api/v1/auth/signin/sso [POST]
func (s *APIV1Service) SignInSSO(c echo.Context) error {
	ctx := c.Request().Context()
	signin := &SSOSignIn{}
	if err := json.NewDecoder(c.Request().Body).Decode(signin); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Malformatted signin request").SetInternal(err)
	}

	identityProvider, err := s.Store.GetIdentityProvider(ctx, &store.FindIdentityProvider{
		ID: &signin.IdentityProviderID,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find identity provider").SetInternal(err)
	}
	if identityProvider == nil {
		return echo.NewHTTPError(http.StatusNotFound, "Identity provider not found")
	}

	var userInfo *idp.IdentityProviderUserInfo
	if identityProvider.Type == store.IdentityProviderOAuth2Type {
		oauth2IdentityProvider, err := oauth2.NewIdentityProvider(identityProvider.Config.OAuth2Config)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create identity provider instance").SetInternal(err)
		}
		token, err := oauth2IdentityProvider.ExchangeToken(ctx, signin.RedirectURI, signin.Code)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to exchange token").SetInternal(err)
		}
		userInfo, err = oauth2IdentityProvider.UserInfo(token)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get user info").SetInternal(err)
		}
	}

	identifierFilter := identityProvider.IdentifierFilter
	if identifierFilter != "" {
		identifierFilterRegex, err := regexp.Compile(identifierFilter)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compile identifier filter").SetInternal(err)
		}
		if !identifierFilterRegex.MatchString(userInfo.Identifier) {
			return echo.NewHTTPError(http.StatusUnauthorized, "Access denied, identifier does not match the filter.").SetInternal(err)
		}
	}

	user, err := s.Store.GetUser(ctx, &store.FindUser{
		Username: &userInfo.Identifier,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Incorrect login credentials, please try again")
	}
	if user == nil {
		allowSignUpSetting, err := s.Store.GetSystemSetting(ctx, &store.FindSystemSetting{
			Name: SystemSettingAllowSignUpName.String(),
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find system setting").SetInternal(err)
		}

		allowSignUpSettingValue := false
		if allowSignUpSetting != nil {
			err = json.Unmarshal([]byte(allowSignUpSetting.Value), &allowSignUpSettingValue)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal system setting allow signup").SetInternal(err)
			}
		}
		if !allowSignUpSettingValue {
			return echo.NewHTTPError(http.StatusUnauthorized, "signup is disabled").SetInternal(err)
		}

		userCreate := &store.User{
			Username: userInfo.Identifier,
			// The new signup user should be normal user by default.
			Role:     store.RoleUser,
			Nickname: userInfo.DisplayName,
			Email:    userInfo.Email,
		}
		password, err := util.RandomString(20)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate random password").SetInternal(err)
		}
		passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate password hash").SetInternal(err)
		}
		userCreate.PasswordHash = string(passwordHash)
		user, err = s.Store.CreateUser(ctx, userCreate)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create user").SetInternal(err)
		}
	}
	if user.RowStatus == store.Archived {
		return echo.NewHTTPError(http.StatusForbidden, fmt.Sprintf("User has been archived with username %s", userInfo.Identifier))
	}

	accessToken, err := auth.GenerateAccessToken(user.Username, user.ID, time.Now().Add(auth.AccessTokenDuration), s.Secret)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("failed to generate tokens, err: %s", err)).SetInternal(err)
	}
	if err := s.UpsertAccessTokenToStore(ctx, user, accessToken); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("failed to upsert access token, err: %s", err)).SetInternal(err)
	}
	if err := s.createAuthSignInActivity(c, user); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create activity").SetInternal(err)
	}
	cookieExp := time.Now().Add(auth.CookieExpDuration)
	setTokenCookie(c, auth.AccessTokenCookieName, accessToken, cookieExp)
	userMessage := convertUserFromStore(user)
	return c.JSON(http.StatusOK, userMessage)
}

// SignOut godoc
//
//	@Summary	Sign-out from memos.
//	@Tags		auth
//	@Produce	json
//	@Success	200	{boolean}	true	"Sign-out success"
//	@Router		/api/v1/auth/signout [POST]
func (*APIV1Service) SignOut(c echo.Context) error {
	RemoveTokensAndCookies(c)
	return c.JSON(http.StatusOK, true)
}

// SignUp godoc
//
//	@Summary	Sign-up to memos.
//	@Tags		auth
//	@Accept		json
//	@Produce	json
//	@Param		body	body		SignUp		true	"Sign-up object"
//	@Success	200		{object}	store.User	"User information"
//	@Failure	400		{object}	nil			"Malformatted signup request | Failed to find users"
//	@Failure	401		{object}	nil			"signup is disabled"
//	@Failure	403		{object}	nil			"Forbidden"
//	@Failure	404		{object}	nil			"Not found"
//	@Failure	500		{object}	nil			"Failed to find system setting | Failed to unmarshal system setting allow signup | Failed to generate password hash | Failed to create user | Failed to generate tokens | Failed to create activity"
//	@Router		/api/v1/auth/signup [POST]
func (s *APIV1Service) SignUp(c echo.Context) error {
	ctx := c.Request().Context()
	signup := &SignUp{}
	if err := json.NewDecoder(c.Request().Body).Decode(signup); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Malformatted signup request").SetInternal(err)
	}

	hostUserType := store.RoleHost
	existedHostUsers, err := s.Store.ListUsers(ctx, &store.FindUser{
		Role: &hostUserType,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Failed to find users").SetInternal(err)
	}
	if !usernameMatcher.MatchString(strings.ToLower(signup.Username)) {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Invalid username %s", signup.Username)).SetInternal(err)
	}

	userCreate := &store.User{
		Username: signup.Username,
		// The new signup user should be normal user by default.
		Role:     store.RoleUser,
		Nickname: signup.Username,
	}
	if len(existedHostUsers) == 0 {
		// Change the default role to host if there is no host user.
		userCreate.Role = store.RoleHost
	} else {
		allowSignUpSetting, err := s.Store.GetSystemSetting(ctx, &store.FindSystemSetting{
			Name: SystemSettingAllowSignUpName.String(),
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find system setting").SetInternal(err)
		}

		allowSignUpSettingValue := false
		if allowSignUpSetting != nil {
			err = json.Unmarshal([]byte(allowSignUpSetting.Value), &allowSignUpSettingValue)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal system setting allow signup").SetInternal(err)
			}
		}
		if !allowSignUpSettingValue {
			return echo.NewHTTPError(http.StatusUnauthorized, "signup is disabled").SetInternal(err)
		}
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(signup.Password), bcrypt.DefaultCost)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate password hash").SetInternal(err)
	}

	userCreate.PasswordHash = string(passwordHash)
	user, err := s.Store.CreateUser(ctx, userCreate)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create user").SetInternal(err)
	}
	accessToken, err := auth.GenerateAccessToken(user.Username, user.ID, time.Now().Add(auth.AccessTokenDuration), s.Secret)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("failed to generate tokens, err: %s", err)).SetInternal(err)
	}
	if err := s.UpsertAccessTokenToStore(ctx, user, accessToken); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("failed to upsert access token, err: %s", err)).SetInternal(err)
	}
	if err := s.createAuthSignUpActivity(c, user); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create activity").SetInternal(err)
	}
	cookieExp := time.Now().Add(auth.CookieExpDuration)
	setTokenCookie(c, auth.AccessTokenCookieName, accessToken, cookieExp)
	userMessage := convertUserFromStore(user)
	return c.JSON(http.StatusOK, userMessage)
}

func (s *APIV1Service) UpsertAccessTokenToStore(ctx context.Context, user *store.User, accessToken string) error {
	userAccessTokens, err := s.Store.GetUserAccessTokens(ctx, user.ID)
	if err != nil {
		return errors.Wrap(err, "failed to get user access tokens")
	}
	userAccessToken := storepb.AccessTokensUserSetting_AccessToken{
		AccessToken: accessToken,
		Description: "Account sign in",
	}
	userAccessTokens = append(userAccessTokens, &userAccessToken)
	if _, err := s.Store.UpsertUserSettingV1(ctx, &storepb.UserSetting{
		UserId: user.ID,
		Key:    storepb.UserSettingKey_USER_SETTING_ACCESS_TOKENS,
		Value: &storepb.UserSetting_AccessTokens{
			AccessTokens: &storepb.AccessTokensUserSetting{
				AccessTokens: userAccessTokens,
			},
		},
	}); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("failed to upsert user setting, err: %s", err)).SetInternal(err)
	}
	return nil
}

func (s *APIV1Service) createAuthSignInActivity(c echo.Context, user *store.User) error {
	ctx := c.Request().Context()
	payload := ActivityUserAuthSignInPayload{
		UserID: user.ID,
		IP:     echo.ExtractIPFromRealIPHeader()(c.Request()),
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return errors.Wrap(err, "failed to marshal activity payload")
	}
	activity, err := s.Store.CreateActivity(ctx, &store.Activity{
		CreatorID: user.ID,
		Type:      string(ActivityUserAuthSignIn),
		Level:     string(ActivityInfo),
		Payload:   string(payloadBytes),
	})
	if err != nil || activity == nil {
		return errors.Wrap(err, "failed to create activity")
	}
	return err
}

func (s *APIV1Service) createAuthSignUpActivity(c echo.Context, user *store.User) error {
	ctx := c.Request().Context()
	payload := ActivityUserAuthSignUpPayload{
		Username: user.Username,
		IP:       echo.ExtractIPFromRealIPHeader()(c.Request()),
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return errors.Wrap(err, "failed to marshal activity payload")
	}
	activity, err := s.Store.CreateActivity(ctx, &store.Activity{
		CreatorID: user.ID,
		Type:      string(ActivityUserAuthSignUp),
		Level:     string(ActivityInfo),
		Payload:   string(payloadBytes),
	})
	if err != nil || activity == nil {
		return errors.Wrap(err, "failed to create activity")
	}
	return err
}

// RemoveTokensAndCookies removes the jwt token from the cookies.
func RemoveTokensAndCookies(c echo.Context) {
	cookieExp := time.Now().Add(-1 * time.Hour)
	setTokenCookie(c, auth.AccessTokenCookieName, "", cookieExp)
}

// setTokenCookie sets the token to the cookie.
func setTokenCookie(c echo.Context, name, token string, expiration time.Time) {
	cookie := new(http.Cookie)
	cookie.Name = name
	cookie.Value = token
	cookie.Expires = expiration
	cookie.Path = "/"
	// Http-only helps mitigate the risk of client side script accessing the protected cookie.
	cookie.HttpOnly = true
	cookie.SameSite = http.SameSiteStrictMode
	c.SetCookie(cookie)
}
