package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

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
	peerCommentOnOwnMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "delete-peer-comment",
		CreatorID:  peer.ID,
		Content:    "peer comment on owner memo",
		Visibility: store.Public,
	})
	require.NoError(t, err)
	_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        peerCommentOnOwnMemo.ID,
		RelatedMemoID: ownMemo.ID,
		Type:          store.MemoRelationComment,
	})
	require.NoError(t, err)
	userCommentOnPeerMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "delete-user-comment",
		CreatorID:  user.ID,
		Content:    "owner comment on peer memo",
		Visibility: store.Public,
	})
	require.NoError(t, err)
	_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        userCommentOnPeerMemo.ID,
		RelatedMemoID: peerMemo.ID,
		Type:          store.MemoRelationComment,
	})
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
		ContentID:    "memos/" + ownMemo.UID,
		ReactionType: "thumbs-up",
	})
	require.NoError(t, err)
	_, err = ts.UpsertReaction(ctx, &store.Reaction{
		CreatorID:    user.ID,
		ContentID:    "memos/" + peerMemo.UID,
		ReactionType: "heart",
	})
	require.NoError(t, err)
	peerReactionToKeep, err := ts.UpsertReaction(ctx, &store.Reaction{
		CreatorID:    peer.ID,
		ContentID:    "memos/" + peerMemo.UID,
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
	_, err = ts.CreateInbox(ctx, &store.Inbox{
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

	for _, memo := range []*store.Memo{ownMemo, peerCommentOnOwnMemo, userCommentOnPeerMemo} {
		got, getErr := ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
		require.NoError(t, getErr)
		require.Nil(t, got, memo.UID)
	}
	keptMemo, err := ts.GetMemo(ctx, &store.FindMemo{ID: &peerMemo.ID})
	require.NoError(t, err)
	require.NotNil(t, keptMemo)

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
	require.Empty(t, deletedMemoRelations)

	peerMemoContentID := "memos/" + peerMemo.UID
	keptReactions, err := ts.ListReactions(ctx, &store.FindReaction{ContentID: &peerMemoContentID})
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
