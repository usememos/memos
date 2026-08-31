package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestDeleteSpaceDeletesOnlyDirectlyAssignedMemosAndOwnedResources(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	admin, err := ts.CreateUser(ctx, &store.User{Username: "space-delete-admin", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	member, err := ts.CreateUser(ctx, &store.User{Username: "space-delete-member", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	applicationAdmin, err := ts.CreateUser(ctx, &store.User{Username: "space-delete-app-admin", Role: store.RoleAdmin, PasswordHash: "hash"})
	require.NoError(t, err)

	space, err := ts.CreateSpace(ctx, &store.Space{UID: "delete-space", Title: "Delete Space"}, admin.ID)
	require.NoError(t, err)
	_, err = createSpaceMemberForTest(ctx, ts, &store.SpaceMember{SpaceID: space.ID, UserID: member.ID, Role: store.SpaceMemberRoleUser}, admin.ID)
	require.NoError(t, err)

	assigned, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "delete-space-assigned",
		CreatorID:  admin.ID,
		Content:    "assigned content",
		Visibility: store.Public,
		SpaceID:    &space.ID,
	})
	require.NoError(t, err)
	survivor, err := ts.CreateMemo(ctx, &store.Memo{UID: "delete-space-survivor", CreatorID: member.ID, Content: "survivor", Visibility: store.Public})
	require.NoError(t, err)
	otherSurvivor, err := ts.CreateMemo(ctx, &store.Memo{UID: "delete-space-other-survivor", CreatorID: member.ID, Content: "other", Visibility: store.Public})
	require.NoError(t, err)

	_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{MemoID: assigned.ID, RelatedMemoID: survivor.ID, Type: store.MemoRelationReference})
	require.NoError(t, err)
	_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{MemoID: otherSurvivor.ID, RelatedMemoID: assigned.ID, Type: store.MemoRelationReference})
	require.NoError(t, err)
	_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{MemoID: survivor.ID, RelatedMemoID: otherSurvivor.ID, Type: store.MemoRelationReference})
	require.NoError(t, err)

	attachment, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID:       "delete-space-attachment",
		CreatorID: admin.ID,
		Filename:  "assigned.txt",
		MemoID:    &assigned.ID,
		Payload:   &storepb.AttachmentPayload{},
	})
	require.NoError(t, err)
	reaction, err := ts.UpsertReaction(ctx, &store.Reaction{CreatorID: member.ID, MemoID: assigned.ID, ReactionType: "THUMBS_UP"})
	require.NoError(t, err)
	share, err := ts.CreateMemoShare(ctx, &store.MemoShare{UID: "delete-space-share", MemoID: assigned.ID, CreatorID: admin.ID})
	require.NoError(t, err)
	referencingNotification, err := ts.CreateInbox(ctx, &store.Inbox{
		SenderID: admin.ID, ReceiverID: member.ID, Status: store.UNREAD,
		Message: &storepb.InboxMessage{
			Type: storepb.InboxMessage_MEMO_COMMENT,
			Payload: &storepb.InboxMessage_MemoComment{MemoComment: &storepb.InboxMessage_MemoCommentPayload{
				MemoId: assigned.ID, RelatedMemoId: survivor.ID,
			}},
		},
	})
	require.NoError(t, err)
	survivingNotification, err := ts.CreateInbox(ctx, &store.Inbox{
		SenderID: member.ID, ReceiverID: admin.ID, Status: store.UNREAD,
		Message: &storepb.InboxMessage{
			Type: storepb.InboxMessage_MEMO_MENTION,
			Payload: &storepb.InboxMessage_MemoMention{MemoMention: &storepb.InboxMessage_MemoMentionPayload{
				MemoId: survivor.ID, RelatedMemoId: otherSurvivor.ID,
			}},
		},
	})
	require.NoError(t, err)

	_, err = ts.DeleteSpace(ctx, &store.DeleteSpace{ID: space.ID, ActorUserID: member.ID})
	require.ErrorIs(t, err, store.ErrSpacePermissionDenied)
	_, err = ts.DeleteSpace(ctx, &store.DeleteSpace{ID: space.ID, ActorUserID: applicationAdmin.ID})
	require.ErrorIs(t, err, store.ErrSpacePermissionDenied, "application ADMIN must not bypass Space membership")

	deleteResult, err := ts.DeleteSpace(ctx, &store.DeleteSpace{ID: space.ID, ActorUserID: admin.ID})
	require.NoError(t, err)
	require.NotNil(t, deleteResult)
	require.Len(t, deleteResult.Attachments, 1)
	require.Equal(t, attachment.ID, deleteResult.Attachments[0].ID)

	deletedSpace, err := ts.GetSpace(ctx, &store.FindSpace{ID: &space.ID})
	require.NoError(t, err)
	require.Nil(t, deletedSpace)
	deletedMemo, err := ts.GetMemo(ctx, &store.FindMemo{ID: &assigned.ID})
	require.NoError(t, err)
	require.Nil(t, deletedMemo)
	for _, memoID := range []int32{survivor.ID, otherSurvivor.ID} {
		memo, err := ts.GetMemo(ctx, &store.FindMemo{ID: &memoID})
		require.NoError(t, err)
		require.NotNil(t, memo, "relation traversal must not delete surviving endpoints")
	}

	deletedAttachment, err := ts.GetAttachment(ctx, &store.FindAttachment{ID: &attachment.ID})
	require.NoError(t, err)
	require.Nil(t, deletedAttachment)
	deletedReaction, err := ts.GetReaction(ctx, &store.FindReaction{ID: &reaction.ID})
	require.NoError(t, err)
	require.Nil(t, deletedReaction)
	deletedShare, err := ts.GetMemoShare(ctx, &store.FindMemoShare{ID: &share.ID})
	require.NoError(t, err)
	require.Nil(t, deletedShare)
	retainedInboxes, err := ts.ListInboxes(ctx, &store.FindInbox{ID: &referencingNotification.ID})
	require.NoError(t, err)
	require.Len(t, retainedInboxes, 1, "Space deletion must not control the independent inbox lifecycle")
	survivingInboxes, err := ts.ListInboxes(ctx, &store.FindInbox{ID: &survivingNotification.ID})
	require.NoError(t, err)
	require.Len(t, survivingInboxes, 1)

	incidentRelations, err := ts.ListMemoRelations(ctx, &store.FindMemoRelation{MemoID: &assigned.ID})
	require.NoError(t, err)
	require.Empty(t, incidentRelations)
	incomingIncidentRelations, err := ts.ListMemoRelations(ctx, &store.FindMemoRelation{RelatedMemoID: &assigned.ID})
	require.NoError(t, err)
	require.Empty(t, incomingIncidentRelations)
	survivingRelations, err := ts.ListMemoRelations(ctx, &store.FindMemoRelation{MemoID: &survivor.ID})
	require.NoError(t, err)
	require.Len(t, survivingRelations, 1)
	require.Equal(t, otherSurvivor.ID, survivingRelations[0].RelatedMemoID)

	membership, err := ts.GetSpaceMember(ctx, &store.FindSpaceMember{SpaceID: &space.ID, UserID: &member.ID})
	require.NoError(t, err)
	require.Nil(t, membership)
}
