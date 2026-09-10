package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func TestMoveMemoPreservesIndependentConversation(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()
	author, err := ts.CreateRegularUser(ctx, "move-author")
	require.NoError(t, err)
	commenter, err := ts.CreateRegularUser(ctx, "move-commenter")
	require.NoError(t, err)
	reader, err := ts.CreateRegularUser(ctx, "move-reader")
	require.NoError(t, err)
	authorCtx := ts.CreateUserContext(ctx, author.ID)
	commenterCtx := ts.CreateUserContext(ctx, commenter.ID)
	readerCtx := ts.CreateUserContext(ctx, reader.ID)
	source, err := ts.Store.CreateSpace(ctx, &store.Space{UID: "move-source", Title: "Source"}, author.ID)
	require.NoError(t, err)
	target, err := ts.Store.CreateSpace(ctx, &store.Space{UID: "move-target", Title: "Target"}, author.ID)
	require.NoError(t, err)
	for _, member := range []*store.SpaceMember{
		{SpaceID: source.ID, UserID: commenter.ID, Role: store.SpaceMemberRoleUser},
		{SpaceID: target.ID, UserID: reader.ID, Role: store.SpaceMemberRoleUser},
	} {
		_, err := ts.InviteAndAcceptSpaceMember(ctx, member, author.ID)
		require.NoError(t, err)
	}
	sourceName, targetName := "spaces/"+source.UID, "spaces/"+target.UID
	reference, err := ts.Service.CreateMemo(authorCtx, &apiv1.CreateMemoRequest{Memo: &apiv1.Memo{
		Content: "source reference", Space: &sourceName, Visibility: apiv1.Visibility_SPACE,
	}})
	require.NoError(t, err)
	attachment, err := ts.Service.CreateAttachment(authorCtx, &apiv1.CreateAttachmentRequest{
		Attachment: &apiv1.Attachment{Filename: "proposal.txt", Type: "text/plain", Content: []byte("proposal attachment")},
	})
	require.NoError(t, err)
	original, err := ts.Service.CreateMemo(authorCtx, &apiv1.CreateMemoRequest{Memo: &apiv1.Memo{
		Content: "original memo", Space: &sourceName, Visibility: apiv1.Visibility_SPACE,
		Attachments: []*apiv1.Attachment{attachment},
		Relations:   []*apiv1.MemoRelation{{Type: apiv1.MemoRelation_REFERENCE, RelatedMemo: &apiv1.MemoRelation_Memo{Name: reference.Name}}},
	}})
	require.NoError(t, err)
	comment, err := ts.Service.CreateMemoComment(commenterCtx, &apiv1.CreateMemoCommentRequest{
		Name: original.Name, Comment: &apiv1.Memo{Content: "source comment", Space: &sourceName, Visibility: apiv1.Visibility_SPACE},
	})
	require.NoError(t, err)
	reaction, err := ts.Service.UpsertMemoReaction(commenterCtx, &apiv1.UpsertMemoReactionRequest{
		Name: original.Name, Reaction: &apiv1.Reaction{ReactionType: "👍"},
	})
	require.NoError(t, err)

	moved, err := ts.Service.UpdateMemo(authorCtx, &apiv1.UpdateMemoRequest{
		Memo:       &apiv1.Memo{Name: original.Name, Space: &targetName, Visibility: apiv1.Visibility_SPACE},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"space", "visibility"}},
	})
	require.NoError(t, err)
	require.Equal(t, original.Name, moved.Name)
	require.Equal(t, original.Creator, moved.Creator)
	require.Equal(t, original.CreateTime, moved.CreateTime)
	require.Equal(t, original.UpdateTime, moved.UpdateTime)
	require.Equal(t, original.Content, moved.Content)
	require.Len(t, moved.Attachments, 1)
	require.Equal(t, original.Attachments, moved.Attachments)
	require.Len(t, moved.Relations, 2, "the author in both Spaces retains references and comments")
	require.Len(t, moved.Reactions, 1)
	require.Equal(t, reaction.Name, moved.Reactions[0].Name)

	_, err = ts.Service.GetMemo(commenterCtx, &apiv1.GetMemoRequest{Name: original.Name})
	require.Equal(t, codes.PermissionDenied, status.Code(err))
	readableComment, err := ts.Service.GetMemo(commenterCtx, &apiv1.GetMemoRequest{Name: comment.Name})
	require.NoError(t, err)
	require.Equal(t, original.Name, readableComment.GetParent(), "parent identity survives lost parent access")
	require.Equal(t, sourceName, readableComment.GetSpace())
	require.Equal(t, comment.Visibility, readableComment.Visibility)
	require.Equal(t, comment.Content, readableComment.Content)
	require.Empty(t, readableComment.Relations, "the inaccessible parent must not appear in relation previews")

	for _, viewer := range []context.Context{authorCtx, readerCtx} {
		comments, err := ts.Service.ListMemoComments(viewer, &apiv1.ListMemoCommentsRequest{Name: original.Name})
		require.NoError(t, err)
		if viewer == authorCtx {
			require.Len(t, comments.Memos, 1)
		} else {
			require.Empty(t, comments.Memos)
		}
	}
	destinationMemo, err := ts.Service.GetMemo(readerCtx, &apiv1.GetMemoRequest{Name: original.Name})
	require.NoError(t, err)
	require.Empty(t, destinationMemo.Relations)
	require.Len(t, destinationMemo.Reactions, 1, "existing reactions are visible to new readers")
	_, err = ts.Service.GetMemo(readerCtx, &apiv1.GetMemoRequest{Name: comment.Name})
	require.Equal(t, codes.PermissionDenied, status.Code(err))
	_, err = ts.Service.DeleteMemoReaction(readerCtx, &apiv1.DeleteMemoReactionRequest{Name: reaction.Name})
	require.Equal(t, codes.PermissionDenied, status.Code(err))
	_, err = ts.Service.DeleteMemoReaction(commenterCtx, &apiv1.DeleteMemoReactionRequest{Name: reaction.Name})
	require.NoError(t, err, "the creator can withdraw a reaction without parent access")
	reactions, err := ts.Service.ListMemoReactions(readerCtx, &apiv1.ListMemoReactionsRequest{Name: original.Name})
	require.NoError(t, err)
	require.Empty(t, reactions.Reactions)
}
