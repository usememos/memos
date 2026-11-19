// Package requesthost exposes the Host of the HTTP request to handlers that
// need to know which origin the client actually reached. Unlike a forwarded
// header, the value cannot be chosen by the client's browser, so it is the
// best available stand-in for the instance's own origin when no instance URL
// is configured.
package requesthost

import (
	"context"
	"net/http"
)

type contextKey struct{}

// Middleware stores the request's Host in the context.
func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), contextKey{}, r.Host)))
	})
}

// FromContext returns the Host the request was sent to, or "" when the
// request did not pass through Middleware.
func FromContext(ctx context.Context) string {
	if host, ok := ctx.Value(contextKey{}).(string); ok {
		return host
	}
	return ""
}
