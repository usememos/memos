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
	userContextKey   = "user"
	sessionName      = "memos_session"
	sessionIDKey     = "session-id"
	validSessionID   = make(map[string]bool)
)

func setUserSession(ctx echo.Context, user *api.User) error {
	sess, _ := session.Get(sessionName, ctx)
	sess.Options = &sessions.Options{
		Path:     "/",
		MaxAge:   3600 * 24 * 30,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	}
	sess.Values[userIDContextKey] = user.ID
	sessionID := common.GenUUID()
	sess.Values[sessionIDKey] = sessionID
	validSessionID[sessionID] = true

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
	delete(validSessionID, sess.Values[sessionIDKey].(string))
	sess.Values[sessionIDKey] = nil

	err := sess.Save(ctx.Request(), ctx.Response())
	if err != nil {
		return fmt.Errorf("failed to set session, err: %w", err)
	}
	return nil
}

func (s *Server) aclMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		ctx := c.Request().Context()

		if s.defaultAuthSkipper(c) {
			return next(c)
		}

		sess, _ := session.Get(sessionName, c)
		userIDValue := sess.Values[userIDContextKey]
		sessionIDValue := sess.Values[sessionIDKey]
		if userIDValue != nil && sessionIDValue != nil {
			if _, ok := validSessionID[sessionIDValue.(string)]; !ok {
				return echo.NewHTTPError(http.StatusForbidden, "Invalid session")
			}
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
				c.Set(userContextKey, user)
			}
		}

		return next(c)
	}
}

func loginOnlyMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		user, ok := c.Get(userContextKey).(*api.User)
		if !ok || user == nil {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}
		return next(c)
	}
}

func roleOnlyMiddleware(role api.Role) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			user, ok := c.Get(userContextKey).(*api.User)
			if !ok || user == nil || user.Role != role {
				return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
			}
			return next(c)
		}
	}
}
