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

func (s *Server) registerAuthRoutes(g *echo.Group) {
	g.POST("/auth/login", func(c echo.Context) error {
		login := &api.Login{}
		if err := json.NewDecoder(c.Request().Body).Decode(login); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted login request").SetInternal(err)
		}

		userFind := &api.UserFind{
			Email: &login.Email,
		}
		user, err := s.Store.FindUser(userFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to find user by email %s", login.Email)).SetInternal(err)
		}
		if user == nil {
			return echo.NewHTTPError(http.StatusUnauthorized, fmt.Sprintf("User not found with email %s", login.Email))
		}

		// Compare the stored hashed password, with the hashed version of the password that was received.
		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(login.Password)); err != nil {
			// If the two passwords don't match, return a 401 status.
			return echo.NewHTTPError(http.StatusUnauthorized, "Incorrect password").SetInternal(err)
		}

		if err = setUserSession(c, user); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to set login session").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(user)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode user response").SetInternal(err)
		}

		return nil
	})

	g.POST("/auth/logout", func(c echo.Context) error {
		err := removeUserSession(c)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to set logout session").SetInternal(err)
		}

		c.Response().WriteHeader(http.StatusOK)
		return nil
	})

	g.POST("/auth/signup", func(c echo.Context) error {
		// Don't allow to signup by this api if site owner existed.
		ownerUserType := api.Owner
		ownerUserFind := api.UserFind{
			Role: &ownerUserType,
		}
		ownerUser, err := s.Store.FindUser(&ownerUserFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find owner user").SetInternal(err)
		}
		if ownerUser != nil {
			return echo.NewHTTPError(http.StatusUnauthorized, "Site Owner existed, please contact the site owner to signin account firstly.").SetInternal(err)
		}

		signup := &api.Signup{}
		if err := json.NewDecoder(c.Request().Body).Decode(signup); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted signup request").SetInternal(err)
		}

		// Validate signup form.
		// We can do stricter checks later.
		if len(signup.Email) < 6 {
			return echo.NewHTTPError(http.StatusBadRequest, "Email is too short, minimum length is 6.")
		}
		if len(signup.Name) < 6 {
			return echo.NewHTTPError(http.StatusBadRequest, "Username is too short, minimum length is 6.")
		}
		if len(signup.Password) < 6 {
			return echo.NewHTTPError(http.StatusBadRequest, "Password is too short, minimum length is 6.")
		}

		userFind := &api.UserFind{
			Email: &signup.Email,
		}
		user, err := s.Store.FindUser(userFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to find user by email %s", signup.Email)).SetInternal(err)
		}
		if user != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Existed user found: %s", signup.Email))
		}

		passwordHash, err := bcrypt.GenerateFromPassword([]byte(signup.Password), bcrypt.DefaultCost)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate password hash").SetInternal(err)
		}

		userCreate := &api.UserCreate{
			Email:        signup.Email,
			Role:         api.Role(signup.Role),
			Name:         signup.Name,
			PasswordHash: string(passwordHash),
			OpenID:       common.GenUUID(),
		}
		user, err = s.Store.CreateUser(userCreate)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create user").SetInternal(err)
		}

		err = setUserSession(c, user)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to set signup session").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(user)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode created user response").SetInternal(err)
		}

		return nil
	})
}
