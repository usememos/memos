package server

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"

	"github.com/labstack/echo/v4"
)

var (
	userContextKey = "user"
	sessionName    = "memos_session"
	validSessionID = make(map[string]bool)
)

func (s *Server) setUserSession(ctx echo.Context, user *api.User) error {
	uuid := common.GenUUID()

	token, err := s.issueJWT(ctx.Request().Context(), &jwtCustomClaims{
		UserID:    user.ID,
		SessionID: uuid,
	})

	if err != nil {
		return fmt.Errorf("failed to issue JWT, err: %w", err)
	}

	validSessionID[uuid] = true

	ctx.SetCookie(&http.Cookie{
		Name:     sessionName,
		Value:    token,
		Path:     "/",
		MaxAge:   3600 * 24,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})
	return nil
}

func (s *Server) getUserSession(ctx echo.Context) *jwtCustomClaims {
	cookie, err := ctx.Cookie(sessionName)
	if err != nil {
		return nil
	}

	claims, err := s.verifyJWT(ctx.Request().Context(), cookie.Value)
	if err != nil {
		return nil
	}

	if _, ok := validSessionID[claims.SessionID]; !ok {
		return nil
	}

	return claims
}

func (s *Server) removeUserSession(ctx echo.Context) error {
	claims := s.getUserSession(ctx)
	if claims == nil {
		return nil
	}

	// remove session
	ctx.SetCookie(&http.Cookie{
		Name:     sessionName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})

	delete(validSessionID, claims.SessionID)

	return nil
}

func (s *Server) aclMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		ctx := c.Request().Context()

		if s.defaultAuthSkipper(c) {
			return next(c)
		}

		claims := s.getUserSession(c)

		if claims != nil {
			userID, _ := strconv.Atoi(fmt.Sprintf("%v", claims.UserID))
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
