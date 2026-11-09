package test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/timestamppb"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestMemoListExcludesFutureHidden(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	create := func(uid string, hideUntil *timestamppb.Timestamp) *store.Memo {
		memo, err := ts.CreateMemo(ctx, &store.Memo{
			UID:        uid,
			CreatorID:  user.ID,
			Content:    uid,
			Visibility: store.Private,
			Payload:    &storepb.MemoPayload{HideUntil: hideUntil},
		})
		require.NoError(t, err)
		return memo
	}

	visible := create("visible", nil)
	past := create("past", timestamppb.New(time.Now().Add(-time.Hour)))
	future := create("future", timestamppb.New(time.Now().Add(time.Hour)))

	listed, err := ts.ListMemos(ctx, &store.FindMemo{ExcludeFutureHidden: true})
	require.NoError(t, err)
	require.Len(t, listed, 2)
	require.ElementsMatch(t, []string{visible.UID, past.UID}, []string{listed[0].UID, listed[1].UID})

	got, err := ts.GetMemo(ctx, &store.FindMemo{ID: &future.ID})
	require.NoError(t, err)
	require.NotNil(t, got, "direct reads must still find a future-hidden memo")
	require.Equal(t, future.UID, got.UID)
}
