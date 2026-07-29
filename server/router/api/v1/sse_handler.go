package v1

import (
	"io"
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
	sseConnectedComment  = ": connected\n\n"
	sseHeartbeatComment  = ": heartbeat\n\n"
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

	var flusher http.Flusher
	if f, ok := w.(http.Flusher); ok {
		flusher = f
	}

	// Flush headers immediately.
	if flusher != nil {
		flusher.Flush()
	}

	// Subscribe to the hub.
	client := hub.Subscribe(userID, role)
	defer hub.Unsubscribe(client)

	ctx := c.Request().Context()

	slog.Debug("SSE client connected", "userID", userID)

	// Send an initial comment so clients and dev proxies observe the stream
	// immediately instead of waiting for the first heartbeat or data event.
	if _, err := io.WriteString(w, sseConnectedComment); err != nil {
		return nil
	}
	if flusher != nil {
		flusher.Flush()
	}

	// Heartbeats are only needed after a period with no event data.
	heartbeat := time.NewTimer(sseHeartbeatInterval)
	defer heartbeat.Stop()

	for {
		// Prefer a hub-initiated disconnect over draining buffered events.
		select {
		case <-client.done:
			return nil
		default:
		}

		select {
		case <-ctx.Done():
			// Client disconnected.
			slog.Debug("SSE client disconnected", "userID", userID)
			return nil

		case <-client.done:
			return nil

		case frame, ok := <-client.events:
			if !ok {
				// Channel closed, client was unsubscribed.
				return nil
			}
			if _, err := w.Write(frame); err != nil {
				return nil
			}
			if flusher != nil {
				flusher.Flush()
			}
			resetSSETimer(heartbeat)

		case <-heartbeat.C:
			// Send a heartbeat comment to keep the connection alive.
			if _, err := io.WriteString(w, sseHeartbeatComment); err != nil {
				return nil
			}
			if flusher != nil {
				flusher.Flush()
			}
			resetSSETimer(heartbeat)
		}
	}
}

func resetSSETimer(timer *time.Timer) {
	if !timer.Stop() {
		select {
		case <-timer.C:
		default:
		}
	}
	timer.Reset(sseHeartbeatInterval)
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
