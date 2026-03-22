package test

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
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

	sharedMemo, err := ts.Service.GetMemoByShare(ctx, &apiv1.GetMemoByShareRequest{
		ShareId: shareToken,
	})
	require.NoError(t, err)
	require.Equal(t, memoTwo.Name, sharedMemo.Name)
}

func TestGetMemoByShare_IncludesReactions(t *testing.T) {
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
			ContentId:    memo.Name,
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
	sharedMemo, err := ts.Service.GetMemoByShare(ctx, &apiv1.GetMemoByShareRequest{
		ShareId: shareToken,
	})
	require.NoError(t, err)
	require.Len(t, sharedMemo.Reactions, 1)
	require.Equal(t, "👍", sharedMemo.Reactions[0].ReactionType)
	require.Equal(t, memo.Name, sharedMemo.Reactions[0].ContentId)
}
