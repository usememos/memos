package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
)

func TestCreateMemoAutoCreatesRelationsFromMarkdownMemosLinks(t *testing.T) {
	ctx := context.Background()

	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	// Create the target memo to reference.
	target, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "Target memo",
			Visibility: apiv1.Visibility_PRIVATE,
		},
	})
	require.NoError(t, err)
	require.NotNil(t, target)

	// Create a memo referencing the target via an internal memos/<id> link.
	source, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "See [target](" + target.Name + ")",
			Visibility: apiv1.Visibility_PRIVATE,
		},
	})
	require.NoError(t, err)
	require.NotNil(t, source)

	// Verify the relation exists.
	rels, err := ts.Service.ListMemoRelations(userCtx, &apiv1.ListMemoRelationsRequest{Name: source.Name})
	require.NoError(t, err)
	require.NotNil(t, rels)

	found := false
	for _, r := range rels.Relations {
		if r.Type == apiv1.MemoRelation_REFERENCE && r.RelatedMemo != nil && r.RelatedMemo.Name == target.Name {
			found = true
			break
		}
	}
	require.True(t, found, "expected REFERENCE relation to be created from markdown link")
}
