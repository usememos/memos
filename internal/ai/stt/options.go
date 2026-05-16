package stt

import (
	"net/http"
	"time"
)

const defaultHTTPTimeout = 2 * time.Minute

// Options is the resolved option set passed to provider implementations.
type Options struct {
	HTTPClient *http.Client
}

// TranscriberOption customizes a Transcriber.
type TranscriberOption func(*Options)

// WithHTTPClient overrides the HTTP client used by the transcriber.
func WithHTTPClient(client *http.Client) TranscriberOption {
	return func(o *Options) {
		if client != nil {
			o.HTTPClient = client
		}
	}
}

// ApplyOptions resolves a TranscriberOption slice into Options with defaults.
func ApplyOptions(opts []TranscriberOption) Options {
	resolved := Options{HTTPClient: &http.Client{Timeout: defaultHTTPTimeout}}
	for _, apply := range opts {
		apply(&resolved)
	}
	return resolved
}
