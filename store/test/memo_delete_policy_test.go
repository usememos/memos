package test

import (
	"context"
	"fmt"
	"testing"

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
	for _, survivorID := range []int32{contextMemo.ID, reply.ID} {
		survivor, err := ts.GetMemo(ctx, &store.FindMemo{ID: &survivorID})
		require.NoError(t, err)
		require.NotNil(t, survivor)
	}

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
	require.Empty(t, replyRelations, "the surviving reply loses only its deleted context relation")
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
	_, err = ts.CreateSpaceMember(ctx, &store.SpaceMember{SpaceID: space.ID, UserID: admin.ID, Role: store.SpaceMemberRoleAdmin}, author.ID)
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
