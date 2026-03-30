package v1

import (
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/labstack/echo/v5"

	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

const (
	// sseHeartbeatInterval is the interval between heartbeat pings to keep the connection alive.
	sseHeartbeatInterval = 30 * time.Second
)

type sseRouteRegistrar interface {
	GET(path string, h echo.HandlerFunc, m ...echo.MiddlewareFunc) echo.RouteInfo
}

// RegisterSSERoutes registers the SSE endpoint on the given Echo router.
func RegisterSSERoutes(router sseRouteRegistrar, hub *SSEHub, storeInstance *store.Store, secret string) {
	authenticator := auth.NewAuthenticator(storeInstance, secret)
	router.GET("/api/v1/sse", func(c *echo.Context) error {
		return handleSSE(c, hub, authenticator)
	})
}

// handleSSE handles the SSE connection for live memo refresh.
// Authentication is done via Bearer token in the Authorization header.
func handleSSE(c *echo.Context, hub *SSEHub, authenticator *auth.Authenticator) error {
	// Authenticate the request.
	authHeader := c.Request().Header.Get("Authorization")
	result := authenticator.Authenticate(c.Request().Context(), authHeader)
	if result == nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "authentication required"})
	}
	userID, role := getSSEClientIdentity(result)
	if userID == 0 {
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
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}

	// Subscribe to the hub.
	client := hub.Subscribe(userID, role)
	defer hub.Unsubscribe(client)

	// Create a ticker for heartbeat pings.
	heartbeat := time.NewTicker(sseHeartbeatInterval)
	defer heartbeat.Stop()

	ctx := c.Request().Context()

	slog.Debug("SSE client connected", "userID", userID)

	for {
		select {
		case <-ctx.Done():
			// Client disconnected.
			slog.Debug("SSE client disconnected", "userID", userID)
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
			if f, ok := w.(http.Flusher); ok {
				f.Flush()
			}

		case <-heartbeat.C:
			// Send a heartbeat comment to keep the connection alive.
			if _, err := fmt.Fprint(w, ": heartbeat\n\n"); err != nil {
				return nil
			}
			if f, ok := w.(http.Flusher); ok {
				f.Flush()
			}
		}
	}
}

func getSSEClientIdentity(result *auth.AuthResult) (int32, store.Role) {
	if result == nil {
		return 0, store.RoleUser
	}
	if result.Claims != nil {
		return result.Claims.UserID, store.Role(result.Claims.Role)
	}
	if result.User != nil {
		return result.User.ID, result.User.Role
	}
	return 0, store.RoleUser
}
