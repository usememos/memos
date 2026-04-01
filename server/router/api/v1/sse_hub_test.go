package v1

import (
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

func TestSSEClient_CanReceive_UnknownVisibility(t *testing.T) {
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

func TestSSEHub_SlowClientEventsDropped(t *testing.T) {
	hub := NewSSEHub()
	// Subscribe but never read, so the channel fills up.
	slow := hub.Subscribe(1, store.RoleUser)
	defer hub.Unsubscribe(slow)

	event := &SSEEvent{Type: SSEEventMemoCreated, Name: "memos/x"}
	// Send more events than the buffer capacity (32).
	for range 40 {
		hub.Broadcast(event) // must not block
	}

	// At most 32 events should have been queued; the rest were silently dropped.
	assert.LessOrEqual(t, len(slow.events), 32)
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
