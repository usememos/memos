package test

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

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

func TestTransformMemoContentsIsAtomic(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	t.Run("persists all batches and scopes by creator", func(t *testing.T) {
		user, err := createTestingHostUser(ctx, ts)
		require.NoError(t, err)
		otherUser, err := ts.CreateUser(ctx, &store.User{
			Username: "transform-other-user",
			Role:     store.RoleUser,
		})
		require.NoError(t, err)

		first, err := ts.CreateMemo(ctx, &store.Memo{
			UID:        "transform-first",
			CreatorID:  user.ID,
			Content:    "first",
			Visibility: store.Private,
			Payload:    &storepb.MemoPayload{Tags: []string{"old"}},
			CreatedTs:  1,
		})
		require.NoError(t, err)
		second, err := ts.CreateMemo(ctx, &store.Memo{
			UID:        "transform-second",
			CreatorID:  user.ID,
			Content:    "second",
			Visibility: store.Private,
			Payload:    &storepb.MemoPayload{Tags: []string{"old"}},
			CreatedTs:  2,
		})
		require.NoError(t, err)
		otherMemo, err := ts.CreateMemo(ctx, &store.Memo{
			UID:        "transform-other-memo",
			CreatorID:  otherUser.ID,
			Content:    "other",
			Visibility: store.Private,
			Payload:    &storepb.MemoPayload{Tags: []string{"old"}},
		})
		require.NoError(t, err)

		updatedIDs, err := ts.TransformMemoContents(ctx, &store.TransformMemoContentsRequest{
			CreatorID: user.ID,
			BatchSize: 1,
			UpdatedTs: 100,
			Transform: func(memo *store.Memo) (bool, error) {
				memo.Content += " updated"
				memo.Payload.Tags = []string{"new"}
				return true, nil
			},
		})
		require.NoError(t, err)
		require.ElementsMatch(t, []int32{first.ID, second.ID}, updatedIDs)

		for _, memoID := range []int32{first.ID, second.ID} {
			memo, err := ts.GetMemo(ctx, &store.FindMemo{ID: &memoID})
			require.NoError(t, err)
			require.Contains(t, memo.Content, " updated")
			require.Equal(t, []string{"new"}, memo.Payload.Tags)
			require.Equal(t, int64(100), memo.UpdatedTs)
		}
		unchanged, err := ts.GetMemo(ctx, &store.FindMemo{ID: &otherMemo.ID})
		require.NoError(t, err)
		require.Equal(t, "other", unchanged.Content)
		require.Equal(t, []string{"old"}, unchanged.Payload.Tags)
	})

	t.Run("rolls back earlier batches when a later transform fails", func(t *testing.T) {
		user, err := ts.CreateUser(ctx, &store.User{
			Username: "transform-rollback-user",
			Role:     store.RoleUser,
		})
		require.NoError(t, err)

		first, err := ts.CreateMemo(ctx, &store.Memo{
			UID:        "rollback-first",
			CreatorID:  user.ID,
			Content:    "first original",
			Visibility: store.Private,
			CreatedTs:  1,
		})
		require.NoError(t, err)
		second, err := ts.CreateMemo(ctx, &store.Memo{
			UID:        "rollback-second",
			CreatorID:  user.ID,
			Content:    "second original",
			Visibility: store.Private,
			CreatedTs:  2,
		})
		require.NoError(t, err)

		transformErr := errors.New("transform failed")
		callCount := 0
		updatedIDs, err := ts.TransformMemoContents(ctx, &store.TransformMemoContentsRequest{
			CreatorID: user.ID,
			BatchSize: 1,
			UpdatedTs: 200,
			Transform: func(memo *store.Memo) (bool, error) {
				callCount++
				if callCount == 2 {
					return false, transformErr
				}
				memo.Content = "partially updated"
				return true, nil
			},
		})
		require.ErrorIs(t, err, transformErr)
		require.Nil(t, updatedIDs)

		for memoID, wantContent := range map[int32]string{
			first.ID:  "first original",
			second.ID: "second original",
		} {
			memo, err := ts.GetMemo(ctx, &store.FindMemo{ID: &memoID})
			require.NoError(t, err)
			require.Equal(t, wantContent, memo.Content)
		}
	})

	t.Run("does not overwrite a concurrent edit from a stale snapshot", func(t *testing.T) {
		user, err := ts.CreateUser(ctx, &store.User{
			Username: "transform-concurrent-user",
			Role:     store.RoleUser,
		})
		require.NoError(t, err)
		memo, err := ts.CreateMemo(ctx, &store.Memo{
			UID:        "transform-concurrent-memo",
			CreatorID:  user.ID,
			Content:    "original",
			Visibility: store.Private,
		})
		require.NoError(t, err)

		operationCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()
		transformRead := make(chan struct{})
		continueTransform := make(chan struct{})
		var transformReadOnce sync.Once
		type result struct {
			updatedIDs []int32
			err        error
		}
		transformDone := make(chan result, 1)
		go func() {
			updatedIDs, err := ts.TransformMemoContents(operationCtx, &store.TransformMemoContentsRequest{
				CreatorID: user.ID,
				BatchSize: 1,
				UpdatedTs: 300,
				Transform: func(current *store.Memo) (bool, error) {
					transformReadOnce.Do(func() { close(transformRead) })
					<-continueTransform
					current.Content = "renamed stale snapshot"
					return true, nil
				},
			})
			transformDone <- result{updatedIDs: updatedIDs, err: err}
		}()

		<-transformRead
		concurrentContent := "concurrent edit"
		updateDone := make(chan error, 1)
		go func() {
			updateDone <- ts.UpdateMemo(operationCtx, &store.UpdateMemo{ID: memo.ID, Content: &concurrentContent})
		}()

		// SQLite can let the writer commit against the transform's read snapshot,
		// while row-locking databases block it. Both outcomes are safe: the
		// transform must either conflict or commit before the newer edit.
		var updateErr error
		updateCompletedBeforeRelease := false
		select {
		case updateErr = <-updateDone:
			updateCompletedBeforeRelease = true
			t.Log("concurrent update completed before releasing the transform")
		case <-time.After(100 * time.Millisecond):
			t.Log("concurrent update remained pending until the transform was released")
		}
		close(continueTransform)

		transformResult := <-transformDone
		if !updateCompletedBeforeRelease {
			updateErr = <-updateDone
		}
		require.NoError(t, updateErr)
		if updateCompletedBeforeRelease {
			require.Error(t, transformResult.err, "a transform based on an older snapshot must not overwrite the committed edit")
		} else if transformResult.err == nil {
			require.Equal(t, []int32{memo.ID}, transformResult.updatedIDs)
		}

		stored, err := ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
		require.NoError(t, err)
		require.Equal(t, concurrentContent, stored.Content)
	})
}
