package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// TestRefreshMemoDerivedPayload pins the guarded rebuild write: it replaces
// tags and property only while the content is unchanged, and keeps the
// location and updated_ts, so a background rebuild cannot undo an edit.
func TestRefreshMemoDerivedPayload(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	location := &storepb.MemoPayload_Location{Placeholder: "Harbour", Latitude: 1.5, Longitude: 2.5}
	memo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "payload-refresh",
		CreatorID:  user.ID,
		Content:    "Ünïcode ![sunset](https://example.com/s.jpg) #trip",
		Visibility: store.Private,
		// Fixed past timestamps, so a refresh that touched updated_ts within
		// the same second as the fixture could not go unnoticed.
		CreatedTs: 1700000000,
		UpdatedTs: 1700000100,
		Payload: &storepb.MemoPayload{
			Tags:     []string{"stale"},
			Property: &storepb.MemoPayload_Property{HasCode: true},
			Location: location,
		},
	})
	require.NoError(t, err)

	t.Run("matching content refreshes tags and property only", func(t *testing.T) {
		require.NoError(t, ts.RefreshMemoDerivedPayload(ctx, &store.RefreshMemoDerivedPayload{
			ID:       memo.ID,
			Content:  memo.Content,
			Tags:     []string{"trip"},
			Property: &storepb.MemoPayload_Property{HasInlineImage: true},
		}))
		got, err := ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
		require.NoError(t, err)
		require.Equal(t, []string{"trip"}, got.Payload.Tags)
		require.True(t, got.Payload.Property.HasInlineImage)
		require.False(t, got.Payload.Property.HasCode)
		require.Equal(t, location.Placeholder, got.Payload.Location.GetPlaceholder())
		require.InDelta(t, location.Latitude, got.Payload.Location.GetLatitude(), 1e-9)
		require.Equal(t, int64(1700000100), got.UpdatedTs)

		images, err := ts.ListMemos(ctx, &store.FindMemo{IDList: []int32{memo.ID}, Filters: []string{"has_image"}})
		require.NoError(t, err)
		require.Len(t, images, 1, "the refreshed flag must be visible to the filter")
	})

	t.Run("edited content is left alone", func(t *testing.T) {
		require.NoError(t, ts.RefreshMemoDerivedPayload(ctx, &store.RefreshMemoDerivedPayload{
			ID:       memo.ID,
			Content:  "ünïcode ![sunset](https://example.com/s.jpg) #trip",
			Tags:     []string{"wrong"},
			Property: &storepb.MemoPayload_Property{HasLink: true},
		}))
		got, err := ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
		require.NoError(t, err)
		require.Equal(t, []string{"trip"}, got.Payload.Tags, "a case-only difference must not match")
		require.False(t, got.Payload.Property.HasLink)
	})

	t.Run("empty tags and property clear the stored values", func(t *testing.T) {
		require.NoError(t, ts.RefreshMemoDerivedPayload(ctx, &store.RefreshMemoDerivedPayload{ID: memo.ID, Content: memo.Content}))
		got, err := ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
		require.NoError(t, err)
		require.Empty(t, got.Payload.Tags)
		require.False(t, got.Payload.GetProperty().GetHasInlineImage())
		require.Equal(t, location.Placeholder, got.Payload.Location.GetPlaceholder())
	})
}
