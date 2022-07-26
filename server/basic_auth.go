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

func setUserSession(ctx echo.Context, user *api.User) error {
	sess, _ := session.Get("session", ctx)
	sess.Options = &sessions.Options{
		Path:     "/",
		MaxAge:   1000 * 3600 * 24 * 30,
		HttpOnly: true,
	}
	sess.Values[userIDContextKey] = user.ID
	err := sess.Save(ctx.Request(), ctx.Response())
	if err != nil {
		return fmt.Errorf("failed to set session, err: %w", err)
	}
	return nil
}

func removeUserSession(ctx echo.Context) error {
	sess, _ := session.Get("session", ctx)
	sess.Options = &sessions.Options{
		Path:     "/",
		MaxAge:   0,
		HttpOnly: true,
	}
	sess.Values[userIDContextKey] = nil
	err := sess.Save(ctx.Request(), ctx.Response())
	if err != nil {
		return fmt.Errorf("failed to set session, err: %w", err)
	}
	return nil
}

// Use session to store user.id.
func BasicAuthMiddleware(s *Server, next echo.HandlerFunc) echo.HandlerFunc {
	return func(ctx echo.Context) error {
		// Skip auth for some paths.
		if common.HasPrefixes(ctx.Path(), "/api/auth", "/api/ping", "/api/status", "/api/user/:userId") {
			return next(ctx)
		}

		// If there is openId in query string and related user is found, then skip auth.
		openID := ctx.QueryParam("openId")
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
				ctx.Set(getUserIDContextKey(), user.ID)
				return next(ctx)
			}
		}

		needAuth := true
		if common.HasPrefixes(ctx.Path(), "/api/memo", "/api/tag", "/api/shortcut") && ctx.Request().Method == http.MethodGet {
			if _, err := strconv.Atoi(ctx.QueryParam("creatorId")); err == nil {
				needAuth = false
			}
		}

		{
			sess, _ := session.Get("session", ctx)
			userIDValue := sess.Values[userIDContextKey]
			if userIDValue == nil && needAuth {
				return echo.NewHTTPError(http.StatusUnauthorized, "Missing userID in session")
			}

			userID, err := strconv.Atoi(fmt.Sprintf("%v", userIDValue))
			if err != nil && needAuth {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to malformatted user id in the session.").SetInternal(err)
			}

			userFind := &api.UserFind{
				ID: &userID,
			}
			user, err := s.Store.FindUser(userFind)
			if err != nil && needAuth {
				return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to find user by ID: %d", userID)).SetInternal(err)
			}
			if needAuth {
				if user == nil {
					return echo.NewHTTPError(http.StatusUnauthorized, fmt.Sprintf("Not found user ID: %d", userID))
				} else if user.RowStatus == api.Archived {
					return echo.NewHTTPError(http.StatusForbidden, fmt.Sprintf("User has been archived with email %s", user.Email))
				}
			}

			// Save userID into context.
			ctx.Set(getUserIDContextKey(), userID)
		}

		return next(ctx)
	}
}
