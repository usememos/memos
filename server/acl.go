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
	sessionName      = "memos_session"
)

func getUserIDContextKey() string {
	return userIDContextKey
}

func setUserSession(ctx echo.Context, user *api.User) error {
	sess, _ := session.Get(sessionName, ctx)
	sess.Options = &sessions.Options{
		Path:     "/",
		MaxAge:   3600 * 24 * 30,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	}
	sess.Values[userIDContextKey] = user.ID
	err := sess.Save(ctx.Request(), ctx.Response())
	if err != nil {
		return fmt.Errorf("failed to set session, err: %w", err)
	}
	return nil
}

func removeUserSession(ctx echo.Context) error {
	sess, _ := session.Get(sessionName, ctx)
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

func aclMiddleware(s *Server, next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		ctx := c.Request().Context()
		path := c.Path()

		if s.defaultAuthSkipper(c) {
			return next(c)
		}

		sess, _ := session.Get(sessionName, c)
		userIDValue := sess.Values[userIDContextKey]
		if userIDValue != nil {
			userID, _ := strconv.Atoi(fmt.Sprintf("%v", userIDValue))
			userFind := &api.UserFind{
				ID: &userID,
			}
			user, err := s.Store.FindUser(ctx, userFind)
			if err != nil && common.ErrorCode(err) != common.NotFound {
				return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to find user by ID: %d", userID)).SetInternal(err)
			}
			if user != nil {
				if user.RowStatus == api.Archived {
					return echo.NewHTTPError(http.StatusForbidden, fmt.Sprintf("User has been archived with username %s", user.Username))
				}
				c.Set(getUserIDContextKey(), userID)
			}
		}

		if common.HasPrefixes(path, "/api/ping", "/api/status", "/api/idp", "/api/user/:id", "/api/memo") && c.Request().Method == http.MethodGet {
			return next(c)
		}

		userID := c.Get(getUserIDContextKey())
		if userID == nil {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		return next(c)
	}
}
