package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v5"

	"github.com/usememos/memos/internal/profile"
)

func TestAllowedCORSOrigin(t *testing.T) {
	p := &profile.Profile{InstanceURL: "https://memos.example"}

	tests := []struct {
		name        string
		requestHost string
		origin      string
		allowed     bool
	}{
		{
			name:        "same host",
			requestHost: "localhost",
			origin:      "http://localhost",
			allowed:     true,
		},
		{
			name:        "instance URL",
			requestHost: "localhost",
			origin:      "https://memos.example",
			allowed:     true,
		},
		{
			name:        "usememos apex",
			requestHost: "localhost",
			origin:      "https://usememos.com",
			allowed:     false,
		},
		{
			name:        "usememos subdomain",
			requestHost: "localhost",
			origin:      "https://demo.usememos.com",
			allowed:     false,
		},
		{
			name:        "nested usememos subdomain",
			requestHost: "localhost",
			origin:      "https://preview.demo.usememos.com",
			allowed:     false,
		},
		{
			name:        "usememos subdomain with port",
			requestHost: "localhost",
			origin:      "http://localhost.usememos.com:3001",
			allowed:     false,
		},
		{
			name:        "unknown origin",
			requestHost: "localhost",
			origin:      "https://evil.example",
			allowed:     false,
		},
		{
			name:        "lookalike domain",
			requestHost: "localhost",
			origin:      "https://evilusememos.com",
			allowed:     false,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if allowed := isAllowedCORSOrigin(p, test.requestHost, test.origin); allowed != test.allowed {
				t.Fatalf("expected allowed=%t, got %t", test.allowed, allowed)
			}
		})
	}
}

func TestCORSMiddleware(t *testing.T) {
	e := echo.New()
	e.Use(newCORSMiddleware(&profile.Profile{InstanceURL: "https://memos.example"}))
	e.POST("/api/v1/test", func(c *echo.Context) error {
		return c.NoContent(http.StatusOK)
	})

	t.Run("trusted origin gets credentialed access", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodOptions, "/api/v1/test", nil)
		req.Header.Set("Origin", "https://memos.example")
		req.Header.Set("Access-Control-Request-Method", http.MethodPost)
		rec := httptest.NewRecorder()

		e.ServeHTTP(rec, req)

		if rec.Code != http.StatusNoContent {
			t.Fatalf("expected status %d, got %d", http.StatusNoContent, rec.Code)
		}
		if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://memos.example" {
			t.Fatalf("unexpected Access-Control-Allow-Origin: %q", got)
		}
		if got := rec.Header().Get("Access-Control-Allow-Credentials"); got != "true" {
			t.Fatalf("unexpected Access-Control-Allow-Credentials: %q", got)
		}
	})

	t.Run("arbitrary origin is reflected without credentials", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodOptions, "/api/v1/test", nil)
		req.Header.Set("Origin", "https://evil.example")
		req.Header.Set("Access-Control-Request-Method", http.MethodPost)
		rec := httptest.NewRecorder()

		e.ServeHTTP(rec, req)

		if rec.Code != http.StatusNoContent {
			t.Fatalf("expected status %d, got %d", http.StatusNoContent, rec.Code)
		}
		// The API is open to any origin (token auth), so the origin is reflected...
		if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://evil.example" {
			t.Fatalf("expected origin to be reflected, got %q", got)
		}
		// ...but an untrusted origin must NOT be granted credentialed (cookie) access.
		if got := rec.Header().Get("Access-Control-Allow-Credentials"); got != "" {
			t.Fatalf("expected no Access-Control-Allow-Credentials for untrusted origin, got %q", got)
		}
	})

	t.Run("arbitrary origin may send Authorization header", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodOptions, "/api/v1/test", nil)
		req.Header.Set("Origin", "https://app.third-party.example")
		req.Header.Set("Access-Control-Request-Method", http.MethodPost)
		req.Header.Set("Access-Control-Request-Headers", "Authorization")
		rec := httptest.NewRecorder()

		e.ServeHTTP(rec, req)

		if got := rec.Header().Get("Access-Control-Allow-Headers"); !strings.Contains(strings.ToLower(got), "authorization") {
			t.Fatalf("expected Authorization to be allowed for a cross-origin token client, got %q", got)
		}
	})

	t.Run("null origin is not reflected", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodOptions, "/api/v1/test", nil)
		req.Header.Set("Origin", "null")
		req.Header.Set("Access-Control-Request-Method", http.MethodPost)
		rec := httptest.NewRecorder()

		e.ServeHTTP(rec, req)

		if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
			t.Fatalf("expected null origin not to be reflected, got %q", got)
		}
	})
}
