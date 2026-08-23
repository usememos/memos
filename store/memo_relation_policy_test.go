package store_test

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestValidateMemoRelationEndpointReadDanglingPlacement(t *testing.T) {
	danglingSpaceID := int32(42)
	for _, visibility := range []store.Visibility{store.Public, store.Protected, store.Private} {
		t.Run(string(visibility), func(t *testing.T) {
			err := store.ValidateMemoRelationEndpointRead(&store.MemoRelationEndpointSnapshot{
				ActorUserID:          1,
				ActorActive:          true,
				EndpointID:           2,
				EndpointCreatorID:    1,
				EndpointRowStatus:    store.Normal,
				EndpointVisibility:   visibility,
				EndpointSpaceID:      &danglingSpaceID,
				EndpointSpaceExists:  false,
				EndpointMemberActive: false,
			})
			require.NoError(t, err, "a dangling placement must not override a non-Space audience")
		})
	}

	err := store.ValidateMemoRelationEndpointRead(&store.MemoRelationEndpointSnapshot{
		ActorUserID:          1,
		ActorActive:          true,
		EndpointID:           2,
		EndpointCreatorID:    2,
		EndpointRowStatus:    store.Normal,
		EndpointVisibility:   store.SpaceAudience,
		EndpointSpaceID:      &danglingSpaceID,
		EndpointSpaceExists:  false,
		EndpointMemberActive: true,
	})
	require.ErrorIs(t, err, store.ErrMemoMutationConflict, "a Space audience must fail closed when its placement is dangling")
}

func TestValidateMemoWriteSnapshotRejectsDanglingSourcePlacement(t *testing.T) {
	danglingSpaceID := int32(42)
	err := store.ValidateMemoWriteSnapshot(
		&store.MemoWritePolicy{ActorUserID: 1},
		nil,
		&store.MemoWriteSnapshot{
			CreatorID:         1,
			RowStatus:         store.Normal,
			SpaceID:           &danglingSpaceID,
			Visibility:        store.Public,
			SourceSpaceExists: false,
		},
	)
	require.ErrorIs(t, err, store.ErrMemoSpaceNotWritable)
}
