package v1

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/core/access"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

// TestConvertMemoSpaceProjectionParity locks the batched space projection used
// by the list loops to the per-memo behavior: the same viewer/membership
// combinations project the same Space placement, dangling placements omit for
// PUBLIC/PRIVATE and error for SPACE, and unassigned memos project nothing.
func TestConvertMemoSpaceProjectionParity(t *testing.T) {
	spaceSeven := int32(7)
	danglingSpace := int32(77)
	spaceRow := &store.Space{ID: spaceSeven, UID: "space-seven"}

	author := &store.User{ID: 1, RowStatus: store.Normal, Role: store.RoleUser}
	member := &store.User{ID: 2, RowStatus: store.Normal, Role: store.RoleUser}
	nonmember := &store.User{ID: 5, RowStatus: store.Normal, Role: store.RoleUser}
	admin := &store.User{ID: 3, RowStatus: store.Normal, Role: store.RoleAdmin}
	inactive := &store.User{ID: 4, RowStatus: store.Archived, Role: store.RoleUser}
	creatorMap := map[int32]*store.User{1: author}

	newMemo := func(visibility store.Visibility, spaceID *int32) *store.Memo {
		return &store.Memo{ID: 10, CreatorID: author.ID, RowStatus: store.Normal, Visibility: visibility, SpaceID: spaceID}
	}

	// preloadFor simulates one PreloadMemoList result: spaces holds the rows a
	// ListSpaces call returned, member marks whether the viewer holds an
	// active membership in spaceSeven.
	preloadFor := func(viewer *store.User, spaces map[int32]*store.Space, member bool) *access.MemoListPreload {
		members := map[int32]bool{}
		if member {
			members[spaceSeven] = true
		}
		return &access.MemoListPreload{SpaceByID: spaces, ViewerMemberBySpace: members, Viewer: viewer}
	}

	cases := []struct {
		name      string
		memo      *store.Memo
		preload   *access.MemoListPreload
		wantSpace *string
		wantErr   string
	}{
		{
			name:      "author sees placement",
			memo:      newMemo(store.Public, &spaceSeven),
			preload:   preloadFor(author, map[int32]*store.Space{spaceSeven: spaceRow}, false),
			wantSpace: ptr("spaces/space-seven"),
		},
		{
			name:      "member sees placement",
			memo:      newMemo(store.Public, &spaceSeven),
			preload:   preloadFor(member, map[int32]*store.Space{spaceSeven: spaceRow}, true),
			wantSpace: ptr("spaces/space-seven"),
		},
		{
			name:    "nonmember learns nothing about placement",
			memo:    newMemo(store.Public, &spaceSeven),
			preload: preloadFor(nonmember, map[int32]*store.Space{spaceSeven: spaceRow}, false),
		},
		{
			name:      "admin sees placement",
			memo:      newMemo(store.Public, &spaceSeven),
			preload:   preloadFor(admin, map[int32]*store.Space{spaceSeven: spaceRow}, false),
			wantSpace: ptr("spaces/space-seven"),
		},
		{
			name:    "anonymous learns nothing about placement",
			memo:    newMemo(store.Public, &spaceSeven),
			preload: preloadFor(nil, map[int32]*store.Space{spaceSeven: spaceRow}, false),
		},
		{
			name:    "inactive member learns nothing about placement",
			memo:    newMemo(store.Public, &spaceSeven),
			preload: preloadFor(inactive, map[int32]*store.Space{spaceSeven: spaceRow}, false),
		},
		{
			name:      "member sees space audience placement",
			memo:      newMemo(store.SpaceAudience, &spaceSeven),
			preload:   preloadFor(member, map[int32]*store.Space{spaceSeven: spaceRow}, true),
			wantSpace: ptr("spaces/space-seven"),
		},
		{
			name:    "nonmember space audience omits placement",
			memo:    newMemo(store.SpaceAudience, &spaceSeven),
			preload: preloadFor(nonmember, map[int32]*store.Space{spaceSeven: spaceRow}, false),
		},
		{
			name:    "dangling space audience errors",
			memo:    newMemo(store.SpaceAudience, &danglingSpace),
			preload: preloadFor(member, map[int32]*store.Space{}, false),
			wantErr: "memo has invalid space placement",
		},
		{
			name:    "dangling public omits placement",
			memo:    newMemo(store.Public, &danglingSpace),
			preload: preloadFor(member, map[int32]*store.Space{}, false),
		},
		{
			name:    "dangling private omits placement",
			memo:    newMemo(store.Private, &danglingSpace),
			preload: preloadFor(author, map[int32]*store.Space{}, false),
		},
		{
			name:    "unassigned memo projects nothing",
			memo:    newMemo(store.Public, nil),
			preload: preloadFor(member, map[int32]*store.Space{}, false),
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			readContext := tc.preload.ReadContextFor(tc.memo, creatorMap, true, nil)
			message := &v1pb.Memo{}
			var space *store.Space
			if tc.memo.SpaceID != nil {
				space = tc.preload.SpaceByID[*tc.memo.SpaceID]
			}
			err := projectMemoSpaceFromPreload(tc.memo, message, readContext, space)
			if tc.wantErr != "" {
				require.ErrorContains(t, err, tc.wantErr)
				return
			}
			require.NoError(t, err)
			if tc.wantSpace == nil {
				require.Nil(t, message.Space)
			} else {
				require.NotNil(t, message.Space)
				require.Equal(t, *tc.wantSpace, *message.Space)
			}
		})
	}
}

func ptr(s string) *string {
	return &s
}
