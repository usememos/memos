package chat

import (
	"net/http"
	"time"
)

const defaultHTTPTimeout = 2 * time.Minute

// Options is the resolved option set passed to provider implementations.
type Options struct {
	HTTPClient *http.Client
}

// CompleterOption customizes a Completer.
type CompleterOption func(*Options)

// WithHTTPClient overrides the HTTP client used by the completer.
func WithHTTPClient(client *http.Client) CompleterOption {
	return func(o *Options) {
		if client != nil {
			o.HTTPClient = client
		}
	}
}

// ApplyOptions resolves a CompleterOption slice into Options with defaults.
func ApplyOptions(opts []CompleterOption) Options {
	resolved := Options{HTTPClient: &http.Client{Timeout: defaultHTTPTimeout}}
	for _, apply := range opts {
		apply(&resolved)
	}
	return resolved
}
