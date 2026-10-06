package test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestDeleteMemoWithPolicyDeletesOnlyTargetAndIncidentResources(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	contextAuthor, err := ts.CreateUser(ctx, &store.User{Username: "delete-context-author", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	commentAuthor, err := ts.CreateUser(ctx, &store.User{Username: "delete-comment-author", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	replyAuthor, err := ts.CreateUser(ctx, &store.User{Username: "delete-reply-author", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)

	contextMemo, err := ts.CreateMemo(ctx, &store.Memo{UID: "delete-context", CreatorID: contextAuthor.ID, Content: "context", Visibility: store.Public})
	require.NoError(t, err)
	comment, err := ts.CreateMemoComment(ctx, &store.Memo{UID: "delete-comment", CreatorID: commentAuthor.ID, Content: "comment", Visibility: store.Protected}, contextMemo.ID, commentAuthor.ID)
	require.NoError(t, err)
	reply, err := ts.CreateMemoComment(ctx, &store.Memo{UID: "delete-reply", CreatorID: replyAuthor.ID, Content: "reply", Visibility: store.Public}, comment.ID, replyAuthor.ID)
	require.NoError(t, err)

	attachment, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID: "delete-comment-attachment", CreatorID: commentAuthor.ID, Filename: "comment.txt", Type: "text/plain", Size: 1, Blob: []byte("x"), MemoID: &comment.ID,
	})
	require.NoError(t, err)
	reaction, err := ts.UpsertReaction(ctx, &store.Reaction{CreatorID: contextAuthor.ID, MemoID: comment.ID, ReactionType: "heart"})
	require.NoError(t, err)
	share, err := ts.CreateMemoShare(ctx, &store.MemoShare{UID: "delete-comment-share", MemoID: comment.ID, CreatorID: commentAuthor.ID})
	require.NoError(t, err)
	inbox, err := ts.CreateInbox(ctx, &store.Inbox{
		SenderID: commentAuthor.ID, ReceiverID: contextAuthor.ID, Status: store.UNREAD,
		Message: &storepb.InboxMessage{
			Type: storepb.InboxMessage_MEMO_COMMENT,
			Payload: &storepb.InboxMessage_MemoComment{MemoComment: &storepb.InboxMessage_MemoCommentPayload{
				MemoId: comment.ID, RelatedMemoId: contextMemo.ID,
			}},
		},
	})
	require.NoError(t, err)

	_, err = ts.DeleteMemoWithPolicy(ctx, &store.DeleteMemoWithPolicy{MemoID: comment.ID, ActorUserID: replyAuthor.ID})
	require.ErrorIs(t, err, store.ErrMemoPermissionDenied)

	result, err := ts.DeleteMemoWithPolicy(ctx, &store.DeleteMemoWithPolicy{MemoID: comment.ID, ActorUserID: commentAuthor.ID})
	require.NoError(t, err)
	require.True(t, result.ActorCanRead)

	deleted, err := ts.GetMemo(ctx, &store.FindMemo{ID: &comment.ID})
	require.NoError(t, err)
	require.Nil(t, deleted)
	deletedReply, err := ts.GetMemo(ctx, &store.FindMemo{ID: &reply.ID})
	require.NoError(t, err)
	require.Nil(t, deletedReply, "a reply is part of the deleted memo's comment subtree")
	survivor, err := ts.GetMemo(ctx, &store.FindMemo{ID: &contextMemo.ID})
	require.NoError(t, err)
	require.NotNil(t, survivor)

	gotAttachment, err := ts.GetAttachment(ctx, &store.FindAttachment{ID: &attachment.ID})
	require.NoError(t, err)
	require.Nil(t, gotAttachment)
	gotReaction, err := ts.GetReaction(ctx, &store.FindReaction{ID: &reaction.ID})
	require.NoError(t, err)
	require.Nil(t, gotReaction)
	gotShare, err := ts.GetMemoShare(ctx, &store.FindMemoShare{ID: &share.ID})
	require.NoError(t, err)
	require.Nil(t, gotShare)
	gotInboxes, err := ts.ListInboxes(ctx, &store.FindInbox{ID: &inbox.ID})
	require.NoError(t, err)
	require.Len(t, gotInboxes, 1, "Memo deletion must not control the independent inbox lifecycle")

	incident, err := ts.ListMemoRelations(ctx, &store.FindMemoRelation{MemoIDList: []int32{comment.ID}})
	require.NoError(t, err)
	require.Empty(t, incident)
	replyRelations, err := ts.ListMemoRelations(ctx, &store.FindMemoRelation{MemoID: &reply.ID})
	require.NoError(t, err)
	require.Empty(t, replyRelations, "the deleted reply's context relation is removed with it")
}

func TestDeleteMemoWithPolicyDeletesWholeCommentSubtree(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	author, err := ts.CreateUser(ctx, &store.User{Username: "delete-subtree-author", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	commenter, err := ts.CreateUser(ctx, &store.User{Username: "delete-subtree-commenter", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)

	parent, err := ts.CreateMemo(ctx, &store.Memo{UID: "delete-subtree-parent", CreatorID: author.ID, Content: "parent", Visibility: store.Public})
	require.NoError(t, err)
	comment, err := ts.CreateMemoComment(ctx, &store.Memo{UID: "delete-subtree-comment", CreatorID: commenter.ID, Content: "comment", Visibility: store.Public}, parent.ID, commenter.ID)
	require.NoError(t, err)
	reply, err := ts.CreateMemoComment(ctx, &store.Memo{UID: "delete-subtree-reply", CreatorID: author.ID, Content: "reply", Visibility: store.Public}, comment.ID, author.ID)
	require.NoError(t, err)
	unrelated, err := ts.CreateMemo(ctx, &store.Memo{UID: "delete-subtree-unrelated", CreatorID: commenter.ID, Content: "unrelated", Visibility: store.Public})
	require.NoError(t, err)

	result, err := ts.DeleteMemoWithPolicy(ctx, &store.DeleteMemoWithPolicy{MemoID: parent.ID, ActorUserID: author.ID})
	require.NoError(t, err)
	require.True(t, result.ActorCanRead)

	for _, deletedID := range []int32{parent.ID, comment.ID, reply.ID} {
		deleted, err := ts.GetMemo(ctx, &store.FindMemo{ID: &deletedID})
		require.NoError(t, err)
		require.Nil(t, deleted, "memo %d should be deleted with the parent", deletedID)
	}
	survivor, err := ts.GetMemo(ctx, &store.FindMemo{ID: &unrelated.ID})
	require.NoError(t, err)
	require.NotNil(t, survivor)

	remaining, err := ts.ListMemos(ctx, &store.FindMemo{CreatorID: &commenter.ID, ExcludeComments: true})
	require.NoError(t, err)
	for _, memo := range remaining {
		require.NotEqual(t, comment.ID, memo.ID, "a deleted comment must not resurface as a top-level memo")
	}
}

type memoDeleteRaceFixture struct {
	store                  *store.Store
	owner, commenter       *store.User
	parent, comment, reply *store.Memo
}

func newMemoDeleteRaceFixture(t *testing.T) *memoDeleteRaceFixture {
	t.Helper()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	t.Cleanup(func() { require.NoError(t, ts.Close()) })
	owner, err := ts.CreateUser(ctx, &store.User{Username: "delete-race-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	commenter, err := ts.CreateUser(ctx, &store.User{Username: "delete-race-commenter", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	parent, err := ts.CreateMemo(ctx, &store.Memo{UID: "delete-race-parent", CreatorID: owner.ID, Content: "parent", Visibility: store.Public})
	require.NoError(t, err)
	comment, err := ts.CreateMemoComment(ctx, &store.Memo{UID: "delete-race-comment", CreatorID: commenter.ID, Content: "comment", Visibility: store.Public}, parent.ID, commenter.ID)
	require.NoError(t, err)
	reply, err := ts.CreateMemoComment(ctx, &store.Memo{UID: "delete-race-reply", CreatorID: owner.ID, Content: "reply", Visibility: store.Public}, comment.ID, owner.ID)
	require.NoError(t, err)
	return &memoDeleteRaceFixture{store: ts, owner: owner, commenter: commenter, parent: parent, comment: comment, reply: reply}
}

func TestDeleteMemoWithPolicyBlocksNewRepliesDuringSubtreeDeletion(t *testing.T) {
	driver := getDriverFromEnv()
	if driver == "sqlite" || driver == "d1" {
		t.Skip("SQLite serializes writes with IMMEDIATE transactions; D1 has no row locks")
	}

	fixture := newMemoDeleteRaceFixture(t)
	ts, owner, commenter := fixture.store, fixture.owner, fixture.commenter
	parent, comment, reply := fixture.parent, fixture.comment, fixture.reply
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	share, err := ts.CreateMemoShare(ctx, &store.MemoShare{UID: "delete-race-share", MemoID: parent.ID, CreatorID: owner.ID})
	require.NoError(t, err)

	// Hold share cleanup so deletion keeps the whole subtree locked while a
	// writer tries to add a reply to its deepest memo.
	blocker, err := ts.GetDriver().GetDB().BeginTx(ctx, nil)
	require.NoError(t, err)
	blockerOpen := true
	defer func() {
		if blockerOpen {
			_ = blocker.Rollback()
		}
	}()
	query := "SELECT id FROM memo_share WHERE id = ? FOR UPDATE"
	if driver == "postgres" {
		query = "SELECT id FROM memo_share WHERE id = $1 FOR UPDATE"
	}
	var shareID int32
	require.NoError(t, blocker.QueryRowContext(ctx, query, share.ID).Scan(&shareID))

	deleteDone := make(chan error, 1)
	go func() {
		_, deleteErr := ts.DeleteMemoWithPolicy(ctx, &store.DeleteMemoWithPolicy{MemoID: parent.ID, ActorUserID: owner.ID})
		deleteDone <- deleteErr
	}()
	select {
	case deleteErr := <-deleteDone:
		require.FailNowf(t, "deletion ended before locking the subtree", "error: %v", deleteErr)
	case <-time.After(100 * time.Millisecond):
	}
	for _, memoID := range []int32{parent.ID, comment.ID, reply.ID} {
		waitForLockedParentRow(ctx, t, ts.GetDriver().GetDB(), driver, "memo", memoID)
		require.NoError(t, ctx.Err())
	}

	lateCtx, lateCancel := context.WithTimeout(ctx, 300*time.Millisecond)
	started := time.Now()
	_, createErr := ts.CreateMemoComment(lateCtx, &store.Memo{UID: "delete-race-late-reply", CreatorID: commenter.ID, Content: "late reply", Visibility: store.Public}, reply.ID, commenter.ID)
	lateCancel()
	require.Error(t, createErr)
	require.GreaterOrEqual(t, time.Since(started), 250*time.Millisecond, "reply creation must wait for subtree deletion: %v", createErr)

	require.NoError(t, blocker.Commit())
	blockerOpen = false
	select {
	case deleteErr := <-deleteDone:
		require.NoError(t, deleteErr)
	case <-ctx.Done():
		require.FailNow(t, "timed out waiting for memo deletion")
	}
	for _, uid := range []string{parent.UID, comment.UID, reply.UID, "delete-race-late-reply"} {
		memo, err := ts.GetMemo(ctx, &store.FindMemo{UID: &uid})
		require.NoError(t, err)
		require.Nil(t, memo, "memo %s must not survive subtree deletion", uid)
	}
}

func TestDeleteMemoWithPolicyIncludesReplyCommittedWhileWaitingForSubtree(t *testing.T) {
	driver := getDriverFromEnv()
	if driver == "sqlite" || driver == "d1" {
		t.Skip("SQLite serializes writes with IMMEDIATE transactions; D1 has no row locks")
	}

	fixture := newMemoDeleteRaceFixture(t)
	ts, owner, commenter := fixture.store, fixture.owner, fixture.commenter
	parent, comment, reply := fixture.parent, fixture.comment, fixture.reply
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	attachment, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID: "delete-race-attachment", CreatorID: commenter.ID, Filename: "late.txt", Type: "text/plain", Blob: []byte("x"),
	})
	require.NoError(t, err)

	// Pause reply creation after it locks the context memo but before it commits.
	blocker, err := ts.GetDriver().GetDB().BeginTx(ctx, nil)
	require.NoError(t, err)
	blockerOpen := true
	defer func() {
		if blockerOpen {
			_ = blocker.Rollback()
		}
	}()
	query := "SELECT id FROM attachment WHERE id = ? FOR UPDATE"
	if driver == "postgres" {
		query = "SELECT id FROM attachment WHERE id = $1 FOR UPDATE"
	}
	var attachmentID int32
	require.NoError(t, blocker.QueryRowContext(ctx, query, attachment.ID).Scan(&attachmentID))

	late := &store.Memo{UID: "delete-race-committed-reply", CreatorID: commenter.ID, Content: "late reply", Visibility: store.Public}
	createDone := make(chan error, 1)
	go func() {
		createDone <- ts.ApplyMemoMutation(ctx, &store.MemoMutation{
			MemoCreate: late, CommentContextMemoID: &reply.ID,
			Bindings:              []*store.MemoAttachmentBinding{{ID: attachment.ID, UID: attachment.UID, UpdatedTs: time.Now().Unix()}},
			RequiredAttachmentIDs: []int32{attachment.ID},
		})
	}()
	waitForLockedParentRow(ctx, t, ts.GetDriver().GetDB(), driver, "memo", reply.ID)
	require.NoError(t, ctx.Err())

	deleteDone := make(chan error, 1)
	go func() {
		_, deleteErr := ts.DeleteMemoWithPolicy(ctx, &store.DeleteMemoWithPolicy{MemoID: parent.ID, ActorUserID: owner.ID})
		deleteDone <- deleteErr
	}()
	for _, memoID := range []int32{parent.ID, comment.ID} {
		waitForLockedParentRow(ctx, t, ts.GetDriver().GetDB(), driver, "memo", memoID)
		require.NoError(t, ctx.Err())
	}
	select {
	case deleteErr := <-deleteDone:
		require.FailNowf(t, "deletion ended before reply creation committed", "error: %v", deleteErr)
	default:
	}

	require.NoError(t, blocker.Commit())
	blockerOpen = false
	select {
	case createErr := <-createDone:
		require.NoError(t, createErr)
	case <-ctx.Done():
		require.FailNow(t, "timed out waiting for reply creation")
	}
	select {
	case deleteErr := <-deleteDone:
		require.NoError(t, deleteErr)
	case <-ctx.Done():
		require.FailNow(t, "timed out waiting for memo deletion")
	}
	for _, uid := range []string{parent.UID, comment.UID, reply.UID, late.UID} {
		memo, err := ts.GetMemo(ctx, &store.FindMemo{UID: &uid})
		require.NoError(t, err)
		require.Nil(t, memo, "memo %s must not survive subtree deletion", uid)
	}
	gotAttachment, err := ts.GetAttachment(ctx, &store.FindAttachment{ID: &attachment.ID})
	require.NoError(t, err)
	require.Nil(t, gotAttachment, "the committed reply's attachment must be deleted with it")
}

func TestMemoDeleteActorCanReadAudienceMatrix(t *testing.T) {
	spaceID := int32(1)
	tests := []struct {
		name         string
		rowStatus    store.RowStatus
		visibility   store.Visibility
		spaceID      *int32
		spaceExists  bool
		actorMember  bool
		actorCanRead bool
	}{
		{name: "public", rowStatus: store.Normal, visibility: store.Public, actorCanRead: true},
		{name: "protected", rowStatus: store.Normal, visibility: store.Protected, actorCanRead: true},
		{name: "private author", rowStatus: store.Normal, visibility: store.Private, actorCanRead: true},
		{name: "space member", rowStatus: store.Normal, visibility: store.SpaceAudience, spaceID: &spaceID, spaceExists: true, actorMember: true, actorCanRead: true},
		{name: "removed space member", rowStatus: store.Normal, visibility: store.SpaceAudience, spaceID: &spaceID, spaceExists: true},
		{name: "space audience without placement", rowStatus: store.Normal, visibility: store.SpaceAudience},
		{name: "dangling placement", rowStatus: store.Normal, visibility: store.Public, spaceID: &spaceID, actorCanRead: true},
		{name: "unknown audience", rowStatus: store.Normal, visibility: store.Visibility("UNKNOWN")},
		{name: "invalid lifecycle", rowStatus: store.RowStatus("UNKNOWN"), visibility: store.Public},
		{name: "archived author", rowStatus: store.Archived, visibility: store.Private, actorCanRead: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			require.Equal(t, test.actorCanRead, store.MemoDeleteActorCanRead(
				test.rowStatus,
				test.visibility,
				test.spaceID,
				test.spaceExists,
				test.actorMember,
			))
		})
	}
}

func TestDeleteMemoWithPolicySnapshotsCurrentAudience(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	author, err := ts.CreateUser(ctx, &store.User{Username: "delete-snapshot-author", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	admin, err := ts.CreateUser(ctx, &store.User{Username: "delete-snapshot-admin", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	space, err := ts.CreateSpace(ctx, &store.Space{UID: "delete-snapshot-space", Title: "Delete snapshot"}, author.ID)
	require.NoError(t, err)
	_, err = createSpaceMemberForTest(ctx, ts, &store.SpaceMember{SpaceID: space.ID, UserID: admin.ID, Role: store.SpaceMemberRoleAdmin}, author.ID)
	require.NoError(t, err)

	type memoExpectation struct {
		memo         *store.Memo
		actorCanRead bool
	}
	memos := make([]memoExpectation, 0, 4)
	for index, visibility := range []store.Visibility{store.Public, store.Protected, store.Private, store.SpaceAudience} {
		memo, err := ts.CreateMemo(ctx, &store.Memo{
			UID:        fmt.Sprintf("delete-snapshot-%d", index),
			CreatorID:  author.ID,
			Content:    visibility.String(),
			Visibility: visibility,
			SpaceID:    &space.ID,
		})
		require.NoError(t, err)
		memos = append(memos, memoExpectation{memo: memo, actorCanRead: visibility != store.SpaceAudience})
	}
	require.NoError(t, ts.DeleteSpaceMember(ctx, &store.DeleteSpaceMember{SpaceID: space.ID, UserID: author.ID}, admin.ID))

	for _, expectation := range memos {
		result, err := ts.DeleteMemoWithPolicy(ctx, &store.DeleteMemoWithPolicy{MemoID: expectation.memo.ID, ActorUserID: author.ID})
		require.NoError(t, err)
		require.Equal(t, expectation.actorCanRead, result.ActorCanRead, expectation.memo.Visibility)
	}

	dangling, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "delete-snapshot-dangling", CreatorID: author.ID, Content: "dangling", Visibility: store.Public,
	})
	require.NoError(t, err)
	_, err = ts.GetDriver().GetDB().ExecContext(ctx, fmt.Sprintf("UPDATE memo SET space_id = 2147483000 WHERE id = %d", dangling.ID))
	require.NoError(t, err)
	result, err := ts.DeleteMemoWithPolicy(ctx, &store.DeleteMemoWithPolicy{MemoID: dangling.ID, ActorUserID: author.ID})
	require.NoError(t, err)
	require.True(t, result.ActorCanRead, "a dangling placement must not override a PUBLIC audience")

	unassignedMembers, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "delete-snapshot-unassigned-members", CreatorID: author.ID, Content: "invalid", Visibility: store.Public,
	})
	require.NoError(t, err)
	_, err = ts.GetDriver().GetDB().ExecContext(ctx, fmt.Sprintf("UPDATE memo SET visibility = 'SPACE' WHERE id = %d", unassignedMembers.ID))
	require.NoError(t, err)
	result, err = ts.DeleteMemoWithPolicy(ctx, &store.DeleteMemoWithPolicy{MemoID: unassignedMembers.ID, ActorUserID: author.ID})
	require.NoError(t, err)
	require.False(t, result.ActorCanRead, "SPACE without placement must fail closed")
}
