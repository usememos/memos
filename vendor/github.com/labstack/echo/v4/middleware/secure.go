package middleware

import (
	"fmt"

	"github.com/labstack/echo/v4"
)

type (
	// SecureConfig defines the config for Secure middleware.
	SecureConfig struct {
		// Skipper defines a function to skip middleware.
		Skipper Skipper

		// XSSProtection provides protection against cross-site scripting attack (XSS)
		// by setting the `X-XSS-Protection` header.
		// Optional. Default value "1; mode=block".
		XSSProtection string `yaml:"xss_protection"`

		// ContentTypeNosniff provides protection against overriding Content-Type
		// header by setting the `X-Content-Type-Options` header.
		// Optional. Default value "nosniff".
		ContentTypeNosniff string `yaml:"content_type_nosniff"`

		// XFrameOptions can be used to indicate whether or not a browser should
		// be allowed to render a page in a <frame>, <iframe> or <object> .
		// Sites can use this to avoid clickjacking attacks, by ensuring that their
		// content is not embedded into other sites.provides protection against
		// clickjacking.
		// Optional. Default value "SAMEORIGIN".
		// Possible values:
		// - "SAMEORIGIN" - The page can only be displayed in a frame on the same origin as the page itself.
		// - "DENY" - The page cannot be displayed in a frame, regardless of the site attempting to do so.
		// - "ALLOW-FROM uri" - The page can only be displayed in a frame on the specified origin.
		XFrameOptions string `yaml:"x_frame_options"`

		// HSTSMaxAge sets the `Strict-Transport-Security` header to indicate how
		// long (in seconds) browsers should remember that this site is only to
		// be accessed using HTTPS. This reduces your exposure to some SSL-stripping
		// man-in-the-middle (MITM) attacks.
		// Optional. Default value 0.
		HSTSMaxAge int `yaml:"hsts_max_age"`

		// HSTSExcludeSubdomains won't include subdomains tag in the `Strict Transport Security`
		// header, excluding all subdomains from security policy. It has no effect
		// unless HSTSMaxAge is set to a non-zero value.
		// Optional. Default value false.
		HSTSExcludeSubdomains bool `yaml:"hsts_exclude_subdomains"`

		// ContentSecurityPolicy sets the `Content-Security-Policy` header providing
		// security against cross-site scripting (XSS), clickjacking and other code
		// injection attacks resulting from execution of malicious content in the
		// trusted web page context.
		// Optional. Default value "".
		ContentSecurityPolicy string `yaml:"content_security_policy"`

		// CSPReportOnly would use the `Content-Security-Policy-Report-Only` header instead
		// of the `Content-Security-Policy` header. This allows iterative updates of the
		// content security policy by only reporting the violations that would
		// have occurred instead of blocking the resource.
		// Optional. Default value false.
		CSPReportOnly bool `yaml:"csp_report_only"`

		// HSTSPreloadEnabled will add the preload tag in the `Strict Transport Security`
		// header, which enables the domain to be included in the HSTS preload list
		// maintained by Chrome (and used by Firefox and Safari): https://hstspreload.org/
		// Optional.  Default value false.
		HSTSPreloadEnabled bool `yaml:"hsts_preload_enabled"`

		// ReferrerPolicy sets the `Referrer-Policy` header providing security against
		// leaking potentially sensitive request paths to third parties.
		// Optional. Default value "".
		ReferrerPolicy string `yaml:"referrer_policy"`
	}
)

var (
	// DefaultSecureConfig is the default Secure middleware config.
	DefaultSecureConfig = SecureConfig{
		Skipper:            DefaultSkipper,
		XSSProtection:      "1; mode=block",
		ContentTypeNosniff: "nosniff",
		XFrameOptions:      "SAMEORIGIN",
		HSTSPreloadEnabled: false,
	}
)

// Secure returns a Secure middleware.
// Secure middleware provides protection against cross-site scripting (XSS) attack,
// content type sniffing, clickjacking, insecure connection and other code injection
// attacks.
func Secure() echo.MiddlewareFunc {
	return SecureWithConfig(DefaultSecureConfig)
}

// SecureWithConfig returns a Secure middleware with config.
// See: `Secure()`.
func SecureWithConfig(config SecureConfig) echo.MiddlewareFunc {
	// Defaults
	if config.Skipper == nil {
		config.Skipper = DefaultSecureConfig.Skipper
	}

	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if config.Skipper(c) {
				return next(c)
			}

			req := c.Request()
			res := c.Response()

			if config.XSSProtection != "" {
				res.Header().Set(echo.HeaderXXSSProtection, config.XSSProtection)
			}
			if config.ContentTypeNosniff != "" {
				res.Header().Set(echo.HeaderXContentTypeOptions, config.ContentTypeNosniff)
			}
			if config.XFrameOptions != "" {
				res.Header().Set(echo.HeaderXFrameOptions, config.XFrameOptions)
			}
			if (c.IsTLS() || (req.Header.Get(echo.HeaderXForwardedProto) == "https")) && config.HSTSMaxAge != 0 {
				subdomains := ""
				if !config.HSTSExcludeSubdomains {
					subdomains = "; includeSubdomains"
				}
				if config.HSTSPreloadEnabled {
					subdomains = fmt.Sprintf("%s; preload", subdomains)
				}
				res.Header().Set(echo.HeaderStrictTransportSecurity, fmt.Sprintf("max-age=%d%s", config.HSTSMaxAge, subdomains))
			}
			if config.ContentSecurityPolicy != "" {
				if config.CSPReportOnly {
					res.Header().Set(echo.HeaderContentSecurityPolicyReportOnly, config.ContentSecurityPolicy)
				} else {
					res.Header().Set(echo.HeaderContentSecurityPolicy, config.ContentSecurityPolicy)
				}
			}
			if config.ReferrerPolicy != "" {
				res.Header().Set(echo.HeaderReferrerPolicy, config.ReferrerPolicy)
			}
			return next(c)
		}
	}
}
