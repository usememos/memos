package v1

import (
	"fmt"
	"strings"
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

	// SessionSlidingDuration is the sliding expiration duration for user sessions.
	// Sessions remain valid if accessed within the last 14 days.
	// Each API call extends the session by updating last_accessed_time.
	SessionSlidingDuration = 14 * 24 * time.Hour

	// SessionCookieName is the HTTP cookie name used to store session information.
	// Cookie value format: {userID}-{sessionID}.
	SessionCookieName = "user_session"
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

// GenerateSessionID generates a unique session ID.
//
// Uses UUID v4 (random) for high entropy and uniqueness.
// Session IDs are stored in user settings and used to identify browser sessions.
func GenerateSessionID() (string, error) {
	return util.GenUUID(), nil
}

// BuildSessionCookieValue creates the session cookie value.
//
// Format: {userID}-{sessionID}
// Example: "123-550e8400-e29b-41d4-a716-446655440000"
//
// This format allows quick extraction of both user ID and session ID
// from the cookie without database lookup during authentication.
func BuildSessionCookieValue(userID int32, sessionID string) string {
	return fmt.Sprintf("%d-%s", userID, sessionID)
}

// ParseSessionCookieValue extracts user ID and session ID from cookie value.
//
// Input format: "{userID}-{sessionID}"
// Returns: (userID, sessionID, error)
//
// Example: "123-550e8400-..." → (123, "550e8400-...", nil).
func ParseSessionCookieValue(cookieValue string) (int32, string, error) {
	parts := strings.SplitN(cookieValue, "-", 2)
	if len(parts) != 2 {
		return 0, "", errors.New("invalid session cookie format")
	}

	userID, err := util.ConvertStringToInt32(parts[0])
	if err != nil {
		return 0, "", errors.Errorf("invalid user ID in session cookie: %v", err)
	}

	return userID, parts[1], nil
}
