package auth

import (
	"net/http"
	"strings"
)

// ExtractSessionCookieFromHeader extracts the session cookie value from an HTTP Cookie header.
// Returns empty string if the session cookie is not found.
func ExtractSessionCookieFromHeader(cookieHeader string) string {
	if cookieHeader == "" {
		return ""
	}
	// Use http.Request to parse cookies properly
	req := &http.Request{Header: http.Header{"Cookie": []string{cookieHeader}}}
	cookie, err := req.Cookie(SessionCookieName)
	if err != nil {
		return ""
	}
	return cookie.Value
}

// ExtractBearerToken extracts the JWT token from an Authorization header value.
// Expected format: "Bearer {token}"
// Returns empty string if no valid bearer token is found.
func ExtractBearerToken(authHeader string) string {
	if authHeader == "" {
		return ""
	}
	parts := strings.Fields(authHeader)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
		return ""
	}
	return parts[1]
}

// ExtractRefreshTokenFromCookie extracts the refresh token from cookie header.
func ExtractRefreshTokenFromCookie(cookieHeader string) string {
	if cookieHeader == "" {
		return ""
	}
	req := &http.Request{Header: http.Header{"Cookie": []string{cookieHeader}}}
	cookie, err := req.Cookie(RefreshTokenCookieName)
	if err != nil {
		return ""
	}
	return cookie.Value
}
