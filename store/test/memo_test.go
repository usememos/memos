package test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"

	storepb "github.com/usememos/memos/proto/gen/store"
)

func TestMemoStore(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	memoCreate := &store.Memo{
		UID:        "test-resource-name",
		CreatorID:  user.ID,
		Content:    "test_content",
		Visibility: store.Public,
	}
	memo, err := ts.CreateMemo(ctx, memoCreate)
	require.NoError(t, err)
	require.Equal(t, memoCreate.Content, memo.Content)
	memoPatchContent := "test_content_2"
	memoPatch := &store.UpdateMemo{
		ID:      memo.ID,
		Content: &memoPatchContent,
	}
	err = ts.UpdateMemo(ctx, memoPatch)
	require.NoError(t, err)
	memo, err = ts.GetMemo(ctx, &store.FindMemo{
		ID: &memo.ID,
	})
	require.NoError(t, err)
	require.NotNil(t, memo)
	memoList, err := ts.ListMemos(ctx, &store.FindMemo{
		CreatorID: &user.ID,
	})
	require.NoError(t, err)
	require.Equal(t, 1, len(memoList))
	require.Equal(t, memo, memoList[0])
	err = ts.DeleteMemo(ctx, &store.DeleteMemo{
		ID: memo.ID,
	})
	require.NoError(t, err)
	memoList, err = ts.ListMemos(ctx, &store.FindMemo{
		CreatorID: &user.ID,
	})
	require.NoError(t, err)
	require.Equal(t, 0, len(memoList))

	memoList, err = ts.ListMemos(ctx, &store.FindMemo{
		CreatorID:      &user.ID,
		VisibilityList: []store.Visibility{store.Public},
	})
	require.NoError(t, err)
	require.Equal(t, 0, len(memoList))
	ts.Close()
}

func TestMemoListByTags(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	memoCreate := &store.Memo{
		UID:        "test-resource-name",
		CreatorID:  user.ID,
		Content:    "test_content",
		Visibility: store.Public,
		Payload: &storepb.MemoPayload{
			Tags: []string{"test_tag"},
		},
	}
	memo, err := ts.CreateMemo(ctx, memoCreate)
	require.NoError(t, err)
	require.Equal(t, memoCreate.Content, memo.Content)
	memo, err = ts.GetMemo(ctx, &store.FindMemo{
		ID: &memo.ID,
	})
	require.NoError(t, err)
	require.NotNil(t, memo)

	memoList, err := ts.ListMemos(ctx, &store.FindMemo{
		Filters: []string{"tag in [\"test_tag\"]"},
	})
	require.NoError(t, err)
	require.Equal(t, 1, len(memoList))
	require.Equal(t, memo, memoList[0])
	ts.Close()
}

func TestDeleteMemoStore(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	memoCreate := &store.Memo{
		UID:        "test-resource-name",
		CreatorID:  user.ID,
		Content:    "test_content",
		Visibility: store.Public,
	}
	memo, err := ts.CreateMemo(ctx, memoCreate)
	require.NoError(t, err)
	require.Equal(t, memoCreate.Content, memo.Content)
	err = ts.DeleteMemo(ctx, &store.DeleteMemo{
		ID: memo.ID,
	})
	require.NoError(t, err)
	ts.Close()
}

func TestMemoGetByID(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	memo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "test-memo-1",
		CreatorID:  user.ID,
		Content:    "test content",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	// Get by ID
	found, err := ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
	require.NoError(t, err)
	require.NotNil(t, found)
	require.Equal(t, memo.ID, found.ID)
	require.Equal(t, memo.Content, found.Content)

	// Get non-existent
	nonExistentID := int32(99999)
	notFound, err := ts.GetMemo(ctx, &store.FindMemo{ID: &nonExistentID})
	require.NoError(t, err)
	require.Nil(t, notFound)

	ts.Close()
}

func TestMemoGetByUID(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	uid := "unique-memo-uid"
	memo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        uid,
		CreatorID:  user.ID,
		Content:    "test content",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	// Get by UID
	found, err := ts.GetMemo(ctx, &store.FindMemo{UID: &uid})
	require.NoError(t, err)
	require.NotNil(t, found)
	require.Equal(t, memo.UID, found.UID)

	// Get non-existent UID
	nonExistentUID := "non-existent-uid"
	notFound, err := ts.GetMemo(ctx, &store.FindMemo{UID: &nonExistentUID})
	require.NoError(t, err)
	require.Nil(t, notFound)

	ts.Close()
}

func TestMemoListByVisibility(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create memos with different visibilities
	_, err = ts.CreateMemo(ctx, &store.Memo{
		UID:        "public-memo",
		CreatorID:  user.ID,
		Content:    "public content",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	_, err = ts.CreateMemo(ctx, &store.Memo{
		UID:        "protected-memo",
		CreatorID:  user.ID,
		Content:    "protected content",
		Visibility: store.Protected,
	})
	require.NoError(t, err)

	_, err = ts.CreateMemo(ctx, &store.Memo{
		UID:        "private-memo",
		CreatorID:  user.ID,
		Content:    "private content",
		Visibility: store.Private,
	})
	require.NoError(t, err)

	// List public memos only
	publicMemos, err := ts.ListMemos(ctx, &store.FindMemo{
		VisibilityList: []store.Visibility{store.Public},
	})
	require.NoError(t, err)
	require.Equal(t, 1, len(publicMemos))
	require.Equal(t, store.Public, publicMemos[0].Visibility)

	// List protected memos only
	protectedMemos, err := ts.ListMemos(ctx, &store.FindMemo{
		VisibilityList: []store.Visibility{store.Protected},
	})
	require.NoError(t, err)
	require.Equal(t, 1, len(protectedMemos))
	require.Equal(t, store.Protected, protectedMemos[0].Visibility)

	// List public and protected (multiple visibility)
	publicAndProtected, err := ts.ListMemos(ctx, &store.FindMemo{
		VisibilityList: []store.Visibility{store.Public, store.Protected},
	})
	require.NoError(t, err)
	require.Equal(t, 2, len(publicAndProtected))

	// List all
	allMemos, err := ts.ListMemos(ctx, &store.FindMemo{})
	require.NoError(t, err)
	require.Equal(t, 3, len(allMemos))

	ts.Close()
}

func TestMemoListWithPagination(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create 10 memos
	for i := 0; i < 10; i++ {
		_, err := ts.CreateMemo(ctx, &store.Memo{
			UID:        fmt.Sprintf("memo-%d", i),
			CreatorID:  user.ID,
			Content:    fmt.Sprintf("content %d", i),
			Visibility: store.Public,
		})
		require.NoError(t, err)
	}

	// Test limit
	limit := 5
	limitedMemos, err := ts.ListMemos(ctx, &store.FindMemo{Limit: &limit})
	require.NoError(t, err)
	require.Equal(t, 5, len(limitedMemos))

	// Test offset
	offset := 3
	offsetMemos, err := ts.ListMemos(ctx, &store.FindMemo{Limit: &limit, Offset: &offset})
	require.NoError(t, err)
	require.Equal(t, 5, len(offsetMemos))

	// Verify offset works correctly (different memos)
	require.NotEqual(t, limitedMemos[0].ID, offsetMemos[0].ID)

	ts.Close()
}

func TestMemoUpdatePinned(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	memo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "pinnable-memo",
		CreatorID:  user.ID,
		Content:    "content",
		Visibility: store.Public,
	})
	require.NoError(t, err)
	require.False(t, memo.Pinned)

	// Pin the memo
	pinned := true
	err = ts.UpdateMemo(ctx, &store.UpdateMemo{
		ID:     memo.ID,
		Pinned: &pinned,
	})
	require.NoError(t, err)

	// Verify pinned
	found, err := ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
	require.NoError(t, err)
	require.True(t, found.Pinned)

	// Unpin
	unpinned := false
	err = ts.UpdateMemo(ctx, &store.UpdateMemo{
		ID:     memo.ID,
		Pinned: &unpinned,
	})
	require.NoError(t, err)

	found, err = ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
	require.NoError(t, err)
	require.False(t, found.Pinned)

	ts.Close()
}

func TestMemoUpdateVisibility(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	memo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "visibility-memo",
		CreatorID:  user.ID,
		Content:    "content",
		Visibility: store.Public,
	})
	require.NoError(t, err)
	require.Equal(t, store.Public, memo.Visibility)

	// Change to private
	privateVisibility := store.Private
	err = ts.UpdateMemo(ctx, &store.UpdateMemo{
		ID:         memo.ID,
		Visibility: &privateVisibility,
	})
	require.NoError(t, err)

	found, err := ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
	require.NoError(t, err)
	require.Equal(t, store.Private, found.Visibility)

	// Change to protected
	protectedVisibility := store.Protected
	err = ts.UpdateMemo(ctx, &store.UpdateMemo{
		ID:         memo.ID,
		Visibility: &protectedVisibility,
	})
	require.NoError(t, err)

	found, err = ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
	require.NoError(t, err)
	require.Equal(t, store.Protected, found.Visibility)

	ts.Close()
}

func TestMemoInvalidUID(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create memo with invalid UID (contains special characters)
	_, err = ts.CreateMemo(ctx, &store.Memo{
		UID:        "invalid uid with spaces",
		CreatorID:  user.ID,
		Content:    "content",
		Visibility: store.Public,
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "invalid uid")

	ts.Close()
}

func TestMemoCreateWithCustomTimestamps(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	customCreatedTs := int64(1700000000) // 2023-11-14 22:13:20 UTC
	customUpdatedTs := int64(1700000001)

	memo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "custom-timestamp-memo",
		CreatorID:  user.ID,
		Content:    "content with custom timestamps",
		Visibility: store.Public,
		CreatedTs:  customCreatedTs,
		UpdatedTs:  customUpdatedTs,
	})
	require.NoError(t, err)
	require.Equal(t, customCreatedTs, memo.CreatedTs)
	require.Equal(t, customUpdatedTs, memo.UpdatedTs)

	// Fetch and verify timestamps are preserved
	found, err := ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
	require.NoError(t, err)
	require.NotNil(t, found)
	require.Equal(t, customCreatedTs, found.CreatedTs)
	require.Equal(t, customUpdatedTs, found.UpdatedTs)

	ts.Close()
}

func TestMemoCreateWithOnlyCreatedTs(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	customCreatedTs := int64(1609459200) // 2021-01-01 00:00:00 UTC

	memo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "custom-created-ts-only",
		CreatorID:  user.ID,
		Content:    "content with custom created_ts only",
		Visibility: store.Public,
		CreatedTs:  customCreatedTs,
	})
	require.NoError(t, err)
	require.Equal(t, customCreatedTs, memo.CreatedTs)

	found, err := ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
	require.NoError(t, err)
	require.NotNil(t, found)
	require.Equal(t, customCreatedTs, found.CreatedTs)

	ts.Close()
}

func TestMemoWithPayload(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create memo with tags in payload
	tags := []string{"tag1", "tag2", "tag3"}
	memo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "memo-with-payload",
		CreatorID:  user.ID,
		Content:    "content with tags",
		Visibility: store.Public,
		Payload: &storepb.MemoPayload{
			Tags: tags,
		},
	})
	require.NoError(t, err)
	require.NotNil(t, memo.Payload)
	require.Equal(t, tags, memo.Payload.Tags)

	// Fetch and verify
	found, err := ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
	require.NoError(t, err)
	require.NotNil(t, found.Payload)
	require.Equal(t, tags, found.Payload.Tags)

	ts.Close()
}
