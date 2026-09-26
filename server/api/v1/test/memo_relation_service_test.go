package test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
)

// link renders the inline reference syntax: a Markdown link to the memo's own path.
func link(label, memoName string) string {
	return fmt.Sprintf("[%s](/%s)", label, memoName)
}

func referencedNames(memo *apiv1.Memo) []string {
	names := make([]string, 0, len(memo.Relations))
	for _, relation := range memo.Relations {
		if relation.Type == apiv1.MemoRelation_REFERENCE && relation.Memo.GetName() == memo.Name {
			names = append(names, relation.RelatedMemo.GetName())
		}
	}
	return names
}

func TestContentReferencesCreateAndDropRelations(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "reference-author")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	target, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{Memo: &apiv1.Memo{Content: "the older card"}})
	require.NoError(t, err)

	// Creating with a link in the text is the only way to make a reference.
	source, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{Content: "building on " + link("Memos", target.Name)},
	})
	require.NoError(t, err)
	require.Equal(t, []string{target.Name}, referencedNames(source))

	// The target learns about it, which is the half that makes this a backlink.
	fetchedTarget, err := ts.Service.GetMemo(userCtx, &apiv1.GetMemoRequest{Name: target.Name})
	require.NoError(t, err)
	require.Len(t, fetchedTarget.Relations, 1)
	require.Equal(t, source.Name, fetchedTarget.Relations[0].Memo.GetName())
	require.Equal(t, target.Name, fetchedTarget.Relations[0].RelatedMemo.GetName())

	// Deleting the link deletes the reference: the two can never disagree.
	updated, err := ts.Service.UpdateMemo(userCtx, &apiv1.UpdateMemoRequest{
		Memo:       &apiv1.Memo{Name: source.Name, Content: "building on nothing"},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"content"}},
	})
	require.NoError(t, err)
	require.Empty(t, referencedNames(updated))

	fetchedTarget, err = ts.Service.GetMemo(userCtx, &apiv1.GetMemoRequest{Name: target.Name})
	require.NoError(t, err)
	require.Empty(t, fetchedTarget.Relations)
}

func TestContentReferencesTolerateLinksThatResolveToNothing(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	author, err := ts.CreateRegularUser(ctx, "lenient-author")
	require.NoError(t, err)
	authorCtx := ts.CreateUserContext(ctx, author.ID)
	stranger, err := ts.CreateRegularUser(ctx, "lenient-stranger")
	require.NoError(t, err)
	strangerCtx := ts.CreateUserContext(ctx, stranger.ID)

	private, err := ts.Service.CreateMemo(strangerCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{Content: "not yours", Visibility: apiv1.Visibility_PRIVATE},
	})
	require.NoError(t, err)
	reachable, err := ts.Service.CreateMemo(authorCtx, &apiv1.CreateMemoRequest{Memo: &apiv1.Memo{Content: "reachable"}})
	require.NoError(t, err)

	// A deleted target, an unreadable one, and a plain external link must not stop a save.
	content := fmt.Sprintf(
		"%s %s %s [site](https://example.com/memos/abc)",
		link("gone", "memos/doesnotexist"),
		link("hidden", private.Name),
		link("Memos", reachable.Name),
	)
	source, err := ts.Service.CreateMemo(authorCtx, &apiv1.CreateMemoRequest{Memo: &apiv1.Memo{Content: content}})
	require.NoError(t, err)
	require.Equal(t, []string{reachable.Name}, referencedNames(source))
}

func TestContentReferencesIgnoreSelfLinksAndDeduplicate(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "self-reference")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	target, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{Memo: &apiv1.Memo{Content: "target"}})
	require.NoError(t, err)
	source, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		MemoId: "self-linking-memo",
		Memo:   &apiv1.Memo{Content: fmt.Sprintf("%s %s", link("once", target.Name), link("twice", target.Name))},
	})
	require.NoError(t, err)
	// Two links to one memo are one reference.
	require.Equal(t, []string{target.Name}, referencedNames(source))

	updated, err := ts.Service.UpdateMemo(userCtx, &apiv1.UpdateMemoRequest{
		Memo:       &apiv1.Memo{Name: source.Name, Content: link("me", source.Name)},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"content"}},
	})
	require.NoError(t, err)
	require.Empty(t, referencedNames(updated))
}

func TestRelationsAreNotClientWritable(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "no-relation-writes")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	target, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{Memo: &apiv1.Memo{Content: "target"}})
	require.NoError(t, err)
	source, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:   "no link in this text",
			Relations: []*apiv1.MemoRelation{{RelatedMemo: &apiv1.MemoRelation_Memo{Name: target.Name}, Type: apiv1.MemoRelation_REFERENCE}},
		},
	})
	require.NoError(t, err)
	// The request asked for a relation the content does not back up, so there is none.
	require.Empty(t, referencedNames(source))

	_, err = ts.Service.UpdateMemo(userCtx, &apiv1.UpdateMemoRequest{
		Memo: &apiv1.Memo{
			Name:      source.Name,
			Relations: []*apiv1.MemoRelation{{RelatedMemo: &apiv1.MemoRelation_Memo{Name: target.Name}, Type: apiv1.MemoRelation_REFERENCE}},
		},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"relations"}},
	})
	require.Equal(t, codes.InvalidArgument, status.Code(err))

	_, err = ts.Service.SetMemoRelations(userCtx, &apiv1.SetMemoRelationsRequest{
		Name:      source.Name,
		Relations: []*apiv1.MemoRelation{{RelatedMemo: &apiv1.MemoRelation_Memo{Name: target.Name}, Type: apiv1.MemoRelation_REFERENCE}},
	})
	require.Equal(t, codes.Unimplemented, status.Code(err))
}
