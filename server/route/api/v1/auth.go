package v1

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/pkg/errors"
	"golang.org/x/crypto/bcrypt"

	"github.com/usememos/memos/internal/util"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/route/api/auth"
	"github.com/usememos/memos/store"
)

type SignIn struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Remember bool   `json:"remember"`
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
	workspaceGeneralSetting, err := s.Store.GetWorkspaceGeneralSetting(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find system setting").SetInternal(err)
	}
	if workspaceGeneralSetting.DisallowPasswordLogin {
		return echo.NewHTTPError(http.StatusUnauthorized, "password login is deactivated").SetInternal(err)
	}

	signin := &SignIn{}
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

	var expireAt time.Time
	// Set cookie expiration to 100 years to make it persistent.
	cookieExp := time.Now().AddDate(100, 0, 0)
	if !signin.Remember {
		expireAt = time.Now().Add(auth.AccessTokenDuration)
		cookieExp = time.Now().Add(auth.CookieExpDuration)
	}

	accessToken, err := auth.GenerateAccessToken(user.Username, user.ID, expireAt, []byte(s.Secret))
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("failed to generate tokens, err: %s", err)).SetInternal(err)
	}
	if err := s.UpsertAccessTokenToStore(ctx, user, accessToken); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("failed to upsert access token, err: %s", err)).SetInternal(err)
	}
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
func (s *APIV1Service) SignOut(c echo.Context) error {
	accessToken := findAccessToken(c)
	userID, _ := getUserIDFromAccessToken(accessToken, s.Secret)

	err := removeAccessTokenAndCookies(c, s.Store, userID, accessToken)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("failed to remove access token, err: %s", err)).SetInternal(err)
	}

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
	if !util.UIDMatcher.MatchString(strings.ToLower(signup.Username)) {
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
		workspaceGeneralSetting, err := s.Store.GetWorkspaceGeneralSetting(ctx)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find system setting").SetInternal(err)
		}
		if workspaceGeneralSetting.DisallowSignup {
			return echo.NewHTTPError(http.StatusUnauthorized, "signup is disabled").SetInternal(err)
		}
		if workspaceGeneralSetting.DisallowPasswordLogin {
			return echo.NewHTTPError(http.StatusUnauthorized, "password login is deactivated").SetInternal(err)
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
	accessToken, err := auth.GenerateAccessToken(user.Username, user.ID, time.Now().Add(auth.AccessTokenDuration), []byte(s.Secret))
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("failed to generate tokens, err: %s", err)).SetInternal(err)
	}
	if err := s.UpsertAccessTokenToStore(ctx, user, accessToken); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("failed to upsert access token, err: %s", err)).SetInternal(err)
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
	if _, err := s.Store.UpsertUserSetting(ctx, &storepb.UserSetting{
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

// removeAccessTokenAndCookies removes the jwt token from the cookies.
func removeAccessTokenAndCookies(c echo.Context, s *store.Store, userID int32, token string) error {
	err := s.RemoveUserAccessToken(c.Request().Context(), userID, token)
	if err != nil {
		return err
	}

	cookieExp := time.Now().Add(-1 * time.Hour)
	setTokenCookie(c, auth.AccessTokenCookieName, "", cookieExp)
	return nil
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
