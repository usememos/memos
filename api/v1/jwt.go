package v1

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v4"
	"github.com/labstack/echo/v4"
	"github.com/pkg/errors"
	"github.com/usememos/memos/api/auth"
	"github.com/usememos/memos/common/util"
	"github.com/usememos/memos/store"
)

const (
	// The key name used to store user id in the context
	// user id is extracted from the jwt token subject field.
	userIDContextKey = "user-id"
)

func extractTokenFromHeader(c echo.Context) (string, error) {
	authHeader := c.Request().Header.Get("Authorization")
	if authHeader == "" {
		return "", nil
	}

	authHeaderParts := strings.Fields(authHeader)
	if len(authHeaderParts) != 2 || strings.ToLower(authHeaderParts[0]) != "bearer" {
		return "", errors.New("Authorization header format must be Bearer {token}")
	}

	return authHeaderParts[1], nil
}

func findAccessToken(c echo.Context) string {
	accessToken := ""
	cookie, _ := c.Cookie(auth.AccessTokenCookieName)
	if cookie != nil {
		accessToken = cookie.Value
	}
	if accessToken == "" {
		accessToken, _ = extractTokenFromHeader(c)
	}

	return accessToken
}

func audienceContains(audience jwt.ClaimStrings, token string) bool {
	for _, v := range audience {
		if v == token {
			return true
		}
	}
	return false
}

// JWTMiddleware validates the access token.
func JWTMiddleware(server *APIV1Service, next echo.HandlerFunc, secret string) echo.HandlerFunc {
	return func(c echo.Context) error {
		ctx := c.Request().Context()
		path := c.Request().URL.Path
		method := c.Request().Method

		if server.defaultAuthSkipper(c) {
			return next(c)
		}

		// Skip validation for server status endpoints.
		if util.HasPrefixes(path, "/api/v1/ping", "/api/v1/idp", "/api/v1/status", "/api/v1/user") && path != "/api/v1/user/me" && method == http.MethodGet {
			return next(c)
		}

		token := findAccessToken(c)
		if token == "" {
			// Allow the user to access the public endpoints.
			if util.HasPrefixes(path, "/o") {
				return next(c)
			}
			// When the request is not authenticated, we allow the user to access the memo endpoints for those public memos.
			if util.HasPrefixes(path, "/api/v1/memo") && method == http.MethodGet {
				return next(c)
			}
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing access token")
		}

		claims := &auth.ClaimsMessage{}
		_, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (any, error) {
			if t.Method.Alg() != jwt.SigningMethodHS256.Name {
				return nil, errors.Errorf("unexpected access token signing method=%v, expect %v", t.Header["alg"], jwt.SigningMethodHS256)
			}
			if kid, ok := t.Header["kid"].(string); ok {
				if kid == "v1" {
					return []byte(secret), nil
				}
			}
			return nil, errors.Errorf("unexpected access token kid=%v", t.Header["kid"])
		})

		if err != nil {
			return echo.NewHTTPError(http.StatusUnauthorized, errors.Wrap(err, "Invalid or expired access token"))
		}
		if !audienceContains(claims.Audience, auth.AccessTokenAudienceName) {
			return echo.NewHTTPError(http.StatusUnauthorized, fmt.Sprintf("Invalid access token, audience mismatch, got %q, expected %q.", claims.Audience, auth.AccessTokenAudienceName))
		}

		// We either have a valid access token or we will attempt to generate new access token.
		userID, err := util.ConvertStringToInt32(claims.Subject)
		if err != nil {
			return echo.NewHTTPError(http.StatusUnauthorized, "Malformed ID in the token.")
		}

		// Even if there is no error, we still need to make sure the user still exists.
		user, err := server.Store.GetUser(ctx, &store.FindUser{
			ID: &userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Server error to find user ID: %d", userID)).SetInternal(err)
		}
		if user == nil {
			return echo.NewHTTPError(http.StatusUnauthorized, fmt.Sprintf("Failed to find user ID: %d", userID))
		}

		// Stores userID into context.
		c.Set(userIDContextKey, userID)
		return next(c)
	}
}

func (s *APIV1Service) defaultAuthSkipper(c echo.Context) bool {
	ctx := c.Request().Context()
	path := c.Path()

	// Skip auth.
	if util.HasPrefixes(path, "/api/v1/auth") {
		return true
	}

	// If there is openId in query string and related user is found, then skip auth.
	openID := c.QueryParam("openId")
	if openID != "" {
		user, err := s.Store.GetUser(ctx, &store.FindUser{
			OpenID: &openID,
		})
		if err != nil {
			return false
		}
		if user != nil {
			// Stores userID into context.
			c.Set(userIDContextKey, user.ID)
			return true
		}
	}

	return false
}
