package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"

	"github.com/pkg/errors"
	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
	"github.com/usememos/memos/plugin/idp"
	"github.com/usememos/memos/plugin/idp/oauth2"
	"github.com/usememos/memos/store"

	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

func (s *Server) registerAuthRoutes(g *echo.Group, secret string) {
	g.POST("/auth/signin", func(c echo.Context) error {
		ctx := c.Request().Context()
		signin := &api.SignIn{}
		if err := json.NewDecoder(c.Request().Body).Decode(signin); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted signin request").SetInternal(err)
		}

		userFind := &api.UserFind{
			Username: &signin.Username,
		}
		user, err := s.Store.FindUser(ctx, userFind)
		if err != nil && common.ErrorCode(err) != common.NotFound {
			return echo.NewHTTPError(http.StatusInternalServerError, "Incorrect login credentials, please try again")
		}
		if user == nil {
			return echo.NewHTTPError(http.StatusUnauthorized, "Incorrect login credentials, please try again")
		} else if user.RowStatus == api.Archived {
			return echo.NewHTTPError(http.StatusForbidden, fmt.Sprintf("User has been archived with username %s", signin.Username))
		}

		// Compare the stored hashed password, with the hashed version of the password that was received.
		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(signin.Password)); err != nil {
			// If the two passwords don't match, return a 401 status.
			return echo.NewHTTPError(http.StatusUnauthorized, "Incorrect login credentials, please try again")
		}

		if err := GenerateTokensAndSetCookies(c, user, s.Profile.Mode, secret); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate tokens").SetInternal(err)
		}
		if err := s.createUserAuthSignInActivity(c, user); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create activity").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(user))
	})

	g.POST("/auth/signin/sso", func(c echo.Context) error {
		ctx := c.Request().Context()
		signin := &api.SSOSignIn{}
		if err := json.NewDecoder(c.Request().Body).Decode(signin); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted signin request").SetInternal(err)
		}

		identityProviderMessage, err := s.Store.GetIdentityProvider(ctx, &store.FindIdentityProviderMessage{
			ID: &signin.IdentityProviderID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find identity provider").SetInternal(err)
		}

		var userInfo *idp.IdentityProviderUserInfo
		if identityProviderMessage.Type == store.IdentityProviderOAuth2 {
			oauth2IdentityProvider, err := oauth2.NewIdentityProvider(identityProviderMessage.Config.OAuth2Config)
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

		identifierFilter := identityProviderMessage.IdentifierFilter
		if identifierFilter != "" {
			identifierFilterRegex, err := regexp.Compile(identifierFilter)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compile identifier filter").SetInternal(err)
			}
			if !identifierFilterRegex.MatchString(userInfo.Identifier) {
				return echo.NewHTTPError(http.StatusUnauthorized, "Access denied, identifier does not match the filter.").SetInternal(err)
			}
		}

		user, err := s.Store.FindUser(ctx, &api.UserFind{
			Username: &userInfo.Identifier,
		})
		if err != nil && common.ErrorCode(err) != common.NotFound {
			return echo.NewHTTPError(http.StatusInternalServerError, "Incorrect login credentials, please try again")
		}
		if user == nil {
			userCreate := &api.UserCreate{
				Username: userInfo.Identifier,
				// The new signup user should be normal user by default.
				Role:     api.NormalUser,
				Nickname: userInfo.DisplayName,
				Email:    userInfo.Email,
				Password: userInfo.Email,
				OpenID:   common.GenUUID(),
			}
			password, err := common.RandomString(20)
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
		if user.RowStatus == api.Archived {
			return echo.NewHTTPError(http.StatusForbidden, fmt.Sprintf("User has been archived with username %s", userInfo.Identifier))
		}

		if err := GenerateTokensAndSetCookies(c, user, s.Profile.Mode, secret); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate tokens").SetInternal(err)
		}
		if err := s.createUserAuthSignInActivity(c, user); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create activity").SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(user))
	})

	g.POST("/auth/signup", func(c echo.Context) error {
		ctx := c.Request().Context()
		signup := &api.SignUp{}
		if err := json.NewDecoder(c.Request().Body).Decode(signup); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted signup request").SetInternal(err)
		}

		userCreate := &api.UserCreate{
			Username: signup.Username,
			// The new signup user should be normal user by default.
			Role:     api.NormalUser,
			Nickname: signup.Username,
			Password: signup.Password,
			OpenID:   common.GenUUID(),
		}
		hostUserType := api.Host
		existedHostUsers, err := s.Store.FindUserList(ctx, &api.UserFind{
			Role: &hostUserType,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Failed to find users").SetInternal(err)
		}
		if len(existedHostUsers) == 0 {
			// Change the default role to host if there is no host user.
			userCreate.Role = api.Host
		} else {
			allowSignUpSetting, err := s.Store.FindSystemSetting(ctx, &api.SystemSettingFind{
				Name: api.SystemSettingAllowSignUpName,
			})
			if err != nil && common.ErrorCode(err) != common.NotFound {
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

		if err := userCreate.Validate(); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Invalid user create format").SetInternal(err)
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
		if err := GenerateTokensAndSetCookies(c, user, s.Profile.Mode, secret); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate tokens").SetInternal(err)
		}
		if err := s.createUserAuthSignUpActivity(c, user); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create activity").SetInternal(err)
		}

		return c.JSON(http.StatusOK, composeResponse(user))
	})

	g.POST("/auth/signout", func(c echo.Context) error {
		RemoveTokensAndCookies(c)
		return c.JSON(http.StatusOK, true)
	})
}

func (s *Server) createUserAuthSignInActivity(c echo.Context, user *api.User) error {
	ctx := c.Request().Context()
	payload := api.ActivityUserAuthSignInPayload{
		UserID: user.ID,
		IP:     echo.ExtractIPFromRealIPHeader()(c.Request()),
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return errors.Wrap(err, "failed to marshal activity payload")
	}
	activity, err := s.Store.CreateActivity(ctx, &api.ActivityCreate{
		CreatorID: user.ID,
		Type:      api.ActivityUserAuthSignIn,
		Level:     api.ActivityInfo,
		Payload:   string(payloadBytes),
	})
	if err != nil || activity == nil {
		return errors.Wrap(err, "failed to create activity")
	}
	return err
}

func (s *Server) createUserAuthSignUpActivity(c echo.Context, user *api.User) error {
	ctx := c.Request().Context()
	payload := api.ActivityUserAuthSignUpPayload{
		Username: user.Username,
		IP:       echo.ExtractIPFromRealIPHeader()(c.Request()),
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return errors.Wrap(err, "failed to marshal activity payload")
	}
	activity, err := s.Store.CreateActivity(ctx, &api.ActivityCreate{
		CreatorID: user.ID,
		Type:      api.ActivityUserAuthSignUp,
		Level:     api.ActivityInfo,
		Payload:   string(payloadBytes),
	})
	if err != nil || activity == nil {
		return errors.Wrap(err, "failed to create activity")
	}
	return err
}
