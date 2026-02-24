package mcp

import (
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v5"

	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

func newAuthMiddleware(s *store.Store) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			token := auth.ExtractBearerToken(c.Request().Header.Get("Authorization"))
			if !strings.HasPrefix(token, auth.PersonalAccessTokenPrefix) {
				return c.JSON(http.StatusUnauthorized, map[string]string{"message": "a personal access token is required"})
			}

			result, err := s.GetUserByPATHash(c.Request().Context(), auth.HashPersonalAccessToken(token))
			if err != nil || result == nil {
				return c.JSON(http.StatusUnauthorized, map[string]string{"message": "invalid or expired personal access token"})
			}
			if result.PAT.ExpiresAt != nil && result.PAT.ExpiresAt.AsTime().Before(time.Now()) {
				return c.JSON(http.StatusUnauthorized, map[string]string{"message": "invalid or expired personal access token"})
			}

			ctx := auth.SetUserInContext(c.Request().Context(), result.User, result.PAT.GetTokenId())
			c.SetRequest(c.Request().WithContext(ctx))
			return next(c)
		}
	}
}
