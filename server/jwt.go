package server

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v4"
	"github.com/labstack/echo/v4"
	"github.com/pkg/errors"
	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
	"github.com/usememos/memos/server/auth"
)

const (
	// Context section
	// The key name used to store user id in the context
	// user id is extracted from the jwt token subject field.
	userIDContextKey = "user-id"
)

// Claims creates a struct that will be encoded to a JWT.
// We add jwt.RegisteredClaims as an embedded type, to provide fields such as name.
type Claims struct {
	Name string `json:"name"`
	jwt.RegisteredClaims
}

func getUserIDContextKey() string {
	return userIDContextKey
}

// GenerateTokensAndSetCookies generates jwt token and saves it to the http-only cookie.
func GenerateTokensAndSetCookies(c echo.Context, user *api.User, secret string) error {
	accessToken, err := auth.GenerateAccessToken(user.Username, user.ID, secret)
	if err != nil {
		return errors.Wrap(err, "failed to generate access token")
	}

	cookieExp := time.Now().Add(auth.CookieExpDuration)
	setTokenCookie(c, auth.AccessTokenCookieName, accessToken, cookieExp)

	// We generate here a new refresh token and saving it to the cookie.
	refreshToken, err := auth.GenerateRefreshToken(user.Username, user.ID, secret)
	if err != nil {
		return errors.Wrap(err, "failed to generate refresh token")
	}
	setTokenCookie(c, auth.RefreshTokenCookieName, refreshToken, cookieExp)

	return nil
}

// RemoveTokensAndCookies removes the jwt token and refresh token from the cookies.
func RemoveTokensAndCookies(c echo.Context) {
	// We set the expiration time to the past, so that the cookie will be removed.
	cookieExp := time.Now().Add(-1 * time.Hour)
	setTokenCookie(c, auth.AccessTokenCookieName, "", cookieExp)
	setTokenCookie(c, auth.RefreshTokenCookieName, "", cookieExp)
}

// Here we are creating a new cookie, which will store the valid JWT token.
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

// JWTMiddleware validates the access token.
// If the access token is about to expire or has expired and the request has a valid refresh token, it
// will try to generate new access token and refresh token.
func JWTMiddleware(server *Server, next echo.HandlerFunc, secret string) echo.HandlerFunc {
	return func(c echo.Context) error {
		path := c.Request().URL.Path
		method := c.Request().Method

		if server.defaultAuthSkipper(c) {
			return next(c)
		}

		// Skip validation for server status endpoints.
		if common.HasPrefixes(path, "/api/ping", "/api/idp", "/api/user/:id") && method == http.MethodGet {
			return next(c)
		}

		token := findAccessToken(c)
		if token == "" {
			// Allow the user to access the public endpoints.
			if common.HasPrefixes(path, "/o") {
				return next(c)
			}
			// When the request is not authenticated, we allow the user to access the memo endpoints for those public memos.
			if common.HasPrefixes(path, "/api/status", "/api/memo") && method == http.MethodGet {
				return next(c)
			}
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing access token")
		}

		claims := &Claims{}
		accessToken, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (any, error) {
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

		if !audienceContains(claims.Audience, auth.AccessTokenAudienceName) {
			return echo.NewHTTPError(http.StatusUnauthorized,
				fmt.Sprintf("Invalid access token, audience mismatch, got %q, expected %q. you may send request to the wrong environment",
					claims.Audience,
					auth.AccessTokenAudienceName,
				))
		}

		generateToken := time.Until(claims.ExpiresAt.Time) < auth.RefreshThresholdDuration
		if err != nil {
			var ve *jwt.ValidationError
			if errors.As(err, &ve) {
				// If expiration error is the only error, we will clear the err
				// and generate new access token and refresh token
				if ve.Errors == jwt.ValidationErrorExpired {
					generateToken = true
				}
			} else {
				return &echo.HTTPError{
					Code:     http.StatusUnauthorized,
					Message:  "Invalid or expired access token",
					Internal: err,
				}
			}
		}

		// We either have a valid access token or we will attempt to generate new access token and refresh token
		ctx := c.Request().Context()
		userID, err := strconv.Atoi(claims.Subject)
		if err != nil {
			return echo.NewHTTPError(http.StatusUnauthorized, "Malformed ID in the token.")
		}

		// Even if there is no error, we still need to make sure the user still exists.
		user, err := server.Store.FindUser(ctx, &api.UserFind{
			ID: &userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Server error to find user ID: %d", userID)).SetInternal(err)
		}
		if user == nil {
			return echo.NewHTTPError(http.StatusUnauthorized, fmt.Sprintf("Failed to find user ID: %d", userID))
		}

		if generateToken {
			generateTokenFunc := func() error {
				rc, err := c.Cookie(auth.RefreshTokenCookieName)
				if err != nil {
					return echo.NewHTTPError(http.StatusUnauthorized, "Failed to generate access token. Missing refresh token.")
				}

				// Parses token and checks if it's valid.
				refreshTokenClaims := &Claims{}
				refreshToken, err := jwt.ParseWithClaims(rc.Value, refreshTokenClaims, func(t *jwt.Token) (any, error) {
					if t.Method.Alg() != jwt.SigningMethodHS256.Name {
						return nil, errors.Errorf("unexpected refresh token signing method=%v, expected %v", t.Header["alg"], jwt.SigningMethodHS256)
					}

					if kid, ok := t.Header["kid"].(string); ok {
						if kid == "v1" {
							return []byte(secret), nil
						}
					}
					return nil, errors.Errorf("unexpected refresh token kid=%v", t.Header["kid"])
				})
				if err != nil {
					if err == jwt.ErrSignatureInvalid {
						return echo.NewHTTPError(http.StatusUnauthorized, "Failed to generate access token. Invalid refresh token signature.")
					}
					return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Server error to refresh expired token. User Id %d", userID)).SetInternal(err)
				}

				if !audienceContains(refreshTokenClaims.Audience, auth.RefreshTokenAudienceName) {
					return echo.NewHTTPError(http.StatusUnauthorized,
						fmt.Sprintf("Invalid refresh token, audience mismatch, got %q, expected %q. you may send request to the wrong environment",
							refreshTokenClaims.Audience,
							auth.RefreshTokenAudienceName,
						))
				}

				// If we have a valid refresh token, we will generate new access token and refresh token
				if refreshToken != nil && refreshToken.Valid {
					if err := GenerateTokensAndSetCookies(c, user, secret); err != nil {
						return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Server error to refresh expired token. User Id %d", userID)).SetInternal(err)
					}
				}

				return nil
			}

			// It may happen that we still have a valid access token, but we encounter issue when trying to generate new token
			// In such case, we won't return the error.
			if err := generateTokenFunc(); err != nil && !accessToken.Valid {
				return err
			}
		}

		// Stores userID into context.
		c.Set(getUserIDContextKey(), userID)
		return next(c)
	}
}

func audienceContains(audience jwt.ClaimStrings, token string) bool {
	for _, v := range audience {
		if v == token {
			return true
		}
	}
	return false
}
