package test

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/timestamppb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	apiv1 "github.com/usememos/memos/server/router/api/v1"
	"github.com/usememos/memos/store"
)

func TestDeleteUserSelfDeleteCleansAccountDataAndAuthCookies(t *testing.T) {
	t.Parallel()

	ts := NewTestService(t)
	defer ts.Cleanup()

	ctx := context.Background()
	user, err := ts.CreateRegularUser(ctx, "alice")
	require.NoError(t, err)

	_, err = ts.Store.CreateUserIdentity(ctx, &store.UserIdentity{
		UserID:    user.ID,
		Provider:  "google",
		ExternUID: "alice-google-sub",
	})
	require.NoError(t, err)

	err = ts.Store.AddUserRefreshToken(ctx, user.ID, &storepb.RefreshTokensUserSetting_RefreshToken{
		TokenId:   "refresh-token-id",
		ExpiresAt: timestamppb.New(time.Now().Add(time.Hour)),
		CreatedAt: timestamppb.Now(),
	})
	require.NoError(t, err)

	headerCtx := apiv1.WithHeaderCarrier(ctx)
	authCtx := ts.CreateUserContext(headerCtx, user.ID)
	_, err = ts.Service.DeleteUser(authCtx, &v1pb.DeleteUserRequest{
		Name: apiv1.BuildUserName(user.Username),
	})
	require.NoError(t, err)

	deletedUser, err := ts.Store.GetUser(ctx, &store.FindUser{ID: &user.ID})
	require.NoError(t, err)
	require.Nil(t, deletedUser)

	identities, err := ts.Store.ListUserIdentities(ctx, &store.FindUserIdentity{UserID: &user.ID})
	require.NoError(t, err)
	require.Empty(t, identities)

	refreshSetting, err := ts.Store.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &user.ID,
		Key:    storepb.UserSetting_REFRESH_TOKENS,
	})
	require.NoError(t, err)
	require.Nil(t, refreshSetting)

	carrier := apiv1.GetHeaderCarrier(authCtx)
	require.NotNil(t, carrier)
	require.Contains(t, strings.ToLower(carrier.Get("Set-Cookie")), "memos_refresh=")
}

func TestDeleteUserSelfDeleteRemovesOwnedResourcesAndMemoSubtrees(t *testing.T) {
	t.Parallel()

	ts := NewTestService(t)
	defer ts.Cleanup()

	ctx := context.Background()
	user, err := ts.CreateRegularUser(ctx, "resource-owner")
	require.NoError(t, err)
	peer, err := ts.CreateRegularUser(ctx, "resource-peer")
	require.NoError(t, err)

	userCtx := ts.CreateUserContext(ctx, user.ID)
	peerCtx := ts.CreateUserContext(ctx, peer.ID)

	ownMemo, err := ts.Service.CreateMemo(userCtx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{
			Content:    "owner memo",
			Visibility: v1pb.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	foreignMemo, err := ts.Service.CreateMemo(peerCtx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{
			Content:    "peer memo",
			Visibility: v1pb.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	peerCommentOnOwnMemo, err := ts.Service.CreateMemoComment(peerCtx, &v1pb.CreateMemoCommentRequest{
		Name: ownMemo.Name,
		Comment: &v1pb.Memo{
			Content:    "peer comment on owner memo",
			Visibility: v1pb.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	peerNestedCommentOnOwnMemo, err := ts.Service.CreateMemoComment(peerCtx, &v1pb.CreateMemoCommentRequest{
		Name: peerCommentOnOwnMemo.Name,
		Comment: &v1pb.Memo{
			Content:    "peer nested comment on owner memo",
			Visibility: v1pb.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	userCommentOnForeignMemo, err := ts.Service.CreateMemoComment(userCtx, &v1pb.CreateMemoCommentRequest{
		Name: foreignMemo.Name,
		Comment: &v1pb.Memo{
			Content:    "owner comment on peer memo",
			Visibility: v1pb.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	peerReplyToUserComment, err := ts.Service.CreateMemoComment(peerCtx, &v1pb.CreateMemoCommentRequest{
		Name: userCommentOnForeignMemo.Name,
		Comment: &v1pb.Memo{
			Content:    "peer reply to owner comment",
			Visibility: v1pb.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	ownMemoUID, err := apiv1.ExtractMemoUIDFromName(ownMemo.Name)
	require.NoError(t, err)
	ownMemoStore, err := ts.Store.GetMemo(ctx, &store.FindMemo{UID: &ownMemoUID})
	require.NoError(t, err)
	require.NotNil(t, ownMemoStore)

	foreignMemoUID, err := apiv1.ExtractMemoUIDFromName(foreignMemo.Name)
	require.NoError(t, err)
	foreignMemoStore, err := ts.Store.GetMemo(ctx, &store.FindMemo{UID: &foreignMemoUID})
	require.NoError(t, err)
	require.NotNil(t, foreignMemoStore)

	attachedAttachment, err := ts.Store.CreateAttachment(ctx, &store.Attachment{
		UID:       "attach-owner-memo",
		CreatorID: user.ID,
		Filename:  "owner.txt",
		Type:      "text/plain",
		Size:      4,
		Blob:      []byte("memo"),
		MemoID:    &ownMemoStore.ID,
	})
	require.NoError(t, err)
	thumbnailCachePath := filepath.Join(ts.Profile.Data, ".thumbnail_cache", attachedAttachment.UID+".jpeg")
	motionCachePath := filepath.Join(ts.Profile.Data, ".motion_cache", attachedAttachment.UID+".mp4")
	require.NoError(t, os.MkdirAll(filepath.Dir(thumbnailCachePath), 0o755))
	require.NoError(t, os.WriteFile(thumbnailCachePath, []byte("thumb"), 0o644))
	require.NoError(t, os.MkdirAll(filepath.Dir(motionCachePath), 0o755))
	require.NoError(t, os.WriteFile(motionCachePath, []byte("motion"), 0o644))

	unattachedAttachment, err := ts.Store.CreateAttachment(ctx, &store.Attachment{
		UID:       "attach-owner-loose",
		CreatorID: user.ID,
		Filename:  "loose.txt",
		Type:      "text/plain",
		Size:      5,
		Blob:      []byte("loose"),
	})
	require.NoError(t, err)

	peerAttachment, err := ts.Store.CreateAttachment(ctx, &store.Attachment{
		UID:       "attach-peer-keep",
		CreatorID: peer.ID,
		Filename:  "peer.txt",
		Type:      "text/plain",
		Size:      4,
		Blob:      []byte("peer"),
		MemoID:    &foreignMemoStore.ID,
	})
	require.NoError(t, err)

	_, err = ts.Store.UpsertReaction(ctx, &store.Reaction{
		CreatorID:    peer.ID,
		ContentID:    ownMemo.Name,
		ReactionType: "👍",
	})
	require.NoError(t, err)
	_, err = ts.Store.UpsertReaction(ctx, &store.Reaction{
		CreatorID:    peer.ID,
		ContentID:    userCommentOnForeignMemo.Name,
		ReactionType: "🔥",
	})
	require.NoError(t, err)
	_, err = ts.Store.UpsertReaction(ctx, &store.Reaction{
		CreatorID:    user.ID,
		ContentID:    foreignMemo.Name,
		ReactionType: "👋",
	})
	require.NoError(t, err)
	peerReactionOnForeignMemo, err := ts.Store.UpsertReaction(ctx, &store.Reaction{
		CreatorID:    peer.ID,
		ContentID:    foreignMemo.Name,
		ReactionType: "✅",
	})
	require.NoError(t, err)

	_, err = ts.Store.CreateMemoShare(ctx, &store.MemoShare{
		UID:       "share-owner-ownmemo",
		MemoID:    ownMemoStore.ID,
		CreatorID: user.ID,
	})
	require.NoError(t, err)
	_, err = ts.Store.CreateMemoShare(ctx, &store.MemoShare{
		UID:       "share-owner-foreignmemo",
		MemoID:    foreignMemoStore.ID,
		CreatorID: user.ID,
	})
	require.NoError(t, err)
	peerShare, err := ts.Store.CreateMemoShare(ctx, &store.MemoShare{
		UID:       "share-peer-foreignmemo",
		MemoID:    foreignMemoStore.ID,
		CreatorID: peer.ID,
	})
	require.NoError(t, err)

	_, err = ts.Store.CreateUserIdentity(ctx, &store.UserIdentity{
		UserID:    user.ID,
		Provider:  "google",
		ExternUID: "resource-owner-google-sub",
	})
	require.NoError(t, err)
	err = ts.Store.AddUserPersonalAccessToken(ctx, user.ID, &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:     "pat-owner",
		TokenHash:   "pat-owner-hash",
		Description: "owner pat",
	})
	require.NoError(t, err)

	headerCtx := apiv1.WithHeaderCarrier(ctx)
	authCtx := ts.CreateUserContext(headerCtx, user.ID)
	_, err = ts.Service.DeleteUser(authCtx, &v1pb.DeleteUserRequest{
		Name: apiv1.BuildUserName(user.Username),
	})
	require.NoError(t, err)

	deletedUser, err := ts.Store.GetUser(ctx, &store.FindUser{ID: &user.ID})
	require.NoError(t, err)
	require.Nil(t, deletedUser)

	for _, memoName := range []string{
		ownMemo.Name,
		peerCommentOnOwnMemo.Name,
		peerNestedCommentOnOwnMemo.Name,
		userCommentOnForeignMemo.Name,
		peerReplyToUserComment.Name,
	} {
		memoUID, extractErr := apiv1.ExtractMemoUIDFromName(memoName)
		require.NoError(t, extractErr)
		memo, getErr := ts.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
		require.NoError(t, getErr)
		require.Nil(t, memo, memoName)
	}

	foreignMemoAfterDelete, err := ts.Store.GetMemo(ctx, &store.FindMemo{UID: &foreignMemoUID})
	require.NoError(t, err)
	require.NotNil(t, foreignMemoAfterDelete)

	for _, attachmentID := range []int32{attachedAttachment.ID, unattachedAttachment.ID} {
		attachment, getErr := ts.Store.GetAttachment(ctx, &store.FindAttachment{ID: &attachmentID})
		require.NoError(t, getErr)
		require.Nil(t, attachment)
	}
	peerAttachmentAfterDelete, err := ts.Store.GetAttachment(ctx, &store.FindAttachment{ID: &peerAttachment.ID})
	require.NoError(t, err)
	require.NotNil(t, peerAttachmentAfterDelete)
	_, err = os.Stat(thumbnailCachePath)
	require.ErrorIs(t, err, os.ErrNotExist)
	_, err = os.Stat(motionCachePath)
	require.ErrorIs(t, err, os.ErrNotExist)

	ownMemoReactions, err := ts.Store.ListReactions(ctx, &store.FindReaction{ContentID: &ownMemo.Name})
	require.NoError(t, err)
	require.Empty(t, ownMemoReactions)

	userCommentReactions, err := ts.Store.ListReactions(ctx, &store.FindReaction{ContentID: &userCommentOnForeignMemo.Name})
	require.NoError(t, err)
	require.Empty(t, userCommentReactions)

	foreignMemoReactions, err := ts.Store.ListReactions(ctx, &store.FindReaction{ContentID: &foreignMemo.Name})
	require.NoError(t, err)
	require.Len(t, foreignMemoReactions, 1)
	require.Equal(t, peerReactionOnForeignMemo.ID, foreignMemoReactions[0].ID)

	ownerShares, err := ts.Store.ListMemoShares(ctx, &store.FindMemoShare{CreatorID: &user.ID})
	require.NoError(t, err)
	require.Empty(t, ownerShares)

	peerShares, err := ts.Store.ListMemoShares(ctx, &store.FindMemoShare{CreatorID: &peer.ID})
	require.NoError(t, err)
	require.Len(t, peerShares, 1)
	require.Equal(t, peerShare.ID, peerShares[0].ID)

	sentInboxes, err := ts.Store.ListInboxes(ctx, &store.FindInbox{SenderID: &user.ID})
	require.NoError(t, err)
	require.Empty(t, sentInboxes)
	receivedInboxes, err := ts.Store.ListInboxes(ctx, &store.FindInbox{ReceiverID: &user.ID})
	require.NoError(t, err)
	require.Empty(t, receivedInboxes)

	identities, err := ts.Store.ListUserIdentities(ctx, &store.FindUserIdentity{UserID: &user.ID})
	require.NoError(t, err)
	require.Empty(t, identities)

	patSetting, err := ts.Store.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &user.ID,
		Key:    storepb.UserSetting_PERSONAL_ACCESS_TOKENS,
	})
	require.NoError(t, err)
	require.Nil(t, patSetting)
}

func TestDeleteUserRollbackPreservesAllResources(t *testing.T) {
	t.Parallel()

	ts := NewTestService(t)
	defer ts.Cleanup()

	ctx := context.Background()
	user, err := ts.CreateRegularUser(ctx, "rollback-owner")
	require.NoError(t, err)
	peer, err := ts.CreateRegularUser(ctx, "rollback-peer")
	require.NoError(t, err)

	userCtx := ts.CreateUserContext(ctx, user.ID)
	ownMemo, err := ts.Service.CreateMemo(userCtx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{
			Content:    "rollback owner memo",
			Visibility: v1pb.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	ownMemoUID, err := apiv1.ExtractMemoUIDFromName(ownMemo.Name)
	require.NoError(t, err)
	ownMemoStore, err := ts.Store.GetMemo(ctx, &store.FindMemo{UID: &ownMemoUID})
	require.NoError(t, err)
	require.NotNil(t, ownMemoStore)

	attachment, err := ts.Store.CreateAttachment(ctx, &store.Attachment{
		UID:       "attach-rollback-owner",
		CreatorID: user.ID,
		Filename:  "rollback.txt",
		Type:      "text/plain",
		Size:      8,
		Blob:      []byte("rollback"),
		MemoID:    &ownMemoStore.ID,
	})
	require.NoError(t, err)

	reaction, err := ts.Store.UpsertReaction(ctx, &store.Reaction{
		CreatorID:    user.ID,
		ContentID:    ownMemo.Name,
		ReactionType: "💥",
	})
	require.NoError(t, err)

	share, err := ts.Store.CreateMemoShare(ctx, &store.MemoShare{
		UID:       "share-rollback-owner",
		MemoID:    ownMemoStore.ID,
		CreatorID: user.ID,
	})
	require.NoError(t, err)

	inbox, err := ts.Store.CreateInbox(ctx, &store.Inbox{
		SenderID:   peer.ID,
		ReceiverID: user.ID,
		Status:     store.UNREAD,
		Message: &storepb.InboxMessage{
			Type: storepb.InboxMessage_MEMO_COMMENT,
			Payload: &storepb.InboxMessage_MemoComment{
				MemoComment: &storepb.InboxMessage_MemoCommentPayload{
					MemoId: ownMemoStore.ID,
				},
			},
		},
	})
	require.NoError(t, err)

	_, err = ts.Store.CreateUserIdentity(ctx, &store.UserIdentity{
		UserID:    user.ID,
		Provider:  "google",
		ExternUID: "rollback-owner-google-sub",
	})
	require.NoError(t, err)
	err = ts.Store.AddUserPersonalAccessToken(ctx, user.ID, &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:     "pat-rollback-owner",
		TokenHash:   "pat-rollback-owner-hash",
		Description: "rollback pat",
	})
	require.NoError(t, err)

	headerCtx := apiv1.WithHeaderCarrier(ctx)
	failCtx := store.WithDeleteUserFailpoint(headerCtx, store.DeleteUserFailpointBeforeCommit)
	authCtx := ts.CreateUserContext(failCtx, user.ID)
	_, err = ts.Service.DeleteUser(authCtx, &v1pb.DeleteUserRequest{
		Name: apiv1.BuildUserName(user.Username),
	})
	require.Error(t, err)
	require.ErrorContains(t, err, "delete user failpoint before commit")

	userAfterRollback, err := ts.Store.GetUser(ctx, &store.FindUser{ID: &user.ID})
	require.NoError(t, err)
	require.NotNil(t, userAfterRollback)

	memoAfterRollback, err := ts.Store.GetMemo(ctx, &store.FindMemo{UID: &ownMemoUID})
	require.NoError(t, err)
	require.NotNil(t, memoAfterRollback)

	attachmentAfterRollback, err := ts.Store.GetAttachment(ctx, &store.FindAttachment{ID: &attachment.ID})
	require.NoError(t, err)
	require.NotNil(t, attachmentAfterRollback)

	reactionAfterRollback, err := ts.Store.GetReaction(ctx, &store.FindReaction{ID: &reaction.ID})
	require.NoError(t, err)
	require.NotNil(t, reactionAfterRollback)

	shareAfterRollback, err := ts.Store.GetMemoShare(ctx, &store.FindMemoShare{ID: &share.ID})
	require.NoError(t, err)
	require.NotNil(t, shareAfterRollback)

	inboxesAfterRollback, err := ts.Store.ListInboxes(ctx, &store.FindInbox{ID: &inbox.ID})
	require.NoError(t, err)
	require.Len(t, inboxesAfterRollback, 1)

	identitiesAfterRollback, err := ts.Store.ListUserIdentities(ctx, &store.FindUserIdentity{UserID: &user.ID})
	require.NoError(t, err)
	require.Len(t, identitiesAfterRollback, 1)

	patSetting, err := ts.Store.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &user.ID,
		Key:    storepb.UserSetting_PERSONAL_ACCESS_TOKENS,
	})
	require.NoError(t, err)
	require.NotNil(t, patSetting)
}

func TestDeleteUserReturnsErrorWhenAttachmentStorageCleanupFails(t *testing.T) {
	t.Parallel()

	ts := NewTestService(t)
	defer ts.Cleanup()

	ctx := context.Background()
	user, err := ts.CreateRegularUser(ctx, "cleanup-failure-owner")
	require.NoError(t, err)

	_, err = ts.Store.CreateAttachment(ctx, &store.Attachment{
		UID:         "attach-cleanup-failure",
		CreatorID:   user.ID,
		Filename:    "failure.txt",
		Type:        "text/plain",
		Size:        7,
		Blob:        []byte("failure"),
		StorageType: storepb.AttachmentStorageType_LOCAL,
		Reference:   "cleanup-failure.txt",
	})
	require.NoError(t, err)

	headerCtx := apiv1.WithHeaderCarrier(ctx)
	failCtx := store.WithDeleteAttachmentStorageFailpoint(headerCtx)
	authCtx := ts.CreateUserContext(failCtx, user.ID)
	_, err = ts.Service.DeleteUser(authCtx, &v1pb.DeleteUserRequest{
		Name: apiv1.BuildUserName(user.Username),
	})
	require.Error(t, err)
	require.ErrorContains(t, err, "attachment storage cleanup failed")
	require.ErrorContains(t, err, "attachment_id=")
	require.ErrorContains(t, err, store.ErrDeleteAttachmentStorageFailpoint.Error())

	deletedUser, err := ts.Store.GetUser(ctx, &store.FindUser{ID: &user.ID})
	require.NoError(t, err)
	require.Nil(t, deletedUser)
}
