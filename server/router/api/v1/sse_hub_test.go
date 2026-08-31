package v1

import (
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func mustReceive(t *testing.T, ch <-chan []byte, within time.Duration) []byte {
	t.Helper()
	select {
	case data, ok := <-ch:
		require.True(t, ok, "SSE event channel closed before an event arrived")
		return data
	case <-time.After(within):
		t.Fatal("timed out waiting for SSE event")
		return nil
	}
}

func mustNotReceive(t *testing.T, ch <-chan []byte, within time.Duration) {
	t.Helper()
	select {
	case data, ok := <-ch:
		if ok {
			t.Fatalf("unexpected SSE event received: %s", data)
		}
	case <-time.After(within):
	}
}

func TestSSEHubSubscribeUnsubscribe(t *testing.T) {
	hub := NewSSEHub()
	client := hub.Subscribe()
	require.NotNil(t, client)
	require.NotNil(t, client.events)

	hub.Unsubscribe(client)

	_, ok := <-client.events
	assert.False(t, ok, "event channel should be closed after unsubscribe")
	_, ok = <-client.done
	assert.False(t, ok, "done channel should be closed after unsubscribe")
}

func TestSSEHubClose(t *testing.T) {
	hub := NewSSEHub()
	first := hub.Subscribe()
	second := hub.Subscribe()

	hub.Close()
	hub.Close()

	for _, ch := range []chan []byte{first.events, second.events} {
		_, ok := <-ch
		assert.False(t, ok, "event channel should be closed after hub close")
	}
	for _, ch := range []chan struct{}{first.done, second.done} {
		_, ok := <-ch
		assert.False(t, ok, "done channel should be closed after hub close")
	}

	late := hub.Subscribe()
	_, ok := <-late.events
	assert.False(t, ok, "late subscriber should be closed immediately")
	hub.publishMemoChanged()
}

func TestSSEHubPublishMemoChangedBroadcastsToSubscribers(t *testing.T) {
	hub := NewSSEHub()
	first := hub.Subscribe()
	defer hub.Unsubscribe(first)
	second := hub.Subscribe()
	defer hub.Unsubscribe(second)

	hub.publishMemoChanged()

	for _, client := range []*SSEClient{first, second} {
		assert.Equal(t, memoChangedSSEFrame, string(mustReceive(t, client.events, time.Second)))
	}
}

func TestSSEHubPublishSpaceChangedBroadcastsDistinctFrame(t *testing.T) {
	hub := NewSSEHub()
	first := hub.Subscribe()
	defer hub.Unsubscribe(first)
	second := hub.Subscribe()
	defer hub.Unsubscribe(second)

	hub.publishSpaceChanged()

	for _, client := range []*SSEClient{first, second} {
		frame := string(mustReceive(t, client.events, time.Second))
		assert.Equal(t, spaceChangedSSEFrame, frame)
		assert.NotEqual(t, memoChangedSSEFrame, frame)
	}
}

func TestSSEHubSlowClientIsDisconnected(t *testing.T) {
	hub := NewSSEHub()
	slow := hub.Subscribe()
	defer hub.Unsubscribe(slow)

	for range sseClientEventBufferSize + 1 {
		hub.publishMemoChanged()
	}

	select {
	case <-slow.done:
	default:
		t.Fatal("slow client should be disconnected after its event buffer fills")
	}

	received := 0
	for range slow.events {
		received++
	}
	assert.Equal(t, sseClientEventBufferSize, received)
}

func TestSSEHubConcurrentAccess(t *testing.T) {
	const (
		workers    = 16
		iterations = 100
	)
	hub := NewSSEHub()

	var wg sync.WaitGroup
	for range workers {
		wg.Go(func() {
			for range iterations {
				client := hub.Subscribe()
				hub.publishMemoChanged()
				select {
				case <-client.events:
				default:
				}
				hub.Unsubscribe(client)
			}
		})
	}
	wg.Wait()

	hub.mu.RLock()
	defer hub.mu.RUnlock()
	assert.Empty(t, hub.clients)
}
