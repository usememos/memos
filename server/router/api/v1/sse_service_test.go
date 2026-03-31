package v1

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/profile"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
	teststore "github.com/usememos/memos/store/test"
)

// newIntegrationService builds a minimal APIV1Service backed by an in-memory
// SQLite database.  The store is closed automatically via t.Cleanup.
func newIntegrationService(t *testing.T) *APIV1Service {
	t.Helper()
	ctx := context.Background()
	st := teststore.NewTestingStore(ctx, t)
	t.Cleanup(func() { st.Close() })
	p := &profile.Profile{Demo: true, Data: t.TempDir(), Driver: "sqlite", DSN: ":memory:"}
	return NewAPIV1Service("test-secret", p, st)
}

// userCtx returns a context that authenticates as the given user.
func userCtx(ctx context.Context, userID int32) context.Context {
	return context.WithValue(ctx, auth.UserIDContextKey, userID)
}

// collectEventsFor reads events from ch for the given duration and returns them.
func collectEventsFor(ch <-chan []byte, d time.Duration) []string {
	var out []string
	deadline := time.After(d)
	for {
		select {
		case data := <-ch:
			out = append(out, string(data))
		case <-deadline:
			return out
		}
	}
}

// ---- context suppression ----

func TestSuppressSSEContext(t *testing.T) {
	ctx := context.Background()

	t.Run("default context is not suppressed", func(t *testing.T) {
		assert.False(t, isSSESuppressed(ctx))
	})

	t.Run("withSuppressSSE marks context as suppressed", func(t *testing.T) {
		assert.True(t, isSSESuppressed(withSuppressSSE(ctx)))
	})

	t.Run("suppression does not bleed into parent context", func(t *testing.T) {
		suppressed := withSuppressSSE(ctx)
		_ = suppressed
		assert.False(t, isSSESuppressed(ctx))
	})
}

// ---- CreateMemoComment double-broadcast fix ----

func TestCreateMemoComment_NoDuplicateSSEBroadcast(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)

	// Create an admin so the store is initialised, then a regular commenter.
	author, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "author", Role: store.RoleAdmin, Email: "author@example.com",
	})
	require.NoError(t, err)
	commenter, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "commenter", Role: store.RoleUser, Email: "commenter@example.com",
	})
	require.NoError(t, err)

	authorCtx := userCtx(ctx, author.ID)
	commenterCtx := userCtx(ctx, commenter.ID)

	// Create a public memo so the commenter can react.
	parent, err := svc.CreateMemo(authorCtx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{Content: "parent memo", Visibility: v1pb.Visibility_PUBLIC},
	})
	require.NoError(t, err)

	// Subscribe after the parent memo is created so the memo.created event
	// for the parent does not pollute the assertion window.
	client := svc.SSEHub.Subscribe(author.ID, store.RoleAdmin)
	defer svc.SSEHub.Unsubscribe(client)

	// Create a comment.  Before the fix, this fired both memo.created (for the
	// comment memo) and memo.comment.created (for the parent).
	_, err = svc.CreateMemoComment(commenterCtx, &v1pb.CreateMemoCommentRequest{
		Name:    parent.Name,
		Comment: &v1pb.Memo{Content: "a comment", Visibility: v1pb.Visibility_PUBLIC},
	})
	require.NoError(t, err)

	// Give the synchronous broadcast a moment to land in the buffer, then
	// collect everything that arrived.
	events := collectEventsFor(client.events, 150*time.Millisecond)

	require.Len(t, events, 1, "expected exactly one SSE event for a comment creation, got: %v", events)
	assert.True(t, strings.Contains(events[0], `"memo.comment.created"`),
		"expected memo.comment.created, got: %s", events[0])
}

// ---- Reaction SSE events carry correct visibility / parent fields ----

func TestUpsertMemoReaction_SSEEvent(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)

	user, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "user", Role: store.RoleAdmin, Email: "user@example.com",
	})
	require.NoError(t, err)
	uctx := userCtx(ctx, user.ID)

	memo, err := svc.CreateMemo(uctx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{Content: "reacted memo", Visibility: v1pb.Visibility_PUBLIC},
	})
	require.NoError(t, err)

	client := svc.SSEHub.Subscribe(user.ID, store.RoleAdmin)
	defer svc.SSEHub.Unsubscribe(client)

	_, err = svc.UpsertMemoReaction(uctx, &v1pb.UpsertMemoReactionRequest{
		Name: memo.Name,
		Reaction: &v1pb.Reaction{
			ContentId:    memo.Name,
			ReactionType: "👍",
		},
	})
	require.NoError(t, err)

	data := mustReceive(t, client.events, time.Second)
	payload := string(data)
	assert.Contains(t, payload, `"reaction.upserted"`)
	assert.Contains(t, payload, memo.Name)
	mustNotReceive(t, client.events, 100*time.Millisecond)
}

func TestDeleteMemoReaction_SSEEvent(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)

	user, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "user", Role: store.RoleAdmin, Email: "user@example.com",
	})
	require.NoError(t, err)
	uctx := userCtx(ctx, user.ID)

	memo, err := svc.CreateMemo(uctx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{Content: "reacted memo", Visibility: v1pb.Visibility_PUBLIC},
	})
	require.NoError(t, err)

	reaction, err := svc.UpsertMemoReaction(uctx, &v1pb.UpsertMemoReactionRequest{
		Name: memo.Name,
		Reaction: &v1pb.Reaction{
			ContentId:    memo.Name,
			ReactionType: "❤️",
		},
	})
	require.NoError(t, err)

	client := svc.SSEHub.Subscribe(user.ID, store.RoleAdmin)
	defer svc.SSEHub.Unsubscribe(client)

	_, err = svc.DeleteMemoReaction(uctx, &v1pb.DeleteMemoReactionRequest{
		Name: reaction.Name,
	})
	require.NoError(t, err)

	data := mustReceive(t, client.events, time.Second)
	payload := string(data)
	assert.Contains(t, payload, `"reaction.deleted"`)
	assert.Contains(t, payload, memo.Name)
	mustNotReceive(t, client.events, 100*time.Millisecond)
}

func TestSetMemoAttachments_EmitsMemoUpdatedSSEEvent(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)

	user, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "user", Role: store.RoleAdmin, Email: "user@example.com",
	})
	require.NoError(t, err)
	uctx := userCtx(ctx, user.ID)

	memo, err := svc.CreateMemo(uctx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{Content: "memo with attachments", Visibility: v1pb.Visibility_PUBLIC},
	})
	require.NoError(t, err)

	attachment, err := svc.CreateAttachment(uctx, &v1pb.CreateAttachmentRequest{
		Attachment: &v1pb.Attachment{
			Filename: "test.txt",
			Size:     5,
			Type:     "text/plain",
			Content:  []byte("hello"),
		},
	})
	require.NoError(t, err)

	client := svc.SSEHub.Subscribe(user.ID, store.RoleAdmin)
	defer svc.SSEHub.Unsubscribe(client)

	_, err = svc.SetMemoAttachments(uctx, &v1pb.SetMemoAttachmentsRequest{
		Name: memo.Name,
		Attachments: []*v1pb.Attachment{
			{Name: attachment.Name},
		},
	})
	require.NoError(t, err)

	data := mustReceive(t, client.events, time.Second)
	payload := string(data)
	assert.Contains(t, payload, `"memo.updated"`)
	assert.Contains(t, payload, memo.Name)
	mustNotReceive(t, client.events, 100*time.Millisecond)
}

func TestSetMemoRelations_EmitsMemoUpdatedSSEEvent(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)

	user, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "user", Role: store.RoleAdmin, Email: "user@example.com",
	})
	require.NoError(t, err)
	uctx := userCtx(ctx, user.ID)

	memo1, err := svc.CreateMemo(uctx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{Content: "memo one", Visibility: v1pb.Visibility_PUBLIC},
	})
	require.NoError(t, err)
	memo2, err := svc.CreateMemo(uctx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{Content: "memo two", Visibility: v1pb.Visibility_PUBLIC},
	})
	require.NoError(t, err)

	client := svc.SSEHub.Subscribe(user.ID, store.RoleAdmin)
	defer svc.SSEHub.Unsubscribe(client)

	_, err = svc.SetMemoRelations(uctx, &v1pb.SetMemoRelationsRequest{
		Name: memo1.Name,
		Relations: []*v1pb.MemoRelation{
			{
				RelatedMemo: &v1pb.MemoRelation_Memo{Name: memo2.Name},
				Type:        v1pb.MemoRelation_REFERENCE,
			},
		},
	})
	require.NoError(t, err)

	data := mustReceive(t, client.events, time.Second)
	payload := string(data)
	assert.Contains(t, payload, `"memo.updated"`)
	assert.Contains(t, payload, memo1.Name)
	mustNotReceive(t, client.events, 100*time.Millisecond)
}
