package api

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	apipb "github.com/usememos/memos/proto/gen/api"
	"github.com/usememos/memos/store"
)

// TestCreateMemo_CommentReturnsParent verifies that a memo created with a
// parent is returned as a comment on it: the response (and the
// memo.comment.created webhook payload built from the same memo) names the
// parent, the link is not repeated as a relation, and the parent counts the
// comment. Regression test for usememos/memos#6081.
func TestCreateMemo_CommentReturnsParent(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)

	author, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "author", Role: store.RoleAdmin, Email: "author@example.com",
	})
	require.NoError(t, err)
	authorCtx := userCtx(ctx, author.ID)

	parent, err := svc.CreateMemo(authorCtx, &apipb.CreateMemoRequest{
		Memo: &apipb.Memo{Content: "parent memo", Visibility: apipb.Visibility_PUBLIC},
	})
	require.NoError(t, err)

	comment, err := svc.CreateMemo(authorCtx, &apipb.CreateMemoRequest{
		Memo: &apipb.Memo{Parent: new(parent.Name), Content: "a comment", Visibility: apipb.Visibility_PUBLIC},
	})
	require.NoError(t, err)

	assert.Equal(t, parent.Name, comment.GetParent(), "comment memo should name its parent")
	assert.Empty(t, comment.Relations, "the parent link is not a relation")
	assert.Zero(t, comment.CommentCount)

	reloadedComment, err := svc.GetMemo(authorCtx, &apipb.GetMemoRequest{Name: comment.Name})
	require.NoError(t, err)
	assert.Equal(t, parent.Name, reloadedComment.GetParent())
	assert.Empty(t, reloadedComment.Relations)

	reloadedParent, err := svc.GetMemo(authorCtx, &apipb.GetMemoRequest{Name: parent.Name})
	require.NoError(t, err)
	assert.Nil(t, reloadedParent.Parent)
	assert.Empty(t, reloadedParent.Relations)
	assert.EqualValues(t, 1, reloadedParent.CommentCount)
}
