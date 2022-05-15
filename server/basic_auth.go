package server

import (
	"fmt"
	"memos/api"
	"memos/common"
	"net/http"
	"strconv"

	"github.com/gorilla/sessions"
	"github.com/labstack/echo-contrib/session"
	"github.com/labstack/echo/v4"
)

var (
	userIDContextKey = "user-id"
)

func getUserIDContextKey() string {
	return userIDContextKey
}

func setUserSession(c echo.Context, user *api.User) error {
	sess, _ := session.Get("session", c)
	sess.Options = &sessions.Options{
		Path:     "/",
		MaxAge:   1000 * 3600 * 24 * 30,
		HttpOnly: true,
	}
	sess.Values[userIDContextKey] = user.ID
	err := sess.Save(c.Request(), c.Response())
	if err != nil {
		return fmt.Errorf("failed to set session, err: %w", err)
	}

	return nil
}

func removeUserSession(c echo.Context) error {
	sess, _ := session.Get("session", c)
	sess.Options = &sessions.Options{
		Path:     "/",
		MaxAge:   0,
		HttpOnly: true,
	}
	sess.Values[userIDContextKey] = nil
	err := sess.Save(c.Request(), c.Response())
	if err != nil {
		return fmt.Errorf("failed to set session, err: %w", err)
	}

	return nil
}

// Use session to store user.id.
func BasicAuthMiddleware(us api.UserService, next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		// Skips auth
		if common.HasPrefixes(c.Path(), "/api/auth", "/api/ping", "/api/status") {
			return next(c)
		}

		sess, err := session.Get("session", c)
		if err != nil {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing session").SetInternal(err)
		}

		userIDValue := sess.Values[userIDContextKey]
		if userIDValue == nil {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing userID in session")
		}

		userID, err := strconv.Atoi(fmt.Sprintf("%v", userIDValue))
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to malformatted user id in the session.").SetInternal(err)
		}

		// Even if there is no error, we still need to make sure the user still exists.
		userFind := &api.UserFind{
			ID: &userID,
		}
		user, err := us.FindUser(userFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to find user by ID: %d", userID)).SetInternal(err)
		}
		if user == nil {
			return echo.NewHTTPError(http.StatusUnauthorized, fmt.Sprintf("Not found user ID: %d", userID))
		}

		// Stores userID into context.
		c.Set(getUserIDContextKey(), userID)

		return next(c)
	}
}
