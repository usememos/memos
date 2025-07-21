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
	// issuer is the issuer of the jwt token.
	Issuer = "memos"
	// Signing key section. For now, this is only used for signing, not for verifying since we only
	// have 1 version. But it will be used to maintain backward compatibility if we change the signing mechanism.
	KeyID = "v1"
	// AccessTokenAudienceName is the audience name of the access token.
	AccessTokenAudienceName = "user.access-token"
	// SessionSlidingDuration is the sliding expiration duration for user sessions (2 weeks).
	// Sessions are considered valid if last_accessed_time + SessionSlidingDuration > current_time.
	SessionSlidingDuration = 14 * 24 * time.Hour

	// SessionCookieName is the cookie name of user session ID.
	SessionCookieName = "user_session"
)

type ClaimsMessage struct {
	Name string `json:"name"`
	jwt.RegisteredClaims
}

// GenerateAccessToken generates an access token.
func GenerateAccessToken(username string, userID int32, expirationTime time.Time, secret []byte) (string, error) {
	return generateToken(username, userID, AccessTokenAudienceName, expirationTime, secret)
}

// generateToken generates a jwt token.
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

// GenerateSessionID generates a unique session ID using UUIDv4.
func GenerateSessionID() (string, error) {
	return util.GenUUID(), nil
}

// BuildSessionCookieValue builds the session cookie value in format {userID}-{sessionID}.
func BuildSessionCookieValue(userID int32, sessionID string) string {
	return fmt.Sprintf("%d-%s", userID, sessionID)
}

// ParseSessionCookieValue parses the session cookie value to extract userID and sessionID.
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
