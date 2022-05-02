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

	g.POST("/user/rename_check", func(c echo.Context) error {
		userRenameCheck := &api.UserRenameCheck{}
		if err := json.NewDecoder(c.Request().Body).Decode(userRenameCheck); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post user rename check request").SetInternal(err)
		}

		if userRenameCheck.Name == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "New name needed")
		}

		userFind := &api.UserFind{
			Name: &userRenameCheck.Name,
		}
		user, err := s.UserService.FindUser(userFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to find user by name %s", *userFind.Name)).SetInternal(err)
		}

		isUsable := true
		if user != nil {
			isUsable = false
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(isUsable)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode rename check response").SetInternal(err)
		}

		return nil
	})

	g.POST("/user/password_check", func(c echo.Context) error {
		userID := c.Get(getUserIDContextKey()).(int)
		userPasswordCheck := &api.UserPasswordCheck{}
		if err := json.NewDecoder(c.Request().Body).Decode(userPasswordCheck); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post user password check request").SetInternal(err)
		}

		if userPasswordCheck.Password == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "Password needed")
		}

		userFind := &api.UserFind{
			ID: &userID,
		}
		user, err := s.UserService.FindUser(userFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user by password").SetInternal(err)
		}

		isValid := false
		// Compare the stored hashed password, with the hashed version of the password that was received.
		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(userPasswordCheck.Password)); err == nil {
			isValid = true
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(isValid)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode password check response").SetInternal(err)
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

		if userPatch.ResetOpenID != nil && *userPatch.ResetOpenID {
			openID := common.GenUUID()
			userPatch.OpenID = &openID
		}

		if userPatch.Password != nil && *userPatch.Password != "" {
			passwordHash, err := bcrypt.GenerateFromPassword([]byte(*userPatch.Password), bcrypt.DefaultCost)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate password hash").SetInternal(err)
			}

			passwordHashStr := string(passwordHash)
			userPatch.PasswordHash = &passwordHashStr
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
