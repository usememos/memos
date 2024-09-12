package teststore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"

	storepb "github.com/usememos/memos/proto/gen/store"
)

func TestMemoStore(t *testing.T) {
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
		CreatorID: &user.ID,
		VisibilityList: []store.Visibility{
			store.Public,
		},
	})
	require.NoError(t, err)
	require.Equal(t, 0, len(memoList))
	ts.Close()
}

func TestMemoListByTags(t *testing.T) {
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
			Property: &storepb.MemoPayload_Property{
				Tags: []string{"test_tag"},
			},
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
		PayloadFind: &store.FindMemoPayload{
			TagSearch: []string{"test_tag"},
		},
	})
	require.NoError(t, err)
	require.Equal(t, 1, len(memoList))
	require.Equal(t, memo, memoList[0])
	ts.Close()
}

func TestDeleteMemoStore(t *testing.T) {
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
