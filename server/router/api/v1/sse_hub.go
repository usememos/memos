package v1

import (
	"encoding/json"
	"log/slog"
	"sync"

	"github.com/usememos/memos/store"
)

// SSEEventType represents the type of change event.
type SSEEventType string

const (
	SSEEventMemoCreated        SSEEventType = "memo.created"
	SSEEventMemoUpdated        SSEEventType = "memo.updated"
	SSEEventMemoDeleted        SSEEventType = "memo.deleted"
	SSEEventMemoCommentCreated SSEEventType = "memo.comment.created"
	SSEEventReactionUpserted   SSEEventType = "reaction.upserted"
	SSEEventReactionDeleted    SSEEventType = "reaction.deleted"
)

// SSEEvent represents a change event sent to SSE clients.
type SSEEvent struct {
	Type SSEEventType `json:"type"`
	// Name is the affected resource name (e.g., "memos/xxxx").
	// For reaction events, this is the memo resource name that the reaction belongs to.
	Name string `json:"name"`
	// Parent is the parent memo resource name when the affected resource is a comment.
	Parent string `json:"parent,omitempty"`
	// Visibility and CreatorID are used only for server-side delivery filtering.
	Visibility store.Visibility `json:"-"`
	CreatorID  int32            `json:"-"`
}

// JSON returns the JSON representation of the event.
// Returns nil if marshaling fails (error is logged).
func (e *SSEEvent) JSON() []byte {
	data, err := json.Marshal(e)
	if err != nil {
		slog.Error("failed to marshal SSE event", "err", err, "event", e)
		return nil
	}
	return data
}

// SSEClient represents a single SSE connection.
type SSEClient struct {
	events chan []byte
	userID int32
	role   store.Role
}

// SSEHub manages SSE client connections and broadcasts events.
// It is safe for concurrent use.
type SSEHub struct {
	mu      sync.RWMutex
	clients map[*SSEClient]struct{}
	closed  bool
}

// NewSSEHub creates a new SSE hub.
func NewSSEHub() *SSEHub {
	return &SSEHub{
		clients: make(map[*SSEClient]struct{}),
	}
}

// Subscribe registers a new client and returns it.
// The caller must call Unsubscribe when done.
func (h *SSEHub) Subscribe(userID int32, role store.Role) *SSEClient {
	c := &SSEClient{
		// Buffer a few events so a slow client doesn't block broadcasting.
		events: make(chan []byte, 32),
		userID: userID,
		role:   role,
	}
	h.mu.Lock()
	if h.closed {
		close(c.events)
	} else {
		h.clients[c] = struct{}{}
	}
	h.mu.Unlock()
	return c
}

// Unsubscribe removes a client and closes its channel.
func (h *SSEHub) Unsubscribe(c *SSEClient) {
	h.mu.Lock()
	if _, ok := h.clients[c]; ok {
		delete(h.clients, c)
		close(c.events)
	}
	h.mu.Unlock()
}

// Close disconnects all subscribed SSE clients.
func (h *SSEHub) Close() {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.closed {
		return
	}
	h.closed = true
	for c := range h.clients {
		delete(h.clients, c)
		close(c.events)
	}
}

// Broadcast sends an event to all connected clients.
// Slow clients that have a full buffer will have the event dropped
// to avoid blocking the broadcaster.
func (h *SSEHub) Broadcast(event *SSEEvent) {
	data := event.JSON()
	if len(data) == 0 {
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients {
		if !c.canReceive(event) {
			continue
		}
		select {
		case c.events <- data:
		default:
			// Drop event for slow client to avoid blocking.
		}
	}
}

func (c *SSEClient) canReceive(event *SSEEvent) bool {
	switch event.Visibility {
	case store.Private:
		return c.userID == event.CreatorID || c.role == store.RoleAdmin
	case store.Public, store.Protected, "":
		return true
	default:
		slog.Warn("SSE canReceive: unknown visibility type, denying event", "visibility", event.Visibility)
		return false
	}
}
