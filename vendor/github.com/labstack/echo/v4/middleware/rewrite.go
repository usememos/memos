package middleware

import (
	"regexp"

	"github.com/labstack/echo/v4"
)

type (
	// RewriteConfig defines the config for Rewrite middleware.
	RewriteConfig struct {
		// Skipper defines a function to skip middleware.
		Skipper Skipper

		// Rules defines the URL path rewrite rules. The values captured in asterisk can be
		// retrieved by index e.g. $1, $2 and so on.
		// Example:
		// "/old":              "/new",
		// "/api/*":            "/$1",
		// "/js/*":             "/public/javascripts/$1",
		// "/users/*/orders/*": "/user/$1/order/$2",
		// Required.
		Rules map[string]string `yaml:"rules"`

		// RegexRules defines the URL path rewrite rules using regexp.Rexexp with captures
		// Every capture group in the values can be retrieved by index e.g. $1, $2 and so on.
		// Example:
		// "^/old/[0.9]+/":     "/new",
		// "^/api/.+?/(.*)":     "/v2/$1",
		RegexRules map[*regexp.Regexp]string `yaml:"regex_rules"`
	}
)

var (
	// DefaultRewriteConfig is the default Rewrite middleware config.
	DefaultRewriteConfig = RewriteConfig{
		Skipper: DefaultSkipper,
	}
)

// Rewrite returns a Rewrite middleware.
//
// Rewrite middleware rewrites the URL path based on the provided rules.
func Rewrite(rules map[string]string) echo.MiddlewareFunc {
	c := DefaultRewriteConfig
	c.Rules = rules
	return RewriteWithConfig(c)
}

// RewriteWithConfig returns a Rewrite middleware with config.
// See: `Rewrite()`.
func RewriteWithConfig(config RewriteConfig) echo.MiddlewareFunc {
	// Defaults
	if config.Rules == nil && config.RegexRules == nil {
		panic("echo: rewrite middleware requires url path rewrite rules or regex rules")
	}

	if config.Skipper == nil {
		config.Skipper = DefaultBodyDumpConfig.Skipper
	}

	if config.RegexRules == nil {
		config.RegexRules = make(map[*regexp.Regexp]string)
	}
	for k, v := range rewriteRulesRegex(config.Rules) {
		config.RegexRules[k] = v
	}

	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) (err error) {
			if config.Skipper(c) {
				return next(c)
			}

			if err := rewriteURL(config.RegexRules, c.Request()); err != nil {
				return err
			}
			return next(c)
		}
	}
}
