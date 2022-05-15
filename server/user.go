package server

import (
	"encoding/json"
	"fmt"
	"memos/api"
	"memos/common"
	"net/http"

	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

func (s *Server) registerUserRoutes(g *echo.Group) {
	// GET /api/user/me is used to check if the user is logged in.
	g.GET("/user/me", func(c echo.Context) error {
		userSessionID := c.Get(getUserIDContextKey())
		if userSessionID == nil {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing auth session")
		}

		userID := userSessionID.(int)
		userFind := &api.UserFind{
			ID: &userID,
		}
		user, err := s.UserService.FindUser(userFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch user").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(user)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode user response").SetInternal(err)
		}

		return nil
	})

	g.PATCH("/user/me", func(c echo.Context) error {
		userID := c.Get(getUserIDContextKey()).(int)
		userPatch := &api.UserPatch{
			ID: userID,
		}
		if err := json.NewDecoder(c.Request().Body).Decode(userPatch); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted patch user request").SetInternal(err)
		}

		if userPatch.Email != nil {
			userFind := api.UserFind{
				Email: userPatch.Email,
			}
			user, err := s.UserService.FindUser(&userFind)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to find user by email %s", *userPatch.Email)).SetInternal(err)
			}
			if user != nil {
				return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("User with email %s existed", *userPatch.Email)).SetInternal(err)
			}
		}

		if userPatch.Password != nil && *userPatch.Password != "" {
			passwordHash, err := bcrypt.GenerateFromPassword([]byte(*userPatch.Password), bcrypt.DefaultCost)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate password hash").SetInternal(err)
			}

			passwordHashStr := string(passwordHash)
			userPatch.PasswordHash = &passwordHashStr
		}

		if userPatch.ResetOpenID != nil && *userPatch.ResetOpenID {
			openID := common.GenUUID()
			userPatch.OpenID = &openID
		}

		user, err := s.UserService.PatchUser(userPatch)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to patch user").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(user)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode user response").SetInternal(err)
		}

		return nil
	})
}
