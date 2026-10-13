package test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/fieldmaskpb"
	"google.golang.org/protobuf/types/known/timestamppb"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
	v1 "github.com/usememos/memos/server/router/api/v1"
)

// Sub-documents are child memos addressed by a reserved folder path,
// "_sub/<parent uid>". These tests pin the properties the rest of the feature
// leans on: the path binds the document to its parent, the parent's knowledge
// base and visibility come with it, the folder tree never shows it, and its
// life is its parent's life.
//
// Requirements: docs/dev/requirements/knowledge-base/sub-documents.md.

// subDocTestFixture creates a user with a knowledge base of their own plus one
// parent document inside it.
func subDocTestFixture(ctx context.Context, t *testing.T, ts *TestService) (context.Context, *apiv1.Workspace, *apiv1.Memo) {
	t.Helper()

	user, err := ts.CreateHostUser(ctx, "subdoc-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	workspace, err := ts.Service.CreateWorkspace(userCtx, &apiv1.CreateWorkspaceRequest{
		Workspace: &apiv1.Workspace{Title: "Sub Doc Library"},
	})
	require.NoError(t, err)

	parent, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Workspace:  workspace.Name,
			Title:      "Parent Doc",
			Content:    "main line content",
			Visibility: apiv1.Visibility_PROTECTED,
		},
	})
	require.NoError(t, err)

	return userCtx, workspace, parent
}

func TestSubDocumentCreateBindsToParent(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	userCtx, workspace, parent := subDocTestFixture(ctx, t, ts)
	parentUID := memoUIDFromName(t, parent.Name)

	// Deliberately no Workspace and no Visibility on the request: both must come
	// from the parent. Without the inheritance an unqualified create resolves to
	// the creator's *default* knowledge base, not the parent's.
	subDoc, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			FolderPath: v1.SubDocFolderPath(parentUID),
			Title:      "Supplementary Notes",
			Content:    "the long tail that does not belong in the body",
		},
	})
	require.NoError(t, err)
	require.Equal(t, parent.Name, subDoc.GetParent(), "the reserved path must bind the document to its parent")
	require.Equal(t, workspace.Name, subDoc.Workspace, "a sub-document belongs to its parent's knowledge base")
	require.Equal(t, apiv1.Visibility_PROTECTED, subDoc.Visibility, "a sub-document is exactly as visible as its parent")
	require.Equal(t, "Supplementary Notes", subDoc.Title, "a sub-document keeps its real title")

	// Excluded from document listings, exactly like a comment.
	listed, err := ts.Service.ListMemos(userCtx, &apiv1.ListMemosRequest{})
	require.NoError(t, err)
	for _, memo := range listed.Memos {
		require.NotEqual(t, subDoc.Name, memo.Name, "a sub-document must never appear in the document list")
	}

	// Reachable as a child of its parent, which is how the References section and
	// memogit find it.
	children, err := ts.Service.ListMemoComments(userCtx, &apiv1.ListMemoCommentsRequest{Name: parent.Name})
	require.NoError(t, err)
	require.Len(t, children.Memos, 1)
	require.Equal(t, subDoc.Name, children.Memos[0].Name)
	require.Equal(t, v1.SubDocFolderPath(parentUID), children.Memos[0].FolderPath,
		"the folder path is the only thing separating a sub-document from a comment")
}

func TestSubDocumentReservedPathRejected(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	userCtx, _, parent := subDocTestFixture(ctx, t, ts)
	parentUID := memoUIDFromName(t, parent.Name)

	// A path under the reserved prefix that does not name exactly one existing
	// parent must be rejected, never quietly created as an ordinary document:
	// that would strand it in a folder the tree never shows, reachable by nothing.
	cases := []struct {
		name       string
		folderPath string
		code       codes.Code
	}{
		{"bare prefix", v1.SubDocFolderPrefix, codes.InvalidArgument},
		{"nested too deep", v1.SubDocFolderPath(parentUID) + "/deeper", codes.InvalidArgument},
		{"unknown parent", v1.SubDocFolderPath("nosuchmemo"), codes.NotFound},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
				Memo: &apiv1.Memo{FolderPath: tc.folderPath, Title: "Stray", Content: "x"},
			})
			require.Error(t, err)
			require.Equal(t, tc.code, status.Code(err))
		})
	}
}

// The reserved path exists to give every parent its own title namespace. Without
// it a sub-document's real title would share the knowledge base root's namespace
// (idx_memo_workspace_folder_title) and collide with top-level documents.
func TestSubDocumentTitleNamespaceIsPerParent(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	userCtx, workspace, parent := subDocTestFixture(ctx, t, ts)
	parentUID := memoUIDFromName(t, parent.Name)

	otherParent, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{Workspace: workspace.Name, Title: "Other Parent", Content: "x"},
	})
	require.NoError(t, err)
	otherParentUID := memoUIDFromName(t, otherParent.Name)

	create := func(folderPath, title string) error {
		_, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
			Memo: &apiv1.Memo{FolderPath: folderPath, Title: title, Content: "x"},
		})
		return err
	}

	require.NoError(t, create(v1.SubDocFolderPath(parentUID), "Appendix"))

	// Same title under the same parent: rejected, which is the constraint we want.
	require.Error(t, create(v1.SubDocFolderPath(parentUID), "Appendix"))

	// Same title under a different parent: fine, the namespaces are separate.
	require.NoError(t, create(v1.SubDocFolderPath(otherParentUID), "Appendix"))

	// Same title as a top-level document: also fine, which is the whole point of
	// not leaving sub-documents at folder_path "".
	_, err = ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{Workspace: workspace.Name, Title: "Appendix", Content: "a real document"},
	})
	require.NoError(t, err)
}

func TestSubDocumentFollowsParentArchiveAndRestore(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	userCtx, _, parent := subDocTestFixture(ctx, t, ts)
	parentUID := memoUIDFromName(t, parent.Name)

	subDoc, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{FolderPath: v1.SubDocFolderPath(parentUID), Title: "Appendix", Content: "x"},
	})
	require.NoError(t, err)

	// A comment on the same parent, to pin that the cascade is about
	// sub-documents only: archiving a document has never meant archiving the
	// discussion about it.
	comment, err := ts.Service.CreateMemoComment(userCtx, &apiv1.CreateMemoCommentRequest{
		Name:    parent.Name,
		Comment: &apiv1.Memo{Content: "a remark"},
	})
	require.NoError(t, err)

	setState := func(name string, state apiv1.State) {
		t.Helper()
		_, err := ts.Service.UpdateMemo(userCtx, &apiv1.UpdateMemoRequest{
			Memo:       &apiv1.Memo{Name: name, State: state},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"state"}},
		})
		require.NoError(t, err)
	}
	stateOf := func(name string) apiv1.State {
		t.Helper()
		memo, err := ts.Service.GetMemo(userCtx, &apiv1.GetMemoRequest{Name: name})
		require.NoError(t, err)
		return memo.State
	}

	setState(parent.Name, apiv1.State_ARCHIVED)
	require.Equal(t, apiv1.State_ARCHIVED, stateOf(subDoc.Name), "a sub-document follows its parent into the recycle bin")
	require.Equal(t, apiv1.State_NORMAL, stateOf(comment.Name), "a comment does not")

	setState(parent.Name, apiv1.State_NORMAL)
	require.Equal(t, apiv1.State_NORMAL, stateOf(subDoc.Name), "and comes back out with it")
}

func TestSubDocumentDeletedWithParent(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	userCtx, _, parent := subDocTestFixture(ctx, t, ts)
	parentUID := memoUIDFromName(t, parent.Name)

	subDoc, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{FolderPath: v1.SubDocFolderPath(parentUID), Title: "Appendix", Content: "x"},
	})
	require.NoError(t, err)

	_, err = ts.Service.DeleteMemo(userCtx, &apiv1.DeleteMemoRequest{Name: parent.Name})
	require.NoError(t, err)

	_, err = ts.Service.GetMemo(userCtx, &apiv1.GetMemoRequest{Name: subDoc.Name})
	require.Error(t, err, "a sub-document has no life of its own once its parent is gone")
	require.Equal(t, codes.NotFound, status.Code(err))
}

func TestSubDocumentCannotBeMoved(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	userCtx, _, parent := subDocTestFixture(ctx, t, ts)
	parentUID := memoUIDFromName(t, parent.Name)

	subDoc, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{FolderPath: v1.SubDocFolderPath(parentUID), Title: "Appendix", Content: "x"},
	})
	require.NoError(t, err)

	// Its folder path is its binding to its parent, not a location a user picked.
	_, err = ts.Service.UpdateMemo(userCtx, &apiv1.UpdateMemoRequest{
		Memo:       &apiv1.Memo{Name: subDoc.Name, FolderPath: "notes"},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"folder_path"}},
	})
	require.Error(t, err)
	require.Equal(t, codes.InvalidArgument, status.Code(err))

	// Nor can it leave its parent's knowledge base on its own.
	otherWorkspace, err := ts.Service.CreateWorkspace(userCtx, &apiv1.CreateWorkspaceRequest{
		Workspace: &apiv1.Workspace{Title: "Elsewhere"},
	})
	require.NoError(t, err)
	_, err = ts.Service.UpdateMemo(userCtx, &apiv1.UpdateMemoRequest{
		Memo:       &apiv1.Memo{Name: subDoc.Name, Workspace: otherWorkspace.Name},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"workspace"}},
	})
	require.Error(t, err)
	require.Equal(t, codes.InvalidArgument, status.Code(err))

	// Restating the path it already has is not a move: memogit sends folder
	// path and title together when it renames one.
	renamed, err := ts.Service.UpdateMemo(userCtx, &apiv1.UpdateMemoRequest{
		Memo:       &apiv1.Memo{Name: subDoc.Name, FolderPath: v1.SubDocFolderPath(parentUID), Title: "Appendix A"},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"folder_path", "title"}},
	})
	require.NoError(t, err)
	require.Equal(t, "Appendix A", renamed.Title)
	require.Equal(t, parent.Name, renamed.GetParent())

	// The other direction — an ordinary document moved INTO the namespace — is
	// an in-place attach; see TestSubDocumentAttachInPlace.

	// Content edits are unaffected — modifying a sub-document heavily is the
	// intended alternative to deleting one.
	updated, err := ts.Service.UpdateMemo(userCtx, &apiv1.UpdateMemoRequest{
		Memo:       &apiv1.Memo{Name: subDoc.Name, Content: "rewritten from scratch"},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"content"}},
	})
	require.NoError(t, err)
	require.Equal(t, "rewritten from scratch", updated.Content)
}

// A parent and its sub-documents are one document as far as the P1 reference
// guard is concerned: the links between them are internal, so neither blocks the
// other from being archived. Links from anywhere else still block.
func TestSubDocumentInternalReferencesDoNotBlockArchive(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	userCtx, workspace, parent := subDocTestFixture(ctx, t, ts)
	parentUID := memoUIDFromName(t, parent.Name)

	subDoc, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			FolderPath: v1.SubDocFolderPath(parentUID),
			Title:      "Appendix",
			// The sub-document links back up to its parent.
			Content: "see [Parent Doc](/memos/" + parentUID + ")",
		},
	})
	require.NoError(t, err)
	subDocUID := memoUIDFromName(t, subDoc.Name)

	// And the parent links down to the sub-document, which is what the body's
	// footnote-style reference compiles to.
	_, err = ts.Service.UpdateMemo(userCtx, &apiv1.UpdateMemoRequest{
		Memo:       &apiv1.Memo{Name: parent.Name, Content: "main line, see [Appendix](/memos/" + subDocUID + ")"},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"content"}},
	})
	require.NoError(t, err)

	archive := func(name string) error {
		_, err := ts.Service.UpdateMemo(userCtx, &apiv1.UpdateMemoRequest{
			Memo:       &apiv1.Memo{Name: name, State: apiv1.State_ARCHIVED},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"state"}},
		})
		return err
	}

	// The parent's link down must not keep its own sub-document from being put away.
	require.NoError(t, archive(subDoc.Name))
	// Restore, then check the other direction.
	_, err = ts.Service.UpdateMemo(userCtx, &apiv1.UpdateMemoRequest{
		Memo:       &apiv1.Memo{Name: subDoc.Name, State: apiv1.State_NORMAL},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"state"}},
	})
	require.NoError(t, err)

	// The sub-document's link up must not keep the parent from being archived.
	require.NoError(t, archive(parent.Name))

	// A link from an unrelated document still blocks, which is the guard's job.
	_, err = ts.Service.UpdateMemo(userCtx, &apiv1.UpdateMemoRequest{
		Memo:       &apiv1.Memo{Name: parent.Name, State: apiv1.State_NORMAL},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"state"}},
	})
	require.NoError(t, err)
	_, err = ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Workspace: workspace.Name,
			Title:     "Outsider",
			Content:   "see [Parent Doc](/memos/" + parentUID + ")",
		},
	})
	require.NoError(t, err)
	require.Error(t, archive(parent.Name), "an outside reference must still block archiving")
}

// A sub-document write moves its parent's updated_ts. That is the product rule
// ("a sub-document is part of the document") made mechanical, and it is what
// lets an incremental mirror — memogit selects on updated_ts — notice a
// sub-document that changed while its parent sat still.
func TestSubDocumentWriteTouchesParent(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	userCtx, _, parent := subDocTestFixture(ctx, t, ts)
	parentUID := memoUIDFromName(t, parent.Name)

	// Park the parent's updated_ts in the past before each act, so the assertion
	// does not depend on two writes landing in different whole seconds.
	backdate := func() int64 {
		t.Helper()
		past := time.Now().Add(-time.Hour)
		updated, err := ts.Service.UpdateMemo(userCtx, &apiv1.UpdateMemoRequest{
			Memo:       &apiv1.Memo{Name: parent.Name, UpdateTime: timestamppb.New(past)},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"update_time"}},
		})
		require.NoError(t, err)
		return updated.UpdateTime.AsTime().Unix()
	}
	parentUpdatedTs := func() int64 {
		t.Helper()
		memo, err := ts.Service.GetMemo(userCtx, &apiv1.GetMemoRequest{Name: parent.Name})
		require.NoError(t, err)
		return memo.UpdateTime.AsTime().Unix()
	}

	// Creating one.
	before := backdate()
	subDoc, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{FolderPath: v1.SubDocFolderPath(parentUID), Title: "Appendix", Content: "x"},
	})
	require.NoError(t, err)
	require.Greater(t, parentUpdatedTs(), before, "creating a sub-document updates its parent")

	// Editing one.
	before = backdate()
	_, err = ts.Service.UpdateMemo(userCtx, &apiv1.UpdateMemoRequest{
		Memo:       &apiv1.Memo{Name: subDoc.Name, Content: "rewritten"},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"content"}},
	})
	require.NoError(t, err)
	require.Greater(t, parentUpdatedTs(), before, "editing a sub-document updates its parent")

	// A comment must NOT: it is a discussion about the document, not content of it.
	before = backdate()
	_, err = ts.Service.CreateMemoComment(userCtx, &apiv1.CreateMemoCommentRequest{
		Name:    parent.Name,
		Comment: &apiv1.Memo{Content: "a remark"},
	})
	require.NoError(t, err)
	require.Equal(t, before, parentUpdatedTs(), "a comment leaves its parent's timestamp alone")

	// Removing one.
	before = backdate()
	_, err = ts.Service.DeleteMemo(userCtx, &apiv1.DeleteMemoRequest{Name: subDoc.Name})
	require.NoError(t, err)
	require.Greater(t, parentUpdatedTs(), before, "removing a sub-document updates its parent")
}

func TestListMemosIncludeSubDocs(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	userCtx, workspace, parent := subDocTestFixture(ctx, t, ts)
	parentUID := memoUIDFromName(t, parent.Name)

	subDoc, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{FolderPath: v1.SubDocFolderPath(parentUID), Title: "Appendix", Content: "long tail"},
	})
	require.NoError(t, err)
	// A plain comment shares the relation but must never come back as a sub-document.
	_, err = ts.Service.CreateMemoComment(userCtx, &apiv1.CreateMemoCommentRequest{
		Name:    parent.Name,
		Comment: &apiv1.Memo{Content: "a remark", Visibility: apiv1.Visibility_PROTECTED},
	})
	require.NoError(t, err)
	// A second parent the filter leaves out: its sub-document must not ride along.
	other, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{Workspace: workspace.Name, Title: "Other Doc", Content: "unrelated", Visibility: apiv1.Visibility_PROTECTED},
	})
	require.NoError(t, err)
	_, err = ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{FolderPath: v1.SubDocFolderPath(memoUIDFromName(t, other.Name)), Title: "Hidden", Content: "x"},
	})
	require.NoError(t, err)

	listed, err := ts.Service.ListMemos(userCtx, &apiv1.ListMemosRequest{
		Workspace:      workspace.Name,
		Filter:         `content.contains("main line")`,
		IncludeSubDocs: true,
	})
	require.NoError(t, err)
	require.True(t, listed.SubDocsIncluded)
	require.Len(t, listed.Memos, 1)
	require.Equal(t, parent.Name, listed.Memos[0].Name, "sub-documents stay out of the document list itself")
	require.Len(t, listed.SubDocs, 1, "only the selected parent's sub-documents, and no comments")
	require.Equal(t, subDoc.Name, listed.SubDocs[0].Name)
	require.Equal(t, parent.Name, listed.SubDocs[0].GetParent())

	plain, err := ts.Service.ListMemos(userCtx, &apiv1.ListMemosRequest{Workspace: workspace.Name})
	require.NoError(t, err)
	require.False(t, plain.SubDocsIncluded)
	require.Empty(t, plain.SubDocs)
}
