package test

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func TestDeleteMemoShare_VerifiesShareBelongsToMemo(t *testing.T) {
	ctx := context.Background()

	ts := NewTestService(t)
	defer ts.Cleanup()

	userOne, err := ts.CreateRegularUser(ctx, "share-owner-one")
	require.NoError(t, err)
	userTwo, err := ts.CreateRegularUser(ctx, "share-owner-two")
	require.NoError(t, err)

	userOneCtx := ts.CreateUserContext(ctx, userOne.ID)
	userTwoCtx := ts.CreateUserContext(ctx, userTwo.ID)

	memoOne, err := ts.Service.CreateMemo(userOneCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "memo one",
			Visibility: apiv1.Visibility_PRIVATE,
		},
	})
	require.NoError(t, err)

	memoTwo, err := ts.Service.CreateMemo(userTwoCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "memo two",
			Visibility: apiv1.Visibility_PRIVATE,
		},
	})
	require.NoError(t, err)

	share, err := ts.Service.CreateMemoShare(userTwoCtx, &apiv1.CreateMemoShareRequest{
		Parent:    memoTwo.Name,
		MemoShare: &apiv1.MemoShare{},
	})
	require.NoError(t, err)

	shareToken := share.Name[strings.LastIndex(share.Name, "/")+1:]
	forgedName := memoOne.Name + "/shares/" + shareToken

	_, err = ts.Service.DeleteMemoShare(userOneCtx, &apiv1.DeleteMemoShareRequest{
		Name: forgedName,
	})
	require.Error(t, err)
	require.Equal(t, codes.NotFound, status.Code(err))

	sharedMemo, err := ts.Service.GetSharedMemo(ctx, &apiv1.GetSharedMemoRequest{
		ShareToken: shareToken,
	})
	require.NoError(t, err)
	require.Equal(t, memoTwo.Name, sharedMemo.Name)
}

func TestDeleteMemoShare_RevalidatesSpaceWriteAuthority(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "share-space-owner")
	require.NoError(t, err)
	admin, err := ts.CreateRegularUser(ctx, "share-space-admin")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)
	space, err := ts.Store.CreateSpace(ctx, &store.Space{UID: "share-space", Title: "Share Space"}, owner.ID)
	require.NoError(t, err)
	_, err = ts.InviteAndAcceptSpaceMember(ctx, &store.SpaceMember{
		SpaceID: space.ID, UserID: admin.ID, Role: store.SpaceMemberRoleAdmin,
	}, owner.ID)
	require.NoError(t, err)
	memo, err := ts.Service.CreateMemo(ownerCtx, &apiv1.CreateMemoRequest{Memo: &apiv1.Memo{
		Content: "assigned share", Visibility: apiv1.Visibility_PUBLIC, Space: ptr("spaces/" + space.UID),
	}})
	require.NoError(t, err)
	share, err := ts.Service.CreateMemoShare(ownerCtx, &apiv1.CreateMemoShareRequest{Parent: memo.Name, MemoShare: &apiv1.MemoShare{}})
	require.NoError(t, err)
	shareToken := share.Name[strings.LastIndex(share.Name, "/")+1:]

	require.NoError(t, ts.Store.DeleteSpaceMember(ctx, &store.DeleteSpaceMember{SpaceID: space.ID, UserID: owner.ID}, admin.ID))
	_, err = ts.Service.DeleteMemoShare(ownerCtx, &apiv1.DeleteMemoShareRequest{Name: share.Name})
	require.Equal(t, codes.PermissionDenied, status.Code(err))
	requireSharePresent(ctx, t, ts, shareToken)

	_, err = ts.InviteAndAcceptSpaceMember(ctx, &store.SpaceMember{
		SpaceID: space.ID, UserID: owner.ID, Role: store.SpaceMemberRoleUser,
	}, admin.ID)
	require.NoError(t, err)
	_, err = ts.Service.DeleteMemoShare(ownerCtx, &apiv1.DeleteMemoShareRequest{Name: share.Name})
	require.NoError(t, err)
	storedShare, err := ts.Store.GetMemoShare(ctx, &store.FindMemoShare{UID: &shareToken})
	require.NoError(t, err)
	require.Nil(t, storedShare)
}

func TestDeleteMemoShare_OwnerCanRevokeLegacyAdminShare(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "legacy-share-owner")
	require.NoError(t, err)
	legacyAdmin, err := ts.CreateHostUser(ctx, "legacy-share-admin")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)

	memo, err := ts.Service.CreateMemo(ownerCtx, &apiv1.CreateMemoRequest{Memo: &apiv1.Memo{
		Content:    "memo with a legacy admin share",
		Visibility: apiv1.Visibility_PRIVATE,
	}})
	require.NoError(t, err)
	memoUID := strings.TrimPrefix(memo.Name, "memos/")
	storedMemo, err := ts.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	require.NoError(t, err)
	require.NotNil(t, storedMemo)

	const shareToken = "legacy-admin-created-share"
	_, err = ts.Store.CreateMemoShare(ctx, &store.MemoShare{
		UID:       shareToken,
		MemoID:    storedMemo.ID,
		CreatorID: legacyAdmin.ID,
	})
	require.NoError(t, err)

	_, err = ts.Service.DeleteMemoShare(ownerCtx, &apiv1.DeleteMemoShareRequest{
		Name: memo.Name + "/shares/" + shareToken,
	})
	require.NoError(t, err)

	share, err := ts.Store.GetMemoShare(ctx, &store.FindMemoShare{UID: ptr(shareToken)})
	require.NoError(t, err)
	require.Nil(t, share)
	_, err = ts.Service.GetSharedMemo(ctx, &apiv1.GetSharedMemoRequest{ShareToken: shareToken})
	require.Equal(t, codes.NotFound, status.Code(err))
}

func TestGetSharedMemo_IncludesReactions(t *testing.T) {
	ctx := context.Background()

	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "share-reactions")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	memo, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "memo with reactions",
			Visibility: apiv1.Visibility_PRIVATE,
		},
	})
	require.NoError(t, err)

	reaction, err := ts.Service.UpsertMemoReaction(userCtx, &apiv1.UpsertMemoReactionRequest{
		Name: memo.Name,
		Reaction: &apiv1.Reaction{
			ReactionType: "👍",
		},
	})
	require.NoError(t, err)
	require.NotNil(t, reaction)

	share, err := ts.Service.CreateMemoShare(userCtx, &apiv1.CreateMemoShareRequest{
		Parent:    memo.Name,
		MemoShare: &apiv1.MemoShare{},
	})
	require.NoError(t, err)

	shareToken := share.Name[strings.LastIndex(share.Name, "/")+1:]
	sharedMemo, err := ts.Service.GetSharedMemo(ctx, &apiv1.GetSharedMemoRequest{
		ShareToken: shareToken,
	})
	require.NoError(t, err)
	require.Len(t, sharedMemo.Reactions, 1)
	require.Equal(t, "👍", sharedMemo.Reactions[0].ReactionType)
	require.Equal(t, reaction.Name, sharedMemo.Reactions[0].Name)
}

func TestCreateMemoShare_SharesOnlyTheCommentMemo(t *testing.T) {
	ctx := context.Background()

	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "share-single-memo")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	parent, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "parent must not be shared",
			Visibility: apiv1.Visibility_PRIVATE,
		},
	})
	require.NoError(t, err)

	comment, err := ts.Service.CreateMemoComment(userCtx, &apiv1.CreateMemoCommentRequest{
		Name: parent.Name,
		Comment: &apiv1.Memo{
			Content:    "only this memo is shared",
			Visibility: apiv1.Visibility_PRIVATE,
		},
	})
	require.NoError(t, err)
	require.NotEmpty(t, comment.Relations)

	regularMemo, err := ts.Service.GetMemo(userCtx, &apiv1.GetMemoRequest{Name: comment.Name})
	require.NoError(t, err)
	require.NotEmpty(t, regularMemo.GetParent())
	require.NotEmpty(t, regularMemo.Relations)

	share, err := ts.Service.CreateMemoShare(userCtx, &apiv1.CreateMemoShareRequest{
		Parent:    comment.Name,
		MemoShare: &apiv1.MemoShare{},
	})
	require.NoError(t, err)
	shareToken := share.Name[strings.LastIndex(share.Name, "/")+1:]
	sharedComment, err := ts.Service.GetSharedMemo(ctx, &apiv1.GetSharedMemoRequest{ShareToken: shareToken})
	require.NoError(t, err)
	require.Equal(t, comment.Name, sharedComment.Name)
	require.Equal(t, "only this memo is shared", sharedComment.Content)
	require.Empty(t, sharedComment.GetParent())
	require.Empty(t, sharedComment.Relations)
}

func TestGetSharedMemo_SkipsReactionsWithMissingCreators(t *testing.T) {
	ctx := context.Background()

	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "share-owner")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)

	reactor, err := ts.CreateRegularUser(ctx, "share-reaction-orphan")
	require.NoError(t, err)
	reactorCtx := ts.CreateUserContext(ctx, reactor.ID)

	memo, err := ts.Service.CreateMemo(ownerCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "memo with orphan share reaction",
			Visibility: apiv1.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	_, err = ts.Service.UpsertMemoReaction(reactorCtx, &apiv1.UpsertMemoReactionRequest{
		Name: memo.Name,
		Reaction: &apiv1.Reaction{
			ReactionType: "👍",
		},
	})
	require.NoError(t, err)

	share, err := ts.Service.CreateMemoShare(ownerCtx, &apiv1.CreateMemoShareRequest{
		Parent:    memo.Name,
		MemoShare: &apiv1.MemoShare{},
	})
	require.NoError(t, err)

	_, err = ts.Store.DeleteUser(ctx, &store.DeleteUser{ID: reactor.ID})
	require.NoError(t, err)

	shareToken := share.Name[strings.LastIndex(share.Name, "/")+1:]
	sharedMemo, err := ts.Service.GetSharedMemo(ctx, &apiv1.GetSharedMemoRequest{
		ShareToken: shareToken,
	})
	require.NoError(t, err)
	require.Empty(t, sharedMemo.Reactions)
}

func TestGetSharedMemo_ReturnsNotFoundForUnknownShare(t *testing.T) {
	ctx := context.Background()

	ts := NewTestService(t)
	defer ts.Cleanup()

	_, err := ts.Service.GetSharedMemo(ctx, &apiv1.GetSharedMemoRequest{
		ShareToken: "missing-share-token",
	})
	require.Error(t, err)
	require.Equal(t, codes.NotFound, status.Code(err))
}

func TestGetSharedMemo_ReturnsNotFoundForExpiredShare(t *testing.T) {
	ctx := context.Background()

	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "share-expired")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	memo, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "memo with expired share",
			Visibility: apiv1.Visibility_PRIVATE,
		},
	})
	require.NoError(t, err)

	expiredTsSec := time.Now().Add(-time.Hour).Unix()
	expiredShare, err := ts.Store.CreateMemoShare(ctx, &store.MemoShare{
		UID:       "expired-share-token",
		MemoID:    parseMemoIDFromNameForTest(t, ts, memo.Name),
		CreatorID: user.ID,
		ExpiresTs: &expiredTsSec,
	})
	require.NoError(t, err)

	_, err = ts.Service.GetSharedMemo(ctx, &apiv1.GetSharedMemoRequest{
		ShareToken: expiredShare.UID,
	})
	require.Error(t, err)
	require.Equal(t, codes.NotFound, status.Code(err))
}

func TestGetSharedMemo_ReturnsNotFoundForArchivedMemo(t *testing.T) {
	ctx := context.Background()

	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "share-archived")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	memoResp, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "memo that will be archived",
			Visibility: apiv1.Visibility_PRIVATE,
		},
	})
	require.NoError(t, err)

	share, err := ts.Service.CreateMemoShare(userCtx, &apiv1.CreateMemoShareRequest{
		Parent:    memoResp.Name,
		MemoShare: &apiv1.MemoShare{},
	})
	require.NoError(t, err)

	memoID := parseMemoIDFromNameForTest(t, ts, memoResp.Name)
	memo, err := ts.Store.GetMemo(ctx, &store.FindMemo{ID: &memoID})
	require.NoError(t, err)
	require.NotNil(t, memo)

	archived := store.Archived
	err = ts.Store.UpdateMemo(ctx, &store.UpdateMemo{
		ID:        memo.ID,
		RowStatus: &archived,
	})
	require.NoError(t, err)

	shareToken := share.Name[strings.LastIndex(share.Name, "/")+1:]
	_, err = ts.Service.GetSharedMemo(ctx, &apiv1.GetSharedMemoRequest{
		ShareToken: shareToken,
	})
	require.Error(t, err)
	require.Equal(t, codes.NotFound, status.Code(err))
}

func parseMemoIDFromNameForTest(t *testing.T, ts *TestService, memoName string) int32 {
	t.Helper()

	memoUID, ok := strings.CutPrefix(memoName, "memos/")
	require.True(t, ok, "memo name must start with memos/: %s", memoName)

	memo, err := ts.Store.GetMemo(context.Background(), &store.FindMemo{UID: &memoUID})
	require.NoError(t, err)
	require.NotNil(t, memo)

	return memo.ID
}

func requireSharePresent(ctx context.Context, t *testing.T, ts *TestService, token string) {
	t.Helper()
	share, err := ts.Store.GetMemoShare(ctx, &store.FindMemoShare{UID: &token})
	require.NoError(t, err)
	require.NotNil(t, share)
}
