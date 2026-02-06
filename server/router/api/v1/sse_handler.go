package v1

import (
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

const (
	// sseHeartbeatInterval is the interval between heartbeat pings to keep the connection alive.
	sseHeartbeatInterval = 30 * time.Second
)

// RegisterSSERoutes registers the SSE endpoint on the given Echo instance.
func RegisterSSERoutes(echoServer *echo.Echo, hub *SSEHub, storeInstance *store.Store, secret string) {
	authenticator := auth.NewAuthenticator(storeInstance, secret)
	echoServer.GET("/api/v1/sse", func(c echo.Context) error {
		return handleSSE(c, hub, authenticator)
	})
}

// handleSSE handles the SSE connection for live memo refresh.
// Authentication is done via Bearer token in the Authorization header,
// or via the "token" query parameter (for EventSource which cannot set headers).
func handleSSE(c echo.Context, hub *SSEHub, authenticator *auth.Authenticator) error {
	// Authenticate the request.
	authHeader := c.Request().Header.Get("Authorization")
	if authHeader == "" {
		// Fall back to query parameter for native EventSource support.
		if token := c.QueryParam("token"); token != "" {
			authHeader = "Bearer " + token
		}
	}

	result := authenticator.Authenticate(c.Request().Context(), authHeader)
	if result == nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "authentication required"})
	}

	// Set SSE headers.
	w := c.Response()
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // Disable nginx buffering
	w.WriteHeader(http.StatusOK)

	// Flush headers immediately.
	if f, ok := w.Writer.(http.Flusher); ok {
		f.Flush()
	}

	// Subscribe to the hub.
	client := hub.Subscribe()
	defer hub.Unsubscribe(client)

	// Create a ticker for heartbeat pings.
	heartbeat := time.NewTicker(sseHeartbeatInterval)
	defer heartbeat.Stop()

	ctx := c.Request().Context()

	slog.Debug("SSE client connected")

	for {
		select {
		case <-ctx.Done():
			// Client disconnected.
			slog.Debug("SSE client disconnected")
			return nil

		case data, ok := <-client.events:
			if !ok {
				// Channel closed, client was unsubscribed.
				return nil
			}
			// Write SSE event.
			if _, err := fmt.Fprintf(w, "data: %s\n\n", data); err != nil {
				return nil
			}
			if f, ok := w.Writer.(http.Flusher); ok {
				f.Flush()
			}

		case <-heartbeat.C:
			// Send a heartbeat comment to keep the connection alive.
			if _, err := fmt.Fprint(w, ": heartbeat\n\n"); err != nil {
				return nil
			}
			if f, ok := w.Writer.(http.Flusher); ok {
				f.Flush()
			}
		}
	}
}
