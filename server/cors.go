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
		UnsafeAllowOriginFunc: func(c *echo.Context, origin string) (string, bool, error) {
			if isAllowedCORSOrigin(profile, c.Request().Host, origin) {
				return origin, true, nil
			}
			return "", false, nil
		},
		AllowCredentials: true,
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
