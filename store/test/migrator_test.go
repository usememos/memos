package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestGetCurrentSchemaVersion(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	currentSchemaVersion, err := ts.GetCurrentSchemaVersion()
	require.NoError(t, err)
	require.Equal(t, "0.25.1", currentSchemaVersion)
}

func TestTagNormalization(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	// Create a user first.
	user, err := ts.CreateUser(ctx, &store.User{
		Username: "test_tag_user",
		Role:     store.RoleUser,
		Email:    "tagtest@example.com",
		Nickname: "Tag Test User",
	})
	require.NoError(t, err)

	// Create memos with mixed-case tags.
	memo1, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "test-memo-1",
		CreatorID:  user.ID,
		Content:    "Test memo with #House tag",
		Visibility: store.Private,
		Payload: &storepb.MemoPayload{
			Tags: []string{"House", "IMPORTANT", "work"},
		},
	})
	require.NoError(t, err)

	memo2, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "test-memo-2",
		CreatorID:  user.ID,
		Content:    "Test memo with #house tag (already lowercase)",
		Visibility: store.Private,
		Payload: &storepb.MemoPayload{
			Tags: []string{"house", "important"},
		},
	})
	require.NoError(t, err)

	// Verify original tags.
	memos, err := ts.ListMemos(ctx, &store.FindMemo{ID: &memo1.ID})
	require.NoError(t, err)
	require.Len(t, memos, 1)
	require.Contains(t, memos[0].Payload.Tags, "House")
	require.Contains(t, memos[0].Payload.Tags, "IMPORTANT")

	// memo2 was already lowercase, should remain unchanged.
	memos2, err := ts.ListMemos(ctx, &store.FindMemo{ID: &memo2.ID})
	require.NoError(t, err)
	require.Len(t, memos2, 1)
	require.Contains(t, memos2[0].Payload.Tags, "house")
	require.Contains(t, memos2[0].Payload.Tags, "important")
}
