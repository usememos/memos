package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestMemoTimestampUpdates(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	originalCreate, originalUpdate := int64(1577836800), int64(1577840400)
	created, updated := originalCreate-86400, originalUpdate-86400

	for _, tc := range []struct {
		name       string
		patch      *store.UpdateMemo
		wantCreate int64
		wantUpdate int64
	}{
		{"creation-only", &store.UpdateMemo{CreatedTs: &created}, created, originalUpdate},
		{"modification-only", &store.UpdateMemo{UpdatedTs: &updated}, originalCreate, updated},
		{"both", &store.UpdateMemo{CreatedTs: &created, UpdatedTs: &updated}, created, updated},
		{"unrelated-update", &store.UpdateMemo{Content: new("changed")}, originalCreate, originalUpdate},
	} {
		t.Run(tc.name, func(t *testing.T) {
			memo, err := ts.CreateMemo(ctx, &store.Memo{
				UID: tc.name, CreatorID: user.ID, Content: "original", Visibility: store.Private,
				CreatedTs: originalCreate, UpdatedTs: originalUpdate,
			})
			require.NoError(t, err)
			tc.patch.ID = memo.ID
			require.NoError(t, ts.UpdateMemo(ctx, tc.patch))
			got, err := ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
			require.NoError(t, err)
			require.NotNil(t, got)
			require.Equal(t, tc.wantCreate, got.CreatedTs)
			require.Equal(t, tc.wantUpdate, got.UpdatedTs)
			if tc.patch.Content != nil {
				require.Equal(t, *tc.patch.Content, got.Content)
			}
		})
	}
}
