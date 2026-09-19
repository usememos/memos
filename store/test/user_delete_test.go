package test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestDeleteUserIsIdempotent(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	user, err := createTestingUserWithRole(ctx, ts, "delete-idempotent", store.RoleUser)
	require.NoError(t, err)
	first, err := ts.DeleteUser(ctx, &store.DeleteUser{ID: user.ID})
	require.NoError(t, err)
	require.NotNil(t, first)
	second, err := ts.DeleteUser(ctx, &store.DeleteUser{ID: user.ID})
	require.NoError(t, err)
	require.NotNil(t, second)
	require.Empty(t, second.UserSettingKeys)
}

func TestDeleteUserBatchBoundariesAndRollback(t *testing.T) {
	for _, count := range []int{499, 500, 501, 1001} {
		t.Run(fmt.Sprint(count), func(t *testing.T) {
			ctx := context.Background()
			ts := NewTestingStore(ctx, t)
			defer ts.Close()
			owner, err := createTestingUserWithRole(ctx, ts, "batch-owner", store.RoleUser)
			require.NoError(t, err)
			peer, err := createTestingUserWithRole(ctx, ts, "batch-peer", store.RoleUser)
			require.NoError(t, err)
			keepMemo, err := ts.CreateMemo(ctx, &store.Memo{UID: "keep-memo", CreatorID: peer.ID, Content: "keep", Visibility: store.Public})
			require.NoError(t, err)
			keepMemo, err = ts.GetMemo(ctx, &store.FindMemo{ID: &keepMemo.ID})
			require.NoError(t, err)
			keepAttachment, err := ts.CreateAttachment(ctx, &store.Attachment{UID: "keep-attachment", CreatorID: peer.ID,
				MemoID: &keepMemo.ID, Filename: "keep.txt", Type: "text/plain", Blob: []byte("keep")})
			require.NoError(t, err)
			keepInbox, err := ts.CreateInbox(ctx, &store.Inbox{SenderID: peer.ID, ReceiverID: peer.ID, Status: store.UNREAD,
				Message: &storepb.InboxMessage{Type: storepb.InboxMessage_MEMO_MENTION}})
			require.NoError(t, err)
			keepShare, err := ts.CreateMemoShare(ctx, &store.MemoShare{UID: "keep-share", MemoID: keepMemo.ID, CreatorID: peer.ID})
			require.NoError(t, err)
			keepReaction, err := ts.UpsertReaction(ctx, &store.Reaction{CreatorID: peer.ID, MemoID: keepMemo.ID, ReactionType: "keep"})
			require.NoError(t, err)
			attachmentIDs := make([]int32, 0, count)
			for i := range count {
				uid := fmt.Sprintf("batch-%d", i)
				memo, err := ts.CreateMemo(ctx, &store.Memo{UID: uid, CreatorID: owner.ID, Content: uid, Visibility: store.Public})
				require.NoError(t, err)
				creatorID := owner.ID
				if i%2 == 0 {
					creatorID = peer.ID
				}
				attachment, err := ts.CreateAttachment(ctx, &store.Attachment{UID: uid, CreatorID: creatorID, MemoID: &memo.ID,
					Filename: uid + ".txt", Type: "text/plain", Blob: []byte(uid), Reference: uid})
				require.NoError(t, err)
				attachmentIDs = append(attachmentIDs, attachment.ID)
				_, err = ts.UpsertReaction(ctx, &store.Reaction{CreatorID: peer.ID, MemoID: memo.ID, ReactionType: "thumbs-up"})
				require.NoError(t, err)
				_, err = ts.CreateMemoShare(ctx, &store.MemoShare{UID: uid, MemoID: memo.ID, CreatorID: peer.ID})
				require.NoError(t, err)
				_, err = ts.CreateInbox(ctx, &store.Inbox{SenderID: owner.ID, ReceiverID: peer.ID, Status: store.UNREAD,
					Message: &storepb.InboxMessage{Type: storepb.InboxMessage_MEMO_MENTION}})
				require.NoError(t, err)
				// Exercise both incoming and outgoing relation cleanup across every batch.
				_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{MemoID: memo.ID, RelatedMemoID: keepMemo.ID, Type: store.MemoRelationReference})
				require.NoError(t, err)
				_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{MemoID: keepMemo.ID, RelatedMemoID: memo.ID, Type: store.MemoRelationReference})
				require.NoError(t, err)
			}
			_, err = ts.UpsertUserSetting(ctx, &storepb.UserSetting{UserId: owner.ID, Key: storepb.UserSetting_GENERAL,
				Value: &storepb.UserSetting_General{General: &storepb.GeneralUserSetting{Locale: "en"}}})
			require.NoError(t, err)
			_, err = ts.CreateUserIdentity(ctx, &store.UserIdentity{UserID: owner.ID, Provider: "test", ExternUID: "batch-owner"})
			require.NoError(t, err)
			// Prime facade caches before forcing a failure after every delete statement.
			_, err = ts.GetUser(ctx, &store.FindUser{ID: &owner.ID})
			require.NoError(t, err)
			_, err = ts.GetUserSetting(ctx, &store.FindUserSetting{UserID: &owner.ID, Key: storepb.UserSetting_GENERAL})
			require.NoError(t, err)
			if count > 500 {
				before := snapshotUserDeletion(t, ts)
				result, err := ts.DeleteUser(store.WithDeleteUserFailpoint(ctx, store.DeleteUserFailpointBeforeCommit), &store.DeleteUser{ID: owner.ID})
				require.ErrorContains(t, err, "delete user failpoint before commit")
				require.Nil(t, result, "failed deletion must not expose resources for physical cleanup")
				require.Equal(t, before, snapshotUserDeletion(t, ts), "all batches and related tables must roll back")
				cachedUser, err := ts.GetUser(ctx, &store.FindUser{ID: &owner.ID})
				require.NoError(t, err)
				require.NotNil(t, cachedUser)
				cachedSetting, err := ts.GetUserSetting(ctx, &store.FindUserSetting{UserID: &owner.ID, Key: storepb.UserSetting_GENERAL})
				require.NoError(t, err)
				require.Equal(t, "en", cachedSetting.GetGeneral().GetLocale())
			}
			result, err := ts.DeleteUser(ctx, &store.DeleteUser{ID: owner.ID})
			require.NoError(t, err)
			require.ElementsMatch(t, []storepb.UserSetting_Key{storepb.UserSetting_GENERAL}, result.UserSettingKeys)
			var deletedIDs []int32
			for _, attachment := range result.Attachments {
				deletedIDs = append(deletedIDs, attachment.ID)
				require.Equal(t, attachment.UID, attachment.Reference)
			}
			require.ElementsMatch(t, attachmentIDs, deletedIDs, "each attachment must be returned exactly once, even if both owner and memo match")
			after := snapshotUserDeletion(t, ts)
			require.Len(t, after.users, 1)
			require.Equal(t, peer.ID, after.users[0].ID)
			require.Equal(t, []*store.Memo{keepMemo}, after.memos)
			require.Len(t, after.attachments, 1)
			require.Equal(t, keepAttachment.ID, after.attachments[0].ID)
			require.Equal(t, []byte("keep"), after.attachments[0].Blob)
			require.Equal(t, []*store.MemoShare{keepShare}, after.shares)
			require.Equal(t, []*store.Reaction{keepReaction}, after.reactions)
			require.Len(t, after.inboxes, 1)
			require.Equal(t, keepInbox.ID, after.inboxes[0].ID)
			require.Empty(t, after.relations)
			require.Empty(t, after.settings)
			require.Empty(t, after.identities)
			cachedUser, err := ts.GetUser(ctx, &store.FindUser{ID: &owner.ID})
			require.NoError(t, err)
			require.Nil(t, cachedUser)
			cachedSetting, err := ts.GetUserSetting(ctx, &store.FindUserSetting{UserID: &owner.ID, Key: storepb.UserSetting_GENERAL})
			require.NoError(t, err)
			require.Nil(t, cachedSetting)
		})
	}
}

type userDeletionSnapshot struct {
	users       []*store.User
	memos       []*store.Memo
	attachments []*store.Attachment
	shares      []*store.MemoShare
	reactions   []*store.Reaction
	inboxes     []*store.Inbox
	relations   []*store.MemoRelation
	settings    []*storepb.UserSetting
	identities  []*store.UserIdentity
}

func snapshotUserDeletion(t *testing.T, ts *store.Store) userDeletionSnapshot {
	t.Helper()
	ctx := context.Background()
	var result userDeletionSnapshot
	var err error
	result.users, err = ts.ListUsers(ctx, &store.FindUser{})
	require.NoError(t, err)
	result.memos, err = ts.ListMemos(ctx, &store.FindMemo{})
	require.NoError(t, err)
	result.attachments, err = ts.ListAttachments(ctx, &store.FindAttachment{GetBlob: true, SkipDefaultLimit: true})
	require.NoError(t, err)
	result.shares, err = ts.ListMemoShares(ctx, &store.FindMemoShare{})
	require.NoError(t, err)
	result.reactions, err = ts.ListReactions(ctx, &store.FindReaction{})
	require.NoError(t, err)
	result.inboxes, err = ts.ListInboxes(ctx, &store.FindInbox{})
	require.NoError(t, err)
	result.relations, err = ts.ListMemoRelations(ctx, &store.FindMemoRelation{})
	require.NoError(t, err)
	result.settings, err = ts.ListUserSettings(ctx, &store.FindUserSetting{})
	require.NoError(t, err)
	result.identities, err = ts.ListUserIdentities(ctx, &store.FindUserIdentity{})
	require.NoError(t, err)
	return result
}

func TestDeleteUserCleansRelatedData(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	peer, err := createTestingUserWithRole(ctx, ts, "delete-peer", store.RoleUser)
	require.NoError(t, err)

	ownMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "delete-own-memo",
		CreatorID:  user.ID,
		Content:    "owner memo",
		Visibility: store.Public,
	})
	require.NoError(t, err)
	peerMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "delete-peer-memo",
		CreatorID:  peer.ID,
		Content:    "peer memo",
		Visibility: store.Public,
	})
	require.NoError(t, err)
	peerCommentOnOwnMemo, err := ts.CreateMemoComment(ctx, &store.Memo{
		UID:       "delete-peer-comment",
		CreatorID: peer.ID,
		Content:   "peer comment on owner memo",
	}, ownMemo.ID, peer.ID)
	require.NoError(t, err)
	userCommentOnPeerMemo, err := ts.CreateMemoComment(ctx, &store.Memo{
		UID:       "delete-user-comment",
		CreatorID: user.ID,
		Content:   "owner comment on peer memo",
	}, peerMemo.ID, user.ID)
	require.NoError(t, err)

	ownerAttachment, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID:       "delete-owner-attachment",
		CreatorID: user.ID,
		Filename:  "owner.txt",
		Type:      "text/plain",
		Size:      5,
		Blob:      []byte("owner"),
		MemoID:    &ownMemo.ID,
	})
	require.NoError(t, err)
	peerAttachmentOnDeletedMemo, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID:       "delete-peer-attachment",
		CreatorID: peer.ID,
		Filename:  "peer-on-owner.txt",
		Type:      "text/plain",
		Size:      4,
		Blob:      []byte("peer"),
		MemoID:    &ownMemo.ID,
	})
	require.NoError(t, err)
	peerAttachmentToKeep, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID:       "keep-peer-attachment",
		CreatorID: peer.ID,
		Filename:  "peer.txt",
		Type:      "text/plain",
		Size:      4,
		Blob:      []byte("peer"),
		MemoID:    &peerMemo.ID,
	})
	require.NoError(t, err)

	_, err = ts.UpsertReaction(ctx, &store.Reaction{
		CreatorID:    peer.ID,
		MemoID:       ownMemo.ID,
		ReactionType: "thumbs-up",
	})
	require.NoError(t, err)
	_, err = ts.UpsertReaction(ctx, &store.Reaction{
		CreatorID:    user.ID,
		MemoID:       peerMemo.ID,
		ReactionType: "heart",
	})
	require.NoError(t, err)
	peerReactionToKeep, err := ts.UpsertReaction(ctx, &store.Reaction{
		CreatorID:    peer.ID,
		MemoID:       peerMemo.ID,
		ReactionType: "sparkle",
	})
	require.NoError(t, err)

	_, err = ts.CreateMemoShare(ctx, &store.MemoShare{
		UID:       "delete-owner-share",
		MemoID:    peerMemo.ID,
		CreatorID: user.ID,
	})
	require.NoError(t, err)
	_, err = ts.CreateMemoShare(ctx, &store.MemoShare{
		UID:       "delete-memo-share",
		MemoID:    ownMemo.ID,
		CreatorID: peer.ID,
	})
	require.NoError(t, err)
	peerShareToKeep, err := ts.CreateMemoShare(ctx, &store.MemoShare{
		UID:       "keep-peer-share",
		MemoID:    peerMemo.ID,
		CreatorID: peer.ID,
	})
	require.NoError(t, err)

	_, err = ts.CreateInbox(ctx, &store.Inbox{
		SenderID:   user.ID,
		ReceiverID: peer.ID,
		Status:     store.UNREAD,
		Message:    &storepb.InboxMessage{Type: storepb.InboxMessage_MEMO_MENTION},
	})
	require.NoError(t, err)
	referencingDeletedMemoInbox, err := ts.CreateInbox(ctx, &store.Inbox{
		SenderID:   peer.ID,
		ReceiverID: peer.ID,
		Status:     store.UNREAD,
		Message: &storepb.InboxMessage{
			Type: storepb.InboxMessage_MEMO_COMMENT,
			Payload: &storepb.InboxMessage_MemoComment{
				MemoComment: &storepb.InboxMessage_MemoCommentPayload{
					MemoId: ownMemo.ID,
				},
			},
		},
	})
	require.NoError(t, err)
	inboxToKeep, err := ts.CreateInbox(ctx, &store.Inbox{
		SenderID:   peer.ID,
		ReceiverID: peer.ID,
		Status:     store.UNREAD,
		Message: &storepb.InboxMessage{
			Type: storepb.InboxMessage_MEMO_COMMENT,
			Payload: &storepb.InboxMessage_MemoComment{
				MemoComment: &storepb.InboxMessage_MemoCommentPayload{
					MemoId: peerMemo.ID,
				},
			},
		},
	})
	require.NoError(t, err)

	_, err = ts.CreateUserIdentity(ctx, &store.UserIdentity{
		UserID:    user.ID,
		Provider:  "google",
		ExternUID: "delete-user-sub",
	})
	require.NoError(t, err)
	err = ts.AddUserPersonalAccessToken(ctx, user.ID, &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:     "delete-user-pat",
		TokenHash:   "delete-user-pat-hash",
		Description: "delete user pat",
	})
	require.NoError(t, err)

	_, err = ts.DeleteUser(ctx, &store.DeleteUser{ID: user.ID})
	require.NoError(t, err)

	deletedUser, err := ts.GetUser(ctx, &store.FindUser{ID: &user.ID})
	require.NoError(t, err)
	require.Nil(t, deletedUser)
	keptUser, err := ts.GetUser(ctx, &store.FindUser{ID: &peer.ID})
	require.NoError(t, err)
	require.NotNil(t, keptUser)

	for _, memo := range []*store.Memo{ownMemo, userCommentOnPeerMemo} {
		got, getErr := ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
		require.NoError(t, getErr)
		require.Nil(t, got, memo.UID)
	}
	for _, memo := range []*store.Memo{peerMemo, peerCommentOnOwnMemo} {
		got, getErr := ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
		require.NoError(t, getErr)
		require.NotNil(t, got, memo.UID)
	}

	for _, attachment := range []*store.Attachment{ownerAttachment, peerAttachmentOnDeletedMemo} {
		got, getErr := ts.GetAttachment(ctx, &store.FindAttachment{ID: &attachment.ID})
		require.NoError(t, getErr)
		require.Nil(t, got, attachment.UID)
	}
	keptAttachment, err := ts.GetAttachment(ctx, &store.FindAttachment{ID: &peerAttachmentToKeep.ID})
	require.NoError(t, err)
	require.NotNil(t, keptAttachment)

	deletedMemoRelations, err := ts.ListMemoRelations(ctx, &store.FindMemoRelation{MemoIDList: []int32{ownMemo.ID, peerCommentOnOwnMemo.ID, userCommentOnPeerMemo.ID}})
	require.NoError(t, err)
	require.Empty(t, deletedMemoRelations, "relations incident to deleted memos must be removed without deleting the other endpoint")

	keptReactions, err := ts.ListReactions(ctx, &store.FindReaction{MemoID: &peerMemo.ID})
	require.NoError(t, err)
	require.Len(t, keptReactions, 1)
	require.Equal(t, peerReactionToKeep.ID, keptReactions[0].ID)

	deletedOwnerShares, err := ts.ListMemoShares(ctx, &store.FindMemoShare{CreatorID: &user.ID})
	require.NoError(t, err)
	require.Empty(t, deletedOwnerShares)
	keptShare, err := ts.GetMemoShare(ctx, &store.FindMemoShare{ID: &peerShareToKeep.ID})
	require.NoError(t, err)
	require.NotNil(t, keptShare)

	deletedSentInboxes, err := ts.ListInboxes(ctx, &store.FindInbox{SenderID: &user.ID})
	require.NoError(t, err)
	require.Empty(t, deletedSentInboxes)
	deletedReceivedInboxes, err := ts.ListInboxes(ctx, &store.FindInbox{ReceiverID: &user.ID})
	require.NoError(t, err)
	require.Empty(t, deletedReceivedInboxes)
	referencedInboxes, err := ts.ListInboxes(ctx, &store.FindInbox{ID: &referencingDeletedMemoInbox.ID})
	require.NoError(t, err)
	require.Len(t, referencedInboxes, 1, "deleting a referenced memo must not control another user's inbox lifecycle")
	keptInboxes, err := ts.ListInboxes(ctx, &store.FindInbox{ID: &inboxToKeep.ID})
	require.NoError(t, err)
	require.Len(t, keptInboxes, 1)

	identities, err := ts.ListUserIdentities(ctx, &store.FindUserIdentity{UserID: &user.ID})
	require.NoError(t, err)
	require.Empty(t, identities)
	setting, err := ts.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &user.ID,
		Key:    storepb.UserSetting_PERSONAL_ACCESS_TOKENS,
	})
	require.NoError(t, err)
	require.Nil(t, setting)
}
