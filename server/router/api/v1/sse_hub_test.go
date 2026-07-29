package v1

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

// helpers shared by multiple tests in this file.

func mustReceive(t *testing.T, ch <-chan []byte, within time.Duration) []byte {
	t.Helper()
	select {
	case data := <-ch:
		return data
	case <-time.After(within):
		t.Fatal("timed out waiting for SSE event")
		return nil
	}
}

func mustNotReceive(t *testing.T, ch <-chan []byte, within time.Duration) {
	t.Helper()
	select {
	case data := <-ch:
		t.Fatalf("unexpected SSE event received: %s", data)
	case <-time.After(within):
	}
}

func TestSSEHub_SubscribeUnsubscribe(t *testing.T) {
	hub := NewSSEHub()

	client := hub.Subscribe(1, store.RoleUser)
	require.NotNil(t, client)
	require.NotNil(t, client.events)

	// Unsubscribe removes the client and closes the channel.
	hub.Unsubscribe(client)

	// Channel should be closed.
	_, ok := <-client.events
	assert.False(t, ok, "channel should be closed after Unsubscribe")
	_, ok = <-client.done
	assert.False(t, ok, "done channel should be closed after Unsubscribe")
}

func TestSSEHub_Close(t *testing.T) {
	hub := NewSSEHub()
	c1 := hub.Subscribe(1, store.RoleUser)
	c2 := hub.Subscribe(2, store.RoleAdmin)

	hub.Close()
	hub.Close()

	for _, ch := range []chan []byte{c1.events, c2.events} {
		_, ok := <-ch
		assert.False(t, ok, "channel should be closed after hub close")
	}
	for _, ch := range []chan struct{}{c1.done, c2.done} {
		_, ok := <-ch
		assert.False(t, ok, "done channel should be closed after hub close")
	}

	late := hub.Subscribe(3, store.RoleUser)
	_, ok := <-late.events
	assert.False(t, ok, "late subscriber should be closed immediately")

	hub.Broadcast(&SSEEvent{Type: SSEEventMemoCreated, Name: "memos/123"})
	hub.Unsubscribe(c1)
	hub.Unsubscribe(late)
}

func TestSSEHub_Broadcast(t *testing.T) {
	hub := NewSSEHub()
	client := hub.Subscribe(1, store.RoleUser)
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
	c1 := hub.Subscribe(1, store.RoleUser)
	defer hub.Unsubscribe(c1)
	c2 := hub.Subscribe(2, store.RoleUser)
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
	e := &SSEEvent{Type: SSEEventMemoUpdated, Name: "memos/789", Parent: "memos/123"}
	data := e.JSON()
	require.NotEmpty(t, data)
	assert.Contains(t, string(data), `"type":"memo.updated"`)
	assert.Contains(t, string(data), `"name":"memos/789"`)
	assert.Contains(t, string(data), `"parent":"memos/123"`)
}

func TestSSEEvent_Frame(t *testing.T) {
	e := &SSEEvent{Type: SSEEventMemoUpdated, Name: "memos/789"}
	assert.Equal(t, "data: {\"type\":\"memo.updated\",\"name\":\"memos/789\"}\n\n", string(e.Frame()))
}

func TestSSEHub_PrivateEventsAreScoped(t *testing.T) {
	hub := NewSSEHub()
	owner := hub.Subscribe(1, store.RoleUser)
	defer hub.Unsubscribe(owner)
	other := hub.Subscribe(2, store.RoleUser)
	defer hub.Unsubscribe(other)
	admin := hub.Subscribe(3, store.RoleAdmin)
	defer hub.Unsubscribe(admin)

	hub.Broadcast(&SSEEvent{
		Type:       SSEEventMemoUpdated,
		Name:       "memos/private",
		Visibility: store.Private,
		CreatorID:  1,
	})

	select {
	case <-owner.events:
	case <-time.After(time.Second):
		t.Fatal("owner should receive private event")
	}

	select {
	case <-admin.events:
	case <-time.After(time.Second):
		t.Fatal("admin should receive private event")
	}

	select {
	case <-other.events:
		t.Fatal("non-owner should not receive private event")
	case <-time.After(100 * time.Millisecond):
	}
}

func TestSSEHub_UnknownVisibilityDenied(t *testing.T) {
	hub := NewSSEHub()
	client := hub.Subscribe(1, store.RoleUser)
	defer hub.Unsubscribe(client)

	// An event with an unrecognised visibility value should be denied (safe default).
	hub.Broadcast(&SSEEvent{
		Type:       SSEEventMemoUpdated,
		Name:       "memos/unknown-vis",
		Visibility: store.Visibility("CUSTOM"),
	})

	mustNotReceive(t, client.events, 100*time.Millisecond)
}

func TestSSEHub_SlowClientDisconnected(t *testing.T) {
	hub := NewSSEHub()
	// Subscribe but never read, so the channel fills up.
	slow := hub.Subscribe(1, store.RoleUser)
	defer hub.Unsubscribe(slow)

	event := &SSEEvent{Type: SSEEventMemoCreated, Name: "memos/x"}
	// Send more events than the buffer capacity.
	for range sseClientEventBufferSize + 8 {
		hub.Broadcast(event) // must not block
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

func TestSSEHub_ConcurrentAccess(t *testing.T) {
	hub := NewSSEHub()
	const (
		workers    = 16
		iterations = 100
	)

	var wg sync.WaitGroup
	for workerID := range workers {
		wg.Go(func() {
			for iteration := range iterations {
				client := hub.Subscribe(int32(workerID+1), store.RoleUser)
				hub.Broadcast(&SSEEvent{
					Type:       SSEEventMemoUpdated,
					Name:       fmt.Sprintf("memos/%d-%d", workerID, iteration),
					Visibility: store.Private,
					CreatorID:  int32(workerID + 1),
				})
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

func BenchmarkSSEHubBroadcast(b *testing.B) {
	for _, clientCount := range []int{100, 1_000, 10_000} {
		b.Run(fmt.Sprintf("public/%d", clientCount), func(b *testing.B) {
			hub, clients := newBenchmarkSSEHub(clientCount)
			defer hub.Close()
			event := &SSEEvent{Type: SSEEventMemoUpdated, Name: "memos/benchmark", Visibility: store.Public}

			b.ReportAllocs()
			b.ResetTimer()
			for b.Loop() {
				hub.Broadcast(event)
				for _, client := range clients {
					<-client.events
				}
			}
		})

		b.Run(fmt.Sprintf("private/%d", clientCount), func(b *testing.B) {
			hub, clients := newBenchmarkSSEHub(clientCount)
			defer hub.Close()
			event := &SSEEvent{
				Type:       SSEEventMemoUpdated,
				Name:       "memos/benchmark",
				Visibility: store.Private,
				CreatorID:  1,
			}

			b.ReportAllocs()
			b.ResetTimer()
			for b.Loop() {
				hub.Broadcast(event)
				<-clients[0].events
				<-clients[1].events
			}
		})
	}
}

func newBenchmarkSSEHub(clientCount int) (*SSEHub, []*SSEClient) {
	hub := NewSSEHub()
	clients := make([]*SSEClient, 0, clientCount)
	for i := range clientCount {
		role := store.RoleUser
		if i == 1 {
			role = store.RoleAdmin
		}
		clients = append(clients, hub.Subscribe(int32(i+1), role))
	}
	return hub, clients
}

func TestResolveSSECreatorID(t *testing.T) {
	tests := []struct {
		name       string
		memo       *store.Memo
		parentMemo *store.Memo
		want       int32
	}{
		{
			name: "nil memo returns 0",
			memo: nil, parentMemo: nil,
			want: 0,
		},
		{
			name:       "memo without parent returns memo CreatorID",
			memo:       &store.Memo{CreatorID: 5},
			parentMemo: nil,
			want:       5,
		},
		{
			name:       "memo with parent returns parent CreatorID",
			memo:       &store.Memo{CreatorID: 5},
			parentMemo: &store.Memo{CreatorID: 9},
			want:       9,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, resolveSSECreatorID(tc.memo, tc.parentMemo))
		})
	}
}

func TestBuildMemoReactionSSEEvent(t *testing.T) {
	parentUID := "parent-uid"

	t.Run("top-level memo reaction", func(t *testing.T) {
		memo := &store.Memo{CreatorID: 10, Visibility: store.Public}
		event := buildMemoReactionSSEEvent(SSEEventReactionUpserted, "memos/abc", memo, nil)
		assert.Equal(t, SSEEventReactionUpserted, event.Type)
		assert.Equal(t, "memos/abc", event.Name)
		assert.Equal(t, "", event.Parent)
		assert.Equal(t, store.Public, event.Visibility)
		assert.Equal(t, int32(10), event.CreatorID)
	})

	t.Run("reaction on comment is scoped to parent owner", func(t *testing.T) {
		memo := &store.Memo{
			CreatorID:  10,
			Visibility: store.Private,
			ParentUID:  &parentUID,
		}
		parentMemo := &store.Memo{CreatorID: 7}
		event := buildMemoReactionSSEEvent(SSEEventReactionDeleted, "memos/abc", memo, parentMemo)
		assert.Equal(t, SSEEventReactionDeleted, event.Type)
		assert.Equal(t, MemoNamePrefix+parentUID, event.Parent)
		assert.Equal(t, store.Private, event.Visibility)
		assert.Equal(t, int32(7), event.CreatorID)
	})

	t.Run("nil memo produces a safe zero-value event", func(t *testing.T) {
		event := buildMemoReactionSSEEvent(SSEEventReactionUpserted, "memos/abc", nil, nil)
		assert.Equal(t, "memos/abc", event.Name)
		assert.Equal(t, "", event.Parent)
		assert.Equal(t, store.Visibility(""), event.Visibility)
		assert.Equal(t, int32(0), event.CreatorID)
	})
}
