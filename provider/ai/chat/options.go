package chat

import (
	"net/http"
	"time"
)

const defaultHTTPTimeout = 3 * time.Minute

// Options is the resolved option set passed to provider implementations.
type Options struct {
	HTTPClient *http.Client
	// ExtraHeaders are added to every request. OpenRouter uses these for
	// optional app attribution; other providers ignore them.
	ExtraHeaders map[string]string
}

// ChatterOption customizes a Chatter.
type ChatterOption func(*Options)

// WithHTTPClient overrides the HTTP client used by the chatter.
func WithHTTPClient(client *http.Client) ChatterOption {
	return func(o *Options) {
		if client != nil {
			o.HTTPClient = client
		}
	}
}

// WithExtraHeaders adds headers to every request.
func WithExtraHeaders(headers map[string]string) ChatterOption {
	return func(o *Options) {
		if len(headers) == 0 {
			return
		}
		if o.ExtraHeaders == nil {
			o.ExtraHeaders = make(map[string]string, len(headers))
		}
		for name, value := range headers {
			o.ExtraHeaders[name] = value
		}
	}
}

// ApplyOptions resolves a ChatterOption slice into Options with defaults.
func ApplyOptions(opts []ChatterOption) Options {
	resolved := Options{HTTPClient: &http.Client{Timeout: defaultHTTPTimeout}}
	for _, apply := range opts {
		apply(&resolved)
	}
	return resolved
}
