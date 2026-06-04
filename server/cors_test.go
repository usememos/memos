package server

import (
	"net/http"
	"net/http/httptest"
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

	t.Run("allows instance URL origin on preflight", func(t *testing.T) {
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

	t.Run("omits CORS headers for unknown origin preflight", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodOptions, "/api/v1/test", nil)
		req.Header.Set("Origin", "https://evil.example")
		req.Header.Set("Access-Control-Request-Method", http.MethodPost)
		rec := httptest.NewRecorder()

		e.ServeHTTP(rec, req)

		if rec.Code != http.StatusNoContent {
			t.Fatalf("expected status %d, got %d", http.StatusNoContent, rec.Code)
		}
		if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
			t.Fatalf("expected no Access-Control-Allow-Origin, got %q", got)
		}
	})
}
