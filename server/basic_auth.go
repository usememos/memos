package server

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"

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
func BasicAuthMiddleware(s *Server, next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		// Skip auth for some paths.
		if common.HasPrefixes(c.Path(), "/api/auth", "/api/ping", "/api/status") {
			return next(c)
		}

		if common.HasPrefixes(c.Path(), "/api/memo", "/api/tag", "/api/shortcut", "/api/user/:id/name") && c.Request().Method == http.MethodGet {
			return next(c)
		}

		// If there is openId in query string and related user is found, then skip auth.
		openID := c.QueryParam("openId")
		if openID != "" {
			userFind := &api.UserFind{
				OpenID: &openID,
			}
			user, err := s.Store.FindUser(userFind)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user by open_id").SetInternal(err)
			}
			if user != nil {
				// Stores userID into context.
				c.Set(getUserIDContextKey(), user.ID)
				return next(c)
			}
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
		user, err := s.Store.FindUser(userFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to find user by ID: %d", userID)).SetInternal(err)
		}
		if user == nil {
			return echo.NewHTTPError(http.StatusUnauthorized, fmt.Sprintf("Not found user ID: %d", userID))
		} else if user.RowStatus == api.Archived {
			return echo.NewHTTPError(http.StatusForbidden, fmt.Sprintf("User has been archived with email %s", user.Email))
		}

		// Stores userID into context.
		c.Set(getUserIDContextKey(), userID)

		return next(c)
	}
}
