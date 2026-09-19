package store_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestMemoShareRejectsInvalidInputBeforeWriting(t *testing.T) {
	ts := &store.Store{} // Invalid input must be rejected before using a driver.
	for _, test := range []struct {
		name   string
		delete *store.DeleteMemoShare
	}{
		{"nil", nil},
		{"no selector", &store.DeleteMemoShare{}},
		{"memo only", &store.DeleteMemoShare{MemoID: new(int32(1))}},
		{"missing actor", &store.DeleteMemoShare{ID: new(int32(1)), MemoID: new(int32(1)), Policy: &store.MemoWritePolicy{}}},
		{"missing memo", &store.DeleteMemoShare{ID: new(int32(1)), Policy: &store.MemoWritePolicy{ActorUserID: 1}}},
		{"invalid memo", &store.DeleteMemoShare{ID: new(int32(1)), MemoID: new(int32(0)), Policy: &store.MemoWritePolicy{ActorUserID: 1}}},
		{"conflicting actions", &store.DeleteMemoShare{ID: new(int32(1)), MemoID: new(int32(1)), Policy: &store.MemoWritePolicy{
			ActorUserID: 1, LifecycleOnly: true, CreatingShare: true,
		}}},
	} {
		t.Run(test.name, func(t *testing.T) {
			require.Error(t, ts.DeleteMemoShare(context.Background(), test.delete))
		})
	}
	_, err := ts.CreateMemoShare(context.Background(), nil)
	require.Error(t, err)
	_, err = ts.CreateMemoShare(context.Background(), &store.MemoShare{Policy: &store.MemoWritePolicy{}})
	require.Error(t, err)
}
