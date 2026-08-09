package access

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestCheckMemoRead(t *testing.T) {
	owner := &store.User{ID: 1}
	other := &store.User{ID: 2, Role: store.RoleAdmin}
	public := &store.Memo{ID: 1, CreatorID: owner.ID, RowStatus: store.Normal, Visibility: store.Public}
	private := &store.Memo{ID: 2, CreatorID: owner.ID, RowStatus: store.Normal, Visibility: store.Private}

	require.Equal(t, MemoReadDecision{Class: MemoReadClassPublic}, CheckMemoRead(public, nil, nil, true, nil))
	require.Equal(t, MemoReadDenialUnauthenticated, CheckMemoRead(public, nil, nil, false, nil).Denial)
	require.Equal(t, MemoReadDecision{Class: MemoReadClassPrivate}, CheckMemoRead(private, nil, owner, true, nil))
	require.Equal(t, MemoReadDenialPermission, CheckMemoRead(private, nil, other, true, nil).Denial)

	shareID := private.ID
	require.Equal(t, MemoReadDecision{Class: MemoReadClassPrivate}, CheckMemoRead(private, nil, nil, false, &shareID))
}

func TestCheckMemoReadCommentRequiresParentAndRejectsShares(t *testing.T) {
	owner := &store.User{ID: 1}
	parentUID := "parent"
	comment := &store.Memo{ID: 2, CreatorID: owner.ID, RowStatus: store.Normal, Visibility: store.Public, ParentUID: &parentUID}
	parent := &store.Memo{ID: 1, CreatorID: owner.ID, RowStatus: store.Normal, Visibility: store.Private}

	require.Equal(t, MemoReadDenialUnauthenticated, CheckMemoRead(comment, parent, nil, true, nil).Denial)

	commentShareID := comment.ID
	require.Equal(t, MemoReadDenialUnauthenticated, CheckMemoRead(comment, parent, nil, true, &commentShareID).Denial)
	parentShareID := parent.ID
	require.Equal(t, MemoReadDenialUnauthenticated, CheckMemoRead(comment, parent, nil, true, &parentShareID).Denial)
	require.True(t, CheckMemoRead(comment, parent, owner, true, nil).Allowed())

	// Parent visibility is authoritative even if the denormalized comment value
	// has not been synchronized yet.
	comment.Visibility = store.Private
	parent.Visibility = store.Public
	require.Equal(t, MemoReadDecision{Class: MemoReadClassPublic}, CheckMemoRead(comment, parent, nil, true, nil))
}

func TestCheckMemoReadArchivedAndUnknownStateFailClosed(t *testing.T) {
	owner := &store.User{ID: 1}
	archived := &store.Memo{ID: 1, CreatorID: owner.ID, RowStatus: store.Archived, Visibility: store.Public}
	require.Equal(t, MemoReadDenialNotFound, CheckMemoRead(archived, nil, nil, true, nil).Denial)
	require.Equal(t, MemoReadDecision{Class: MemoReadClassPrivate}, CheckMemoRead(archived, nil, owner, true, nil))

	unknown := &store.Memo{ID: 2, CreatorID: owner.ID, RowStatus: store.RowStatus("UNKNOWN"), Visibility: store.Public}
	require.Equal(t, MemoReadDenialNotFound, CheckMemoRead(unknown, nil, owner, true, nil).Denial)
}
