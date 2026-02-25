package v1

import (
	"encoding/json"
	"sync"
)

// SSEEventType represents the type of change event.
type SSEEventType string

const (
	SSEEventMemoCreated      SSEEventType = "memo.created"
	SSEEventMemoUpdated      SSEEventType = "memo.updated"
	SSEEventMemoDeleted      SSEEventType = "memo.deleted"
	SSEEventReactionUpserted SSEEventType = "reaction.upserted"
	SSEEventReactionDeleted  SSEEventType = "reaction.deleted"
)

// SSEEvent represents a change event sent to SSE clients.
type SSEEvent struct {
	Type SSEEventType `json:"type"`
	// Name is the affected resource name (e.g., "memos/xxxx").
	// For reaction events, this is the memo resource name that the reaction belongs to.
	Name string `json:"name"`
}

// JSON returns the JSON representation of the event.
func (e *SSEEvent) JSON() []byte {
	data, _ := json.Marshal(e)
	return data
}

// SseClient represents a single SSE connection.
type SseClient struct {
	events chan []byte
}

// SSEHub manages SSE client connections and broadcasts events.
// It is safe for concurrent use.
type SSEHub struct {
	mu      sync.RWMutex
	clients map[*SseClient]struct{}
}

// NewSSEHub creates a new SSE hub.
func NewSSEHub() *SSEHub {
	return &SSEHub{
		clients: make(map[*SseClient]struct{}),
	}
}

// Subscribe registers a new client and returns it.
// The caller must call Unsubscribe when done.
func (h *SSEHub) Subscribe() *SseClient {
	c := &SseClient{
		// Buffer a few events so a slow client doesn't block broadcasting.
		events: make(chan []byte, 32),
	}
	h.mu.Lock()
	h.clients[c] = struct{}{}
	h.mu.Unlock()
	return c
}

// Unsubscribe removes a client and closes its channel.
func (h *SSEHub) Unsubscribe(c *SseClient) {
	h.mu.Lock()
	if _, ok := h.clients[c]; ok {
		delete(h.clients, c)
		close(c.events)
	}
	h.mu.Unlock()
}

// Broadcast sends an event to all connected clients.
// Slow clients that have a full buffer will have the event dropped
// to avoid blocking the broadcaster.
func (h *SSEHub) Broadcast(event *SSEEvent) {
	data := event.JSON()
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients {
		select {
		case c.events <- data:
		default:
			// Drop event for slow client to avoid blocking.
		}
	}
}
