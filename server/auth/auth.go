package auth

import (
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v4"
)

const (
	issuer = "memos"
	// Signing key section. For now, this is only used for signing, not for verifying since we only
	// have 1 version. But it will be used to maintain backward compatibility if we change the signing mechanism.
	keyID = "v1"
	// AccessTokenAudienceName is the audience name of the access token.
	AccessTokenAudienceName = "user.access-token"
	// RefreshTokenAudienceName is the audience name of the refresh token.
	RefreshTokenAudienceName = "user.refresh-token"
	apiTokenDuration         = 2 * time.Hour
	accessTokenDuration      = 24 * time.Hour
	refreshTokenDuration     = 7 * 24 * time.Hour
	// RefreshThresholdDuration is the threshold duration for refreshing token.
	RefreshThresholdDuration = 1 * time.Hour

	// CookieExpDuration expires slightly earlier than the jwt expiration. Client would be logged out if the user
	// cookie expires, thus the client would always logout first before attempting to make a request with the expired jwt.
	// Suppose we have a valid refresh token, we will refresh the token in 2 cases:
	// 1. The access token is about to expire in <<refreshThresholdDuration>>
	// 2. The access token has already expired, we refresh the token so that the ongoing request can pass through.
	CookieExpDuration = refreshTokenDuration - 1*time.Minute
	// AccessTokenCookieName is the cookie name of access token.
	AccessTokenCookieName = "access-token"
	// RefreshTokenCookieName is the cookie name of refresh token.
	RefreshTokenCookieName = "refresh-token"
	// UserIDCookieName is the cookie name of user ID.
	UserIDCookieName = "user"
)

type claimsMessage struct {
	Name string `json:"name"`
	jwt.RegisteredClaims
}

// GenerateAPIToken generates an API token.
func GenerateAPIToken(userName string, userID int, secret string) (string, error) {
	expirationTime := time.Now().Add(apiTokenDuration)
	return generateToken(userName, userID, AccessTokenAudienceName, expirationTime, []byte(secret))
}

// GenerateAccessToken generates an access token for web.
func GenerateAccessToken(userName string, userID int, secret string) (string, error) {
	expirationTime := time.Now().Add(accessTokenDuration)
	return generateToken(userName, userID, AccessTokenAudienceName, expirationTime, []byte(secret))
}

// GenerateRefreshToken generates a refresh token for web.
func GenerateRefreshToken(userName string, userID int, secret string) (string, error) {
	expirationTime := time.Now().Add(refreshTokenDuration)
	return generateToken(userName, userID, RefreshTokenAudienceName, expirationTime, []byte(secret))
}

func generateToken(username string, userID int, aud string, expirationTime time.Time, secret []byte) (string, error) {
	// Create the JWT claims, which includes the username and expiry time.
	claims := &claimsMessage{
		Name: username,
		RegisteredClaims: jwt.RegisteredClaims{
			Audience: jwt.ClaimStrings{aud},
			// In JWT, the expiry time is expressed as unix milliseconds.
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    issuer,
			Subject:   strconv.Itoa(userID),
		},
	}

	// Declare the token with the HS256 algorithm used for signing, and the claims.
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	token.Header["kid"] = keyID

	// Create the JWT string.
	tokenString, err := token.SignedString(secret)
	if err != nil {
		return "", err
	}

	return tokenString, nil
}
