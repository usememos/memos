package access

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

// fakeMemoListStore implements MemoReadStore and MemoListStore over maps while
// counting single-row versus batch calls.
type fakeMemoListStore struct {
	users   map[int32]*store.User
	spaces  map[int32]*store.Space
	members []*store.SpaceMember

	listSpacesCalls       int
	listSpaceMembersCalls int
	getUserCalls          int
	getSpaceCalls         int
	getSpaceMemberCalls   int
	listSpacesIDLists     [][]int32
	listSpacesErr         error
}

func (f *fakeMemoListStore) GetUser(_ context.Context, find *store.FindUser) (*store.User, error) {
	f.getUserCalls++
	if find == nil || find.ID == nil {
		return nil, nil
	}
	return f.users[*find.ID], nil
}

func (f *fakeMemoListStore) GetSpace(_ context.Context, find *store.FindSpace) (*store.Space, error) {
	f.getSpaceCalls++
	if find == nil || find.ID == nil {
		return nil, nil
	}
	return f.spaces[*find.ID], nil
}

func (f *fakeMemoListStore) GetSpaceMember(_ context.Context, find *store.FindSpaceMember) (*store.SpaceMember, error) {
	f.getSpaceMemberCalls++
	for _, member := range f.members {
		if member == nil {
			continue
		}
		if find != nil && find.SpaceID != nil && member.SpaceID != *find.SpaceID {
			continue
		}
		if find != nil && find.UserID != nil && member.UserID != *find.UserID {
			continue
		}
		return member, nil
	}
	return nil, nil
}

func (f *fakeMemoListStore) ListSpaces(_ context.Context, find *store.FindSpace) ([]*store.Space, error) {
	f.listSpacesCalls++
	if f.listSpacesErr != nil {
		return nil, f.listSpacesErr
	}
	if find == nil || find.IDList == nil {
		out := make([]*store.Space, 0, len(f.spaces))
		for _, space := range f.spaces {
			out = append(out, space)
		}
		return out, nil
	}
	f.listSpacesIDLists = append(f.listSpacesIDLists, append([]int32(nil), find.IDList...))
	out := make([]*store.Space, 0, len(find.IDList))
	for _, id := range find.IDList {
		if space, ok := f.spaces[id]; ok {
			out = append(out, space)
		}
	}
	return out, nil
}

func (f *fakeMemoListStore) ListSpaceMembers(_ context.Context, find *store.FindSpaceMember) ([]*store.SpaceMember, error) {
	f.listSpaceMembersCalls++
	out := []*store.SpaceMember{}
	for _, member := range f.members {
		if member == nil {
			continue
		}
		if find != nil && find.SpaceID != nil && member.SpaceID != *find.SpaceID {
			continue
		}
		if find != nil && find.UserID != nil && member.UserID != *find.UserID {
			continue
		}
		out = append(out, member)
	}
	return out, nil
}

func preloadTestStore() *fakeMemoListStore {
	return &fakeMemoListStore{
		users: map[int32]*store.User{
			1: {ID: 1, RowStatus: store.Normal, Role: store.RoleUser},
			2: {ID: 2, RowStatus: store.Normal, Role: store.RoleUser},
			3: {ID: 3, RowStatus: store.Normal, Role: store.RoleAdmin},
			4: {ID: 4, RowStatus: store.Archived, Role: store.RoleUser},
		},
		spaces: map[int32]*store.Space{
			7: {ID: 7, UID: "space-seven"},
			8: {ID: 8, UID: "space-eight"},
		},
		members: []*store.SpaceMember{
			{SpaceID: 7, UserID: 2, Role: store.SpaceMemberRoleUser},
		},
	}
}

func TestPreloadMemoList(t *testing.T) {
	ctx := context.Background()
	spaceSeven := int32(7)
	spaceEight := int32(8)

	t.Run("empty list performs no store calls", func(t *testing.T) {
		s := preloadTestStore()
		preload, err := PreloadMemoList(ctx, s, nil, s.users[2])
		require.NoError(t, err)
		require.Empty(t, preload.SpaceByID)
		require.Empty(t, preload.ViewerMemberBySpace)
		require.Zero(t, s.listSpacesCalls)
		require.Zero(t, s.listSpaceMembersCalls)
	})

	t.Run("unassigned memos perform no store calls", func(t *testing.T) {
		s := preloadTestStore()
		memos := []*store.Memo{
			{ID: 1, CreatorID: 1, Visibility: store.Public},
			{ID: 2, CreatorID: 1, Visibility: store.Private},
		}
		preload, err := PreloadMemoList(ctx, s, memos, s.users[2])
		require.NoError(t, err)
		require.Empty(t, preload.SpaceByID)
		require.Zero(t, s.listSpacesCalls)
		require.Zero(t, s.listSpaceMembersCalls)
	})

	t.Run("shared spaces load once with deduped IDs", func(t *testing.T) {
		s := preloadTestStore()
		memos := []*store.Memo{
			{ID: 1, CreatorID: 1, Visibility: store.Public, SpaceID: &spaceSeven},
			{ID: 2, CreatorID: 1, Visibility: store.Public, SpaceID: &spaceSeven},
			{ID: 3, CreatorID: 1, Visibility: store.Public, SpaceID: &spaceEight},
			{ID: 4, CreatorID: 1, Visibility: store.Public},
		}
		preload, err := PreloadMemoList(ctx, s, memos, s.users[2])
		require.NoError(t, err)
		require.Equal(t, 1, s.listSpacesCalls)
		require.ElementsMatch(t, []int32{spaceSeven, spaceEight}, s.listSpacesIDLists[0])
		require.Len(t, preload.SpaceByID, 2)
		require.Equal(t, 1, s.listSpaceMembersCalls)
		require.True(t, preload.ViewerMemberBySpace[spaceSeven])
		require.False(t, preload.ViewerMemberBySpace[spaceEight])
	})

	t.Run("nil viewer skips member lookup", func(t *testing.T) {
		s := preloadTestStore()
		memos := []*store.Memo{
			{ID: 1, CreatorID: 1, Visibility: store.Public, SpaceID: &spaceSeven},
		}
		preload, err := PreloadMemoList(ctx, s, memos, nil)
		require.NoError(t, err)
		require.Nil(t, preload.Viewer)
		require.Len(t, preload.SpaceByID, 1)
		require.Zero(t, s.listSpaceMembersCalls)
	})

	t.Run("admin viewer skips member lookup", func(t *testing.T) {
		s := preloadTestStore()
		memos := []*store.Memo{
			{ID: 1, CreatorID: 1, Visibility: store.Public, SpaceID: &spaceSeven},
		}
		preload, err := PreloadMemoList(ctx, s, memos, s.users[3])
		require.NoError(t, err)
		require.NotNil(t, preload.Viewer)
		require.Equal(t, 1, s.listSpacesCalls)
		require.Zero(t, s.listSpaceMembersCalls)
	})

	t.Run("inactive viewer skips member lookup", func(t *testing.T) {
		s := preloadTestStore()
		memos := []*store.Memo{
			{ID: 1, CreatorID: 1, Visibility: store.Public, SpaceID: &spaceSeven},
		}
		preload, err := PreloadMemoList(ctx, s, memos, s.users[4])
		require.NoError(t, err)
		require.NotNil(t, preload.Viewer)
		require.Equal(t, 1, s.listSpacesCalls)
		require.Zero(t, s.listSpaceMembersCalls)
	})

	t.Run("space error aborts the preload", func(t *testing.T) {
		s := preloadTestStore()
		s.listSpacesErr = context.DeadlineExceeded
		memos := []*store.Memo{
			{ID: 1, CreatorID: 1, Visibility: store.Public, SpaceID: &spaceSeven},
		}
		_, err := PreloadMemoList(ctx, s, memos, s.users[2])
		require.Error(t, err)
	})
}

func TestPreloadMemoListReadContextParity(t *testing.T) {
	ctx := context.Background()
	spaceSeven := int32(7)
	danglingSpace := int32(77)
	s := preloadTestStore()
	creatorMap := map[int32]*store.User{
		1: s.users[1],
		2: s.users[2],
		4: s.users[4],
	}

	newMemo := func(creatorID int32, visibility store.Visibility, spaceID *int32) *store.Memo {
		return &store.Memo{ID: 10, CreatorID: creatorID, RowStatus: store.Normal, Visibility: visibility, SpaceID: spaceID}
	}
	assigned := newMemo(1, store.Public, &spaceSeven)
	spaceMemo := newMemo(1, store.SpaceAudience, &spaceSeven)
	danglingSpaceMemo := newMemo(1, store.SpaceAudience, &danglingSpace)
	danglingPublic := newMemo(1, store.Public, &danglingSpace)
	missingCreator := newMemo(999, store.Public, &spaceSeven)
	archivedCreator := newMemo(4, store.Public, &spaceSeven)
	unassigned := newMemo(1, store.Public, nil)

	cases := []struct {
		name           string
		memo           *store.Memo
		viewer         *store.User
		allowAnonymous bool
	}{
		{"nil memo anonymous", nil, nil, true},
		{"unassigned anonymous", unassigned, nil, true},
		{"unassigned author", newMemo(1, store.Private, nil), s.users[1], false},
		{"assigned anonymous", assigned, nil, true},
		{"assigned nonmember", assigned, s.users[1], false},
		{"assigned member", assigned, s.users[2], false},
		{"assigned admin", assigned, s.users[3], false},
		{"assigned inactive", assigned, s.users[4], false},
		{"space audience member", spaceMemo, s.users[2], false},
		{"space audience nonmember", spaceMemo, s.users[1], false},
		{"dangling space audience", danglingSpaceMemo, s.users[2], false},
		{"dangling public", danglingPublic, s.users[2], false},
		{"missing creator", missingCreator, s.users[2], false},
		{"archived creator stays valid", archivedCreator, s.users[2], false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var memos []*store.Memo
			if tc.memo != nil {
				memos = []*store.Memo{tc.memo}
			}
			preload, err := PreloadMemoList(ctx, s, memos, tc.viewer)
			require.NoError(t, err)
			got := preload.ReadContextFor(tc.memo, creatorMap, tc.allowAnonymous, nil)
			want, err := ResolveMemoReadContext(ctx, s, tc.memo, tc.viewer, tc.allowAnonymous, nil)
			require.NoError(t, err)
			require.Equal(t, want, got)
		})
	}

	require.True(t, func() bool {
		preload, err := PreloadMemoList(ctx, s, []*store.Memo{archivedCreator}, s.users[2])
		require.NoError(t, err)
		return preload.ReadContextFor(archivedCreator, creatorMap, false, nil).CreatorValid
	}(), "archived creator keeps CreatorValid like the per-memo path")
	require.False(t, func() bool {
		preload, err := PreloadMemoList(ctx, s, []*store.Memo{missingCreator}, s.users[2])
		require.NoError(t, err)
		return preload.ReadContextFor(missingCreator, creatorMap, false, nil).CreatorValid
	}(), "missing creator clears CreatorValid like the per-memo path")
}
