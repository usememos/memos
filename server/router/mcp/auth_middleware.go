package mcp

import (
	"net/http"

	"github.com/labstack/echo/v5"

	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

func newAuthMiddleware(s *store.Store, secret string) echo.MiddlewareFunc {
	authenticator := auth.NewAuthenticator(s, secret)
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			token := auth.ExtractBearerToken(c.Request().Header.Get("Authorization"))
			if token == "" {
				return c.JSON(http.StatusUnauthorized, map[string]string{"message": "a personal access token is required"})
			}

			user, pat, err := authenticator.AuthenticateByPAT(c.Request().Context(), token)
			if err != nil || user == nil {
				return c.JSON(http.StatusUnauthorized, map[string]string{"message": "invalid or expired personal access token"})
			}

			ctx := auth.SetUserInContext(c.Request().Context(), user, pat.GetTokenId())
			c.SetRequest(c.Request().WithContext(ctx))
			return next(c)
		}
	}
}
