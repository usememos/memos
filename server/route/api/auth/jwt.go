package auth

import (
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/util"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

const (
	// UserIDContextKey is the key name used to store user id in the context.
	UserIDContextKey = "user-id"
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
	// Check the HTTP request header first.
	accessToken, _ := extractTokenFromHeader(c)
	if accessToken == "" {
		// Check the cookie.
		cookie, _ := c.Cookie(AccessTokenCookieName)
		if cookie != nil {
			accessToken = cookie.Value
		}
	}
	return accessToken
}

// JWTMiddleware validates the access token.
func JWTMiddleware(storeInstance *store.Store, next echo.HandlerFunc, secret string) echo.HandlerFunc {
	return func(c echo.Context) error {
		ctx := c.Request().Context()
		path := c.Request().URL.Path

		accessToken := findAccessToken(c)
		if accessToken == "" {
			// Allow the user to access the public endpoints.
			if util.HasPrefixes(path, "/o") {
				return next(c)
			}
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing access token")
		}

		userID, err := getUserIDFromAccessToken(accessToken, secret)
		if err != nil {
			err = removeAccessTokenAndCookies(c, storeInstance, userID, accessToken)
			if err != nil {
				slog.Warn("fail to remove AccessToken and Cookies", err)
			}
			return echo.NewHTTPError(http.StatusUnauthorized, "Invalid or expired access token")
		}

		accessTokens, err := storeInstance.GetUserAccessTokens(ctx, userID)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get user access tokens.").WithInternal(err)
		}
		if !validateAccessToken(accessToken, accessTokens) {
			err = removeAccessTokenAndCookies(c, storeInstance, userID, accessToken)
			if err != nil {
				slog.Warn("fail to remove AccessToken and Cookies", err)
			}
			return echo.NewHTTPError(http.StatusUnauthorized, "Invalid access token.")
		}

		// Even if there is no error, we still need to make sure the user still exists.
		user, err := storeInstance.GetUser(ctx, &store.FindUser{
			ID: &userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Server error to find user ID: %d", userID)).SetInternal(err)
		}
		if user == nil {
			return echo.NewHTTPError(http.StatusUnauthorized, fmt.Sprintf("Failed to find user ID: %d", userID))
		}

		// Stores userID into context.
		c.Set(UserIDContextKey, userID)
		return next(c)
	}
}

func getUserIDFromAccessToken(accessToken, secret string) (int32, error) {
	claims := &ClaimsMessage{}
	_, err := jwt.ParseWithClaims(accessToken, claims, func(t *jwt.Token) (any, error) {
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
		return 0, errors.Wrap(err, "Invalid or expired access token")
	}
	// We either have a valid access token or we will attempt to generate new access token.
	userID, err := util.ConvertStringToInt32(claims.Subject)
	if err != nil {
		return 0, errors.Wrap(err, "Malformed ID in the token")
	}
	return userID, nil
}

func validateAccessToken(accessTokenString string, userAccessTokens []*storepb.AccessTokensUserSetting_AccessToken) bool {
	for _, userAccessToken := range userAccessTokens {
		if accessTokenString == userAccessToken.AccessToken {
			return true
		}
	}
	return false
}

// removeAccessTokenAndCookies removes the jwt token from the cookies.
func removeAccessTokenAndCookies(c echo.Context, s *store.Store, userID int32, token string) error {
	err := s.RemoveUserAccessToken(c.Request().Context(), userID, token)
	if err != nil {
		return err
	}

	cookieExp := time.Now().Add(-1 * time.Hour)
	setTokenCookie(c, AccessTokenCookieName, "", cookieExp)
	return nil
}

// setTokenCookie sets the token to the cookie.
func setTokenCookie(c echo.Context, name, token string, expiration time.Time) {
	cookie := new(http.Cookie)
	cookie.Name = name
	cookie.Value = token
	cookie.Expires = expiration
	cookie.Path = "/"
	// Http-only helps mitigate the risk of client side script accessing the protected cookie.
	cookie.HttpOnly = true
	cookie.SameSite = http.SameSiteStrictMode
	c.SetCookie(cookie)
}
