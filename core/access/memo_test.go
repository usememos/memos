package access

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestCheckMemoReadMemoLocalAudiences(t *testing.T) {
	owner := &store.User{ID: 1, RowStatus: store.Normal}
	other := &store.User{ID: 2, RowStatus: store.Normal, Role: store.RoleUser}
	public := &store.Memo{ID: 1, CreatorID: owner.ID, RowStatus: store.Normal, Visibility: store.Public}
	protected := &store.Memo{ID: 2, CreatorID: owner.ID, RowStatus: store.Normal, Visibility: store.Protected}
	private := &store.Memo{ID: 3, CreatorID: owner.ID, RowStatus: store.Normal, Visibility: store.Private}

	require.Equal(t, MemoReadDecision{Class: MemoReadClassPublic}, CheckMemoReadContext(MemoReadContext{Memo: public, AllowAnonymous: true, CreatorValid: true, SpaceValid: true}))
	require.Equal(t, MemoReadDenialUnauthenticated, CheckMemoReadContext(MemoReadContext{Memo: public, CreatorValid: true, SpaceValid: true}).Denial)
	require.True(t, CheckMemoReadContext(MemoReadContext{Memo: protected, Viewer: other, CreatorValid: true, SpaceValid: true}).Allowed())
	require.True(t, CheckMemoReadContext(MemoReadContext{Memo: private, Viewer: owner, CreatorValid: true, SpaceValid: true}).Allowed())
	require.Equal(t, MemoReadDenialPermission, CheckMemoReadContext(MemoReadContext{Memo: private, Viewer: other, CreatorValid: true, SpaceValid: true}).Denial)

	shareID := private.ID
	require.True(t, CheckMemoReadContext(MemoReadContext{Memo: private, SharedMemoID: &shareID, CreatorValid: true, SpaceValid: true}).Allowed())
}

func TestCheckMemoReadCommentDoesNotInheritContext(t *testing.T) {
	const ownerID int32 = 1
	parentUID := "context-memo"
	comment := &store.Memo{
		ID:         2,
		CreatorID:  ownerID,
		RowStatus:  store.Normal,
		Visibility: store.Public,
		ParentUID:  &parentUID,
	}

	require.Equal(t, MemoReadDecision{Class: MemoReadClassPublic}, CheckMemoReadContext(MemoReadContext{Memo: comment, AllowAnonymous: true, CreatorValid: true, SpaceValid: true}))
	comment.Visibility = store.Private
	require.Equal(t, MemoReadDenialUnauthenticated, CheckMemoReadContext(MemoReadContext{Memo: comment, AllowAnonymous: true, CreatorValid: true, SpaceValid: true}).Denial)

	shareID := comment.ID
	require.True(t, CheckMemoReadContext(MemoReadContext{Memo: comment, SharedMemoID: &shareID, CreatorValid: true, SpaceValid: true}).Allowed())
}

func TestCheckMemoReadSpaceAudience(t *testing.T) {
	owner := &store.User{ID: 1, RowStatus: store.Normal}
	member := &store.User{ID: 2, RowStatus: store.Normal}
	appAdmin := &store.User{ID: 3, RowStatus: store.Normal, Role: store.RoleAdmin}
	spaceID := int32(7)
	memo := &store.Memo{ID: 10, CreatorID: owner.ID, RowStatus: store.Normal, Visibility: store.SpaceAudience, SpaceID: &spaceID}

	base := MemoReadContext{Memo: memo, CreatorValid: true, SpaceValid: true}
	require.Equal(t, MemoReadDenialUnauthenticated, CheckMemoReadContext(base).Denial)

	base.Viewer = owner
	require.Equal(t, MemoReadDenialPermission, CheckMemoReadContext(base).Denial)

	base.ViewerSpaceMember = true
	require.True(t, CheckMemoReadContext(base).Allowed())

	base.Viewer = member
	base.ViewerSpaceMember = true
	require.True(t, CheckMemoReadContext(base).Allowed())

	base.Viewer = appAdmin
	base.ViewerSpaceMember = false
	require.True(t, CheckMemoReadContext(base).Allowed(), "an instance administrator reads any memo by name")

	shareID := memo.ID
	base.Viewer = nil
	base.SharedMemoID = &shareID
	require.Equal(t, MemoReadDenialUnauthenticated, CheckMemoReadContext(base).Denial)

	memo.SpaceID = nil
	base.Viewer = member
	base.ViewerSpaceMember = true
	require.Equal(t, MemoReadDenialNotFound, CheckMemoReadContext(base).Denial)
}

func TestInstanceAdminIsMemoSuperuser(t *testing.T) {
	owner := &store.User{ID: 1, RowStatus: store.Normal, Role: store.RoleUser}
	admin := &store.User{ID: 2, RowStatus: store.Normal, Role: store.RoleAdmin}
	archivedAdmin := &store.User{ID: 3, RowStatus: store.Archived, Role: store.RoleAdmin}
	spaceID := int32(7)

	private := &store.Memo{ID: 1, CreatorID: owner.ID, RowStatus: store.Normal, Visibility: store.Private}
	archived := &store.Memo{ID: 2, CreatorID: owner.ID, RowStatus: store.Archived, Visibility: store.Public}
	spaceMemo := &store.Memo{ID: 3, CreatorID: owner.ID, RowStatus: store.Normal, Visibility: store.SpaceAudience, SpaceID: &spaceID}
	for _, memo := range []*store.Memo{private, archived, spaceMemo} {
		require.Equal(t, MemoReadDecision{Class: MemoReadClassPrivate}, CheckMemoReadContext(MemoReadContext{
			Memo: memo, Viewer: admin, CreatorValid: true, SpaceValid: true,
		}), "admin reads memo %d by name", memo.ID)
		require.False(t, CheckMemoReadContext(MemoReadContext{
			Memo: memo, Viewer: archivedAdmin, CreatorValid: true, SpaceValid: true,
		}).Allowed(), "an archived administrator holds no privilege")
		require.True(t, CanManageMemo(admin, memo))
		require.False(t, CanManageMemo(archivedAdmin, memo))
	}

	// Structural validity still applies.
	require.Equal(t, MemoReadDenialNotFound, CheckMemoReadContext(MemoReadContext{
		Memo: spaceMemo, Viewer: admin, CreatorValid: true, SpaceValid: false,
	}).Denial, "a dangling SPACE placement is not readable, even by an administrator")
	require.Equal(t, MemoReadDenialNotFound, CheckMemoReadContext(MemoReadContext{
		Memo: private, Viewer: admin, CreatorValid: false, SpaceValid: true,
	}).Denial)

	require.True(t, CanManageMemo(owner, private))
	require.False(t, CanManageMemo(&store.User{ID: 4, RowStatus: store.Normal, Role: store.RoleUser}, private))
	attachment := &store.Attachment{ID: 1, CreatorID: owner.ID}
	require.True(t, CanManageAttachment(owner, attachment))
	require.True(t, CanManageAttachment(admin, attachment))
	require.False(t, CanManageAttachment(archivedAdmin, attachment))
}

func TestCheckMemoReadInvalidStateFailsClosed(t *testing.T) {
	owner := &store.User{ID: 1, RowStatus: store.Normal}
	spaceID := int32(7)
	memo := &store.Memo{ID: 10, CreatorID: owner.ID, RowStatus: store.Normal, Visibility: store.Public, SpaceID: &spaceID}

	require.Equal(t, MemoReadDecision{Class: MemoReadClassPublic}, CheckMemoReadContext(MemoReadContext{
		Memo: memo, Viewer: owner, AllowAnonymous: true, CreatorValid: true, SpaceValid: false,
	}), "a dangling placement does not override a non-Space audience")
	memo.Visibility = store.Protected
	require.True(t, CheckMemoReadContext(MemoReadContext{
		Memo: memo, Viewer: owner, CreatorValid: true, SpaceValid: false,
	}).Allowed(), "PROTECTED remains readable through its own audience")
	memo.Visibility = store.Private
	require.True(t, CheckMemoReadContext(MemoReadContext{
		Memo: memo, Viewer: owner, CreatorValid: true, SpaceValid: false,
	}).Allowed(), "PRIVATE remains readable by its active author")
	memo.Visibility = store.SpaceAudience
	require.Equal(t, MemoReadDenialNotFound, CheckMemoReadContext(MemoReadContext{
		Memo: memo, Viewer: owner, CreatorValid: true, SpaceValid: false, ViewerSpaceMember: true,
	}).Denial, "SPACE depends on a valid assigned Space")

	memo.SpaceID = nil
	memo.Visibility = store.Visibility("FUTURE_AUDIENCE")
	shareID := memo.ID
	require.Equal(t, MemoReadDenialNotFound, CheckMemoReadContext(MemoReadContext{
		Memo: memo, Viewer: owner, AllowAnonymous: true, SharedMemoID: &shareID, CreatorValid: true, SpaceValid: true,
	}).Denial)

	memo.Visibility = store.Public
	memo.RowStatus = store.Archived
	require.True(t, CheckMemoReadContext(MemoReadContext{Memo: memo, Viewer: owner, CreatorValid: true, SpaceValid: true}).Allowed())
	require.Equal(t, MemoReadDenialNotFound, CheckMemoReadContext(MemoReadContext{Memo: memo, AllowAnonymous: true, CreatorValid: true, SpaceValid: true}).Denial)
	memo.Visibility = store.SpaceAudience
	memo.SpaceID = &spaceID
	require.Equal(t, MemoReadDenialPermission, CheckMemoReadContext(MemoReadContext{
		Memo: memo, Viewer: owner, CreatorValid: true, SpaceValid: true,
	}).Denial, "an archived SPACE memo still requires active membership")
	require.True(t, CheckMemoReadContext(MemoReadContext{
		Memo: memo, Viewer: owner, CreatorValid: true, SpaceValid: true, ViewerSpaceMember: true,
	}).Allowed())

	memo.RowStatus = store.RowStatus("UNKNOWN")
	require.Equal(t, MemoReadDenialNotFound, CheckMemoReadContext(MemoReadContext{Memo: memo, Viewer: owner, CreatorValid: true, SpaceValid: true}).Denial)

	memo.RowStatus = store.Normal
	memo.Visibility = store.Public
	memo.SpaceID = nil
	require.Equal(t, MemoReadDenialNotFound, CheckMemoReadContext(MemoReadContext{
		Memo: memo, Viewer: owner, AllowAnonymous: true, SpaceValid: true,
	}).Denial, "a missing or invalid creator fails closed before audience evaluation")
}

func TestCheckMemoReadAssignedPublicHasNoMembershipGate(t *testing.T) {
	owner := &store.User{ID: 1}
	other := &store.User{ID: 2, RowStatus: store.Normal}
	spaceID := int32(7)
	assigned := &store.Memo{ID: 10, CreatorID: owner.ID, RowStatus: store.Normal, Visibility: store.Public, SpaceID: &spaceID}

	require.Equal(t, MemoReadDecision{Class: MemoReadClassPublic}, CheckMemoReadContext(MemoReadContext{
		Memo: assigned, AllowAnonymous: true, CreatorValid: true, SpaceValid: true,
	}))
	require.True(t, CheckMemoReadContext(MemoReadContext{
		Memo: assigned, Viewer: other, CreatorValid: true, SpaceValid: true,
	}).Allowed(), "placement does not add a read gate to PUBLIC memos")
}
