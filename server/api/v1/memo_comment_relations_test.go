package v1

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

// TestCreateMemoComment_ReturnsParentRelation verifies that the memo returned by
// CreateMemoComment carries the COMMENT relation to its parent memo. The comment
// memo is converted before the relation is created, so without an explicit reload
// the returned memo (and the memo.comment.created webhook payload built from it)
// would have an empty Relations slice. Regression test for usememos/memos#6081.
func TestCreateMemoComment_ReturnsParentRelation(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)

	author, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "author", Role: store.RoleAdmin, Email: "author@example.com",
	})
	require.NoError(t, err)
	authorCtx := userCtx(ctx, author.ID)

	parent, err := svc.CreateMemo(authorCtx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{Content: "parent memo", Visibility: v1pb.Visibility_PUBLIC},
	})
	require.NoError(t, err)

	comment, err := svc.CreateMemoComment(authorCtx, &v1pb.CreateMemoCommentRequest{
		Name:    parent.Name,
		Comment: &v1pb.Memo{Content: "a comment", Visibility: v1pb.Visibility_PUBLIC},
	})
	require.NoError(t, err)

	require.Len(t, comment.Relations, 1, "comment memo should carry its parent relation")
	rel := comment.Relations[0]
	assert.Equal(t, v1pb.MemoRelation_COMMENT, rel.Type)
	require.NotNil(t, rel.Memo)
	require.NotNil(t, rel.RelatedMemo)
	assert.Equal(t, comment.Name, rel.Memo.Name)
	assert.Equal(t, parent.Name, rel.RelatedMemo.Name)
}
