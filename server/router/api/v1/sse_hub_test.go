package v1

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSSEHub_SubscribeUnsubscribe(t *testing.T) {
	hub := NewSSEHub()

	client := hub.Subscribe()
	require.NotNil(t, client)
	require.NotNil(t, client.events)

	// Unsubscribe removes the client and closes the channel.
	hub.Unsubscribe(client)

	// Channel should be closed.
	_, ok := <-client.events
	assert.False(t, ok, "channel should be closed after Unsubscribe")
}

func TestSSEHub_Broadcast(t *testing.T) {
	hub := NewSSEHub()
	client := hub.Subscribe()
	defer hub.Unsubscribe(client)

	event := &SSEEvent{Type: SSEEventMemoCreated, Name: "memos/123"}
	hub.Broadcast(event)

	select {
	case data := <-client.events:
		assert.Contains(t, string(data), `"type":"memo.created"`)
		assert.Contains(t, string(data), `"name":"memos/123"`)
	case <-time.After(time.Second):
		t.Fatal("expected to receive event within 1s")
	}
}

func TestSSEHub_BroadcastMultipleClients(t *testing.T) {
	hub := NewSSEHub()
	c1 := hub.Subscribe()
	defer hub.Unsubscribe(c1)
	c2 := hub.Subscribe()
	defer hub.Unsubscribe(c2)

	event := &SSEEvent{Type: SSEEventMemoDeleted, Name: "memos/456"}
	hub.Broadcast(event)

	for _, ch := range []chan []byte{c1.events, c2.events} {
		select {
		case data := <-ch:
			assert.Contains(t, string(data), "memo.deleted")
			assert.Contains(t, string(data), "memos/456")
		case <-time.After(time.Second):
			t.Fatal("expected to receive event within 1s")
		}
	}
}

func TestSSEEvent_JSON(t *testing.T) {
	e := &SSEEvent{Type: SSEEventMemoUpdated, Name: "memos/789"}
	data := e.JSON()
	require.NotEmpty(t, data)
	assert.Contains(t, string(data), `"type":"memo.updated"`)
	assert.Contains(t, string(data), `"name":"memos/789"`)
}
