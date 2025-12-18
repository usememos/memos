// Package auth provides authentication and authorization for the Memos server.
//
// This package is used by:
// - server/router/api/v1: gRPC and Connect API interceptors
// - server/router/fileserver: HTTP file server authentication
//
// Authentication methods supported:
// - JWT access tokens: Short-lived tokens (15 minutes) for API access
// - JWT refresh tokens: Long-lived tokens (30 days) for obtaining new access tokens
// - Personal Access Tokens (PAT): Long-lived tokens for programmatic access
package auth

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/util"
)

const (
	// Issuer is the issuer claim in JWT tokens.
	// This identifies tokens as issued by Memos.
	Issuer = "memos"

	// KeyID is the key identifier used in JWT header.
	// Version "v1" allows for future key rotation while maintaining backward compatibility.
	// If signing mechanism changes, add "v2", "v3", etc. and verify both versions.
	KeyID = "v1"

	// AccessTokenAudienceName is the audience claim for JWT access tokens.
	// This ensures tokens are only used for API access, not other purposes.
	AccessTokenAudienceName = "user.access-token"

	// AccessTokenDuration is the lifetime of access tokens (15 minutes).
	AccessTokenDuration = 15 * time.Minute

	// RefreshTokenDuration is the lifetime of refresh tokens (30 days).
	RefreshTokenDuration = 30 * 24 * time.Hour

	// RefreshTokenAudienceName is the audience claim for refresh tokens.
	RefreshTokenAudienceName = "user.refresh-token"

	// RefreshTokenCookieName is the cookie name for refresh tokens.
	RefreshTokenCookieName = "memos_refresh"

	// PersonalAccessTokenPrefix is the prefix for PAT tokens.
	PersonalAccessTokenPrefix = "memos_pat_"
)

// ClaimsMessage represents the claims structure in a JWT token.
//
// JWT Claims include:
// - name: Username (custom claim)
// - iss: Issuer = "memos"
// - aud: Audience = "user.access-token"
// - sub: Subject = user ID
// - iat: Issued at time
// - exp: Expiration time (optional, may be empty for never-expiring tokens).
type ClaimsMessage struct {
	Name string `json:"name"` // Username
	jwt.RegisteredClaims
}

// AccessTokenClaims contains claims for short-lived access tokens.
// These tokens are validated by signature only (stateless).
type AccessTokenClaims struct {
	Type     string `json:"type"`     // "access"
	Role     string `json:"role"`     // User role
	Status   string `json:"status"`   // User status
	Username string `json:"username"` // Username for display
	jwt.RegisteredClaims
}

// RefreshTokenClaims contains claims for long-lived refresh tokens.
// These tokens are validated against the database for revocation.
type RefreshTokenClaims struct {
	Type    string `json:"type"` // "refresh"
	TokenID string `json:"tid"`  // Token ID for revocation lookup
	jwt.RegisteredClaims
}

// GenerateAccessToken generates a JWT access token for a user.
//
// Parameters:
// - username: The user's username (stored in "name" claim)
// - userID: The user's ID (stored in "sub" claim)
// - expirationTime: When the token expires (pass zero time for no expiration)
// - secret: Server secret used to sign the token
//
// Returns a signed JWT string or an error.
func GenerateAccessToken(username string, userID int32, expirationTime time.Time, secret []byte) (string, error) {
	return generateToken(username, userID, AccessTokenAudienceName, expirationTime, secret)
}

// generateToken generates a JWT token with the given claims.
//
// Token structure:
// Header: {"alg": "HS256", "kid": "v1", "typ": "JWT"}
// Claims: {"name": username, "iss": "memos", "aud": [audience], "sub": userID, "iat": now, "exp": expiry}
// Signature: HMACSHA256(base64UrlEncode(header) + "." + base64UrlEncode(payload), secret).
func generateToken(username string, userID int32, audience string, expirationTime time.Time, secret []byte) (string, error) {
	registeredClaims := jwt.RegisteredClaims{
		Issuer:   Issuer,
		Audience: jwt.ClaimStrings{audience},
		IssuedAt: jwt.NewNumericDate(time.Now()),
		Subject:  fmt.Sprint(userID),
	}
	if !expirationTime.IsZero() {
		registeredClaims.ExpiresAt = jwt.NewNumericDate(expirationTime)
	}

	// Declare the token with the HS256 algorithm used for signing, and the claims.
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, &ClaimsMessage{
		Name:             username,
		RegisteredClaims: registeredClaims,
	})
	token.Header["kid"] = KeyID

	// Create the JWT string.
	tokenString, err := token.SignedString(secret)
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

// GenerateAccessTokenV2 generates a short-lived access token with user claims.
func GenerateAccessTokenV2(userID int32, username, role, status string, secret []byte) (string, time.Time, error) {
	expiresAt := time.Now().Add(AccessTokenDuration)

	claims := &AccessTokenClaims{
		Type:     "access",
		Role:     role,
		Status:   status,
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    Issuer,
			Audience:  jwt.ClaimStrings{AccessTokenAudienceName},
			Subject:   fmt.Sprint(userID),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	token.Header["kid"] = KeyID

	tokenString, err := token.SignedString(secret)
	if err != nil {
		return "", time.Time{}, err
	}

	return tokenString, expiresAt, nil
}

// GenerateRefreshToken generates a long-lived refresh token.
func GenerateRefreshToken(userID int32, tokenID string, secret []byte) (string, time.Time, error) {
	expiresAt := time.Now().Add(RefreshTokenDuration)

	claims := &RefreshTokenClaims{
		Type:    "refresh",
		TokenID: tokenID,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    Issuer,
			Audience:  jwt.ClaimStrings{RefreshTokenAudienceName},
			Subject:   fmt.Sprint(userID),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	token.Header["kid"] = KeyID

	tokenString, err := token.SignedString(secret)
	if err != nil {
		return "", time.Time{}, err
	}

	return tokenString, expiresAt, nil
}

// GeneratePersonalAccessToken generates a random PAT string.
func GeneratePersonalAccessToken() string {
	randomStr, err := util.RandomString(32)
	if err != nil {
		// Fallback to UUID if RandomString fails
		return PersonalAccessTokenPrefix + util.GenUUID()
	}
	return PersonalAccessTokenPrefix + randomStr
}

// HashPersonalAccessToken returns SHA-256 hash of a PAT.
func HashPersonalAccessToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

// verifyJWTKeyFunc returns a jwt.Keyfunc that validates the signing method and key ID.
func verifyJWTKeyFunc(secret []byte) jwt.Keyfunc {
	return func(t *jwt.Token) (any, error) {
		if t.Method.Alg() != jwt.SigningMethodHS256.Name {
			return nil, errors.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		kid, ok := t.Header["kid"].(string)
		if !ok || kid != KeyID {
			return nil, errors.Errorf("unexpected kid: %v", t.Header["kid"])
		}
		return secret, nil
	}
}

// ParseAccessTokenV2 parses and validates a short-lived access token.
func ParseAccessTokenV2(tokenString string, secret []byte) (*AccessTokenClaims, error) {
	claims := &AccessTokenClaims{}
	_, err := jwt.ParseWithClaims(tokenString, claims, verifyJWTKeyFunc(secret),
		jwt.WithIssuer(Issuer),
		jwt.WithAudience(AccessTokenAudienceName),
	)
	if err != nil {
		return nil, err
	}
	if claims.Type != "access" {
		return nil, errors.New("invalid token type: expected access token")
	}
	return claims, nil
}

// ParseRefreshToken parses and validates a refresh token.
func ParseRefreshToken(tokenString string, secret []byte) (*RefreshTokenClaims, error) {
	claims := &RefreshTokenClaims{}
	_, err := jwt.ParseWithClaims(tokenString, claims, verifyJWTKeyFunc(secret),
		jwt.WithIssuer(Issuer),
		jwt.WithAudience(RefreshTokenAudienceName),
	)
	if err != nil {
		return nil, err
	}
	if claims.Type != "refresh" {
		return nil, errors.New("invalid token type: expected refresh token")
	}
	return claims, nil
}
