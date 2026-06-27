package server

import (
	"net/url"
	"strings"

	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"

	"github.com/usememos/memos/internal/profile"
)

func newCORSMiddleware(profile *profile.Profile) echo.MiddlewareFunc {
	return middleware.CORSWithConfig(middleware.CORSConfig{
		// The API is open to any origin so that token-authenticated clients
		// (Access Token V2 / PAT in the Authorization header) can call it from
		// anywhere. Credentials — i.e. the SameSite=Lax refresh-token cookie — are
		// granted only to trusted origins (same host or the configured InstanceURL).
		//
		// AllowCredentials stays false here on purpose: the per-origin
		// Access-Control-Allow-Credentials header is set inside the func below.
		// Do NOT switch this to AllowCredentials:true — emitting that header for
		// every reflected origin would let a malicious same-site subdomain read the
		// cookie-authenticated /auth/refresh response and steal an access token.
		AllowCredentials: false,
		UnsafeAllowOriginFunc: func(c *echo.Context, origin string) (string, bool, error) {
			// Never reflect the opaque "null" origin (sandboxed iframes, file://).
			if origin == "null" {
				return "", false, nil
			}
			// Trusted origins additionally get credentialed (cookie) access.
			if isAllowedCORSOrigin(profile, c.Request().Host, origin) {
				c.Response().Header().Set(echo.HeaderAccessControlAllowCredentials, "true")
			}
			// Reflect every origin; only trusted ones carry the credentials header.
			return origin, true, nil
		},
	})
}

func isAllowedCORSOrigin(profile *profile.Profile, requestHost, origin string) bool {
	originURL, err := url.Parse(origin)
	if err != nil || originURL.Scheme == "" || originURL.Host == "" {
		return false
	}

	if strings.EqualFold(originURL.Host, requestHost) {
		return true
	}

	if profile == nil || profile.InstanceURL == "" {
		return false
	}
	instanceURL, err := url.Parse(profile.InstanceURL)
	if err != nil || instanceURL.Scheme == "" || instanceURL.Host == "" {
		return false
	}
	return strings.EqualFold(originURL.Scheme, instanceURL.Scheme) && strings.EqualFold(originURL.Host, instanceURL.Host)
}
