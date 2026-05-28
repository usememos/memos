package audiollm

import (
	"net/http"
	"time"
)

const defaultHTTPTimeout = 2 * time.Minute

// Options is the resolved option set passed to provider implementations.
type Options struct {
	HTTPClient *http.Client
}

// ModelOption customizes a Model.
type ModelOption func(*Options)

// WithHTTPClient overrides the HTTP client used by the model.
func WithHTTPClient(client *http.Client) ModelOption {
	return func(o *Options) {
		if client != nil {
			o.HTTPClient = client
		}
	}
}

// ApplyOptions resolves a ModelOption slice into Options with defaults.
func ApplyOptions(opts []ModelOption) Options {
	resolved := Options{HTTPClient: &http.Client{Timeout: defaultHTTPTimeout}}
	for _, apply := range opts {
		apply(&resolved)
	}
	return resolved
}
