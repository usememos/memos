package test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestMemoAccessScopeUsesEachMemoAudience(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "access-local-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	viewer, err := ts.CreateUser(ctx, &store.User{Username: "access-local-viewer", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)

	privateContext, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "access-private-context", CreatorID: owner.ID, Content: "private context", Visibility: store.Private,
	})
	require.NoError(t, err)
	publicComment, err := ts.CreateMemoComment(ctx, &store.Memo{
		UID: "access-public-comment", CreatorID: owner.ID, Content: "public comment", Visibility: store.Public,
	}, privateContext.ID, owner.ID)
	require.NoError(t, err)
	publicContext, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "access-public-context", CreatorID: owner.ID, Content: "public context", Visibility: store.Public,
	})
	require.NoError(t, err)
	privateComment, err := ts.CreateMemoComment(ctx, &store.Memo{
		UID: "access-private-comment", CreatorID: owner.ID, Content: "private comment", Visibility: store.Private,
	}, publicContext.ID, owner.ID)
	require.NoError(t, err)

	visible, err := ts.ListMemos(ctx, &store.FindMemo{
		Access: &store.MemoAccessScope{UserID: &viewer.ID, AllowPublic: true, AllowProtected: true},
	})
	require.NoError(t, err)
	require.ElementsMatch(t, []int32{publicComment.ID, publicContext.ID}, memoIDs(visible),
		"COMMENT relations must neither grant nor restrict memo-local read access")

	commentsForPrivateContext, err := ts.ListMemos(ctx, &store.FindMemo{
		CommentContextMemoID: &privateContext.ID,
		Access:               &store.MemoAccessScope{UserID: &viewer.ID, AllowPublic: true, AllowProtected: true},
	})
	require.NoError(t, err)
	require.Equal(t, []int32{publicComment.ID}, memoIDs(commentsForPrivateContext),
		"a readable comment may be returned even when its context memo is not readable")

	nonComments, err := ts.ListMemos(ctx, &store.FindMemo{
		ExcludeComments: true,
		Access:          &store.MemoAccessScope{UserID: &viewer.ID, AllowPublic: true, AllowProtected: true},
	})
	require.NoError(t, err)
	require.Equal(t, []int32{publicContext.ID}, memoIDs(nonComments), "ordinary feeds exclude memos with COMMENT context")

	ownerRows, err := ts.ListMemos(ctx, &store.FindMemo{
		Access: &store.MemoAccessScope{UserID: &owner.ID, AllowPublic: true, AllowProtected: true},
	})
	require.NoError(t, err)
	require.ElementsMatch(t, []int32{privateContext.ID, publicComment.ID, publicContext.ID, privateComment.ID}, memoIDs(ownerRows))
}

func TestMemoAccessScopeUsesAudienceForInvalidLocalPlacement(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "access-invalid-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	memo, err := ts.CreateMemo(ctx, &store.Memo{UID: "access-invalid-memo", CreatorID: owner.ID, Content: "memo", Visibility: store.Public})
	require.NoError(t, err)

	_, err = ts.GetDriver().GetDB().ExecContext(ctx, fmt.Sprintf("UPDATE memo SET space_id = 2147483000 WHERE id = %d", memo.ID))
	require.NoError(t, err)
	visible, err := ts.ListMemos(ctx, &store.FindMemo{
		Access: &store.MemoAccessScope{UserID: &owner.ID, AllowPublic: true, AllowProtected: true},
	})
	require.NoError(t, err)
	require.Equal(t, []int32{memo.ID}, memoIDs(visible), "a dangling placement must not override a non-Space audience")

	_, err = ts.GetDriver().GetDB().ExecContext(ctx, fmt.Sprintf("UPDATE memo SET space_id = NULL, visibility = 'SPACE' WHERE id = %d", memo.ID))
	require.NoError(t, err)
	visible, err = ts.ListMemos(ctx, &store.FindMemo{
		Access: &store.MemoAccessScope{UserID: &owner.ID, AllowPublic: true, AllowProtected: true},
	})
	require.NoError(t, err)
	require.Empty(t, visible, "SPACE without placement fails closed even for the author")
}

func TestMemoAccessScopeSpaceAudienceHasNoAuthorBypass(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	author, err := ts.CreateUser(ctx, &store.User{Username: "access-removed-author", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	admin, err := ts.CreateUser(ctx, &store.User{Username: "access-remaining-admin", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	space, err := ts.CreateSpace(ctx, &store.Space{UID: "access-author-space", Title: "Author access"}, author.ID)
	require.NoError(t, err)
	_, err = ts.CreateSpaceMember(ctx, &store.SpaceMember{SpaceID: space.ID, UserID: admin.ID, Role: store.SpaceMemberRoleAdmin}, author.ID)
	require.NoError(t, err)

	membersMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "access-author-members", CreatorID: author.ID, Content: "members", Visibility: store.SpaceAudience, SpaceID: &space.ID,
	})
	require.NoError(t, err)
	privateMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "access-author-private", CreatorID: author.ID, Content: "private", Visibility: store.Private, SpaceID: &space.ID,
	})
	require.NoError(t, err)
	require.NoError(t, ts.DeleteSpaceMember(ctx, &store.DeleteSpaceMember{SpaceID: space.ID, UserID: author.ID}, admin.ID))

	authorRows, err := ts.ListMemos(ctx, &store.FindMemo{
		Access: &store.MemoAccessScope{UserID: &author.ID, AllowPublic: true, AllowProtected: true},
	})
	require.NoError(t, err)
	require.Equal(t, []int32{privateMemo.ID}, memoIDs(authorRows), "PRIVATE remains author-readable, but SPACE requires current membership")

	adminRows, err := ts.ListMemos(ctx, &store.FindMemo{
		Access: &store.MemoAccessScope{UserID: &admin.ID, AllowPublic: true, AllowProtected: true},
	})
	require.NoError(t, err)
	require.Equal(t, []int32{membersMemo.ID}, memoIDs(adminRows), "membership reads SPACE but does not expand PRIVATE")
}

func TestMemoAccessScopeArchivedRowsRemainAuthorOnly(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "access-archive-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	viewer, err := ts.CreateUser(ctx, &store.User{Username: "access-archive-viewer", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	memo, err := ts.CreateMemo(ctx, &store.Memo{UID: "access-archive-memo", CreatorID: owner.ID, Content: "memo", Visibility: store.Public})
	require.NoError(t, err)
	archived := store.Archived
	require.NoError(t, ts.UpdateMemo(ctx, &store.UpdateMemo{ID: memo.ID, RowStatus: &archived}))

	ownerRows, err := ts.ListMemos(ctx, &store.FindMemo{
		RowStatus: &archived,
		Access:    &store.MemoAccessScope{UserID: &owner.ID, AllowPublic: true, AllowProtected: true},
	})
	require.NoError(t, err)
	require.Equal(t, []int32{memo.ID}, memoIDs(ownerRows))
	viewerRows, err := ts.ListMemos(ctx, &store.FindMemo{
		RowStatus: &archived,
		Access:    &store.MemoAccessScope{UserID: &viewer.ID, AllowPublic: true, AllowProtected: true},
	})
	require.NoError(t, err)
	require.Empty(t, viewerRows)
	anonymousRows, err := ts.ListMemos(ctx, &store.FindMemo{RowStatus: &archived, Access: &store.MemoAccessScope{AllowPublic: true}})
	require.NoError(t, err)
	require.Empty(t, anonymousRows)
}

func TestMemoAccessScopeAllowsArchivedCreatorButFiltersMissingCreatorBeforePagination(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	archivedCreator, err := ts.CreateUser(ctx, &store.User{Username: "access-archived-creator", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	viewer, err := ts.CreateUser(ctx, &store.User{Username: "access-creator-viewer", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	publicMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "access-archived-creator-public", CreatorID: archivedCreator.ID, Content: "public", Visibility: store.Public,
	})
	require.NoError(t, err)
	protectedMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "access-archived-creator-protected", CreatorID: archivedCreator.ID, Content: "protected", Visibility: store.Protected,
	})
	require.NoError(t, err)
	archived := store.Archived
	_, err = ts.UpdateUser(ctx, &store.UpdateUser{ID: archivedCreator.ID, RowStatus: &archived})
	require.NoError(t, err)

	visible, err := ts.ListMemos(ctx, &store.FindMemo{
		Access: &store.MemoAccessScope{UserID: &viewer.ID, AllowPublic: true, AllowProtected: true},
	})
	require.NoError(t, err)
	require.ElementsMatch(t, []int32{publicMemo.ID, protectedMemo.ID}, memoIDs(visible),
		"archiving a creator does not change the audience of their active memos")

	missingCreatorMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "access-missing-creator", CreatorID: viewer.ID, Content: "corrupt", Visibility: store.Public,
	})
	require.NoError(t, err)
	_, err = ts.GetDriver().GetDB().ExecContext(ctx,
		fmt.Sprintf("UPDATE memo SET creator_id = 2147483000 WHERE id = %d", missingCreatorMemo.ID))
	require.NoError(t, err)

	limit := 2
	visible, err = ts.ListMemos(ctx, &store.FindMemo{
		Access: &store.MemoAccessScope{UserID: &viewer.ID, AllowPublic: true, AllowProtected: true},
		Limit:  &limit,
	})
	require.NoError(t, err)
	require.Len(t, visible, 2)
	require.ElementsMatch(t, []int32{publicMemo.ID, protectedMemo.ID}, memoIDs(visible),
		"a newer dangling-creator row must be removed before LIMIT is applied")
}

func memoIDs(memos []*store.Memo) []int32 {
	ids := make([]int32, 0, len(memos))
	for _, memo := range memos {
		ids = append(ids, memo.ID)
	}
	return ids
}
