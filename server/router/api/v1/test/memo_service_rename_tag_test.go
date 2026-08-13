package test

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestRenameMemoTagRequiresAuthentication(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	resp, err := ts.Service.RenameMemoTag(ctx, &apiv1.RenameMemoTagRequest{
		OldTag: "old",
		NewTag: "new",
	})
	require.Nil(t, resp)
	require.Equal(t, codes.Unauthenticated, status.Code(err))
}

func TestRenameMemoTagValidation(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "test-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	tests := []struct {
		name   string
		oldTag string
		newTag string
	}{
		{"empty old_tag", "", "new"},
		{"empty new_tag", "old", ""},
		{"whitespace padded old_tag", " old ", "new"},
		{"whitespace padded new_tag", "old", " new"},
		{"leading hash old_tag", "#old", "new"},
		{"leading hash new_tag", "old", "#new"},
		{"identical names", "same", "same"},
		{"invalid rune old_tag", "old tag", "new"},
		{"invalid rune new_tag", "old", "new.tag"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := ts.Service.RenameMemoTag(userCtx, &apiv1.RenameMemoTagRequest{
				OldTag: tt.oldTag,
				NewTag: tt.newTag,
			})
			require.Nil(t, resp)
			require.Equal(t, codes.InvalidArgument, status.Code(err))
		})
	}
}

func TestRenameMemoTagZeroMatches(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "test-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	_, err = ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{Content: "#unrelated content", Visibility: apiv1.Visibility_PRIVATE},
	})
	require.NoError(t, err)

	resp, err := ts.Service.RenameMemoTag(userCtx, &apiv1.RenameMemoTagRequest{OldTag: "todo", NewTag: "done"})
	require.NoError(t, err)
	require.Equal(t, int32(0), resp.UpdatedMemoCount)
}

func TestRenameMemoTagRepairsStalePayload(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "test-user")
	require.NoError(t, err)
	memo, err := ts.Store.CreateMemo(ctx, &store.Memo{
		UID:        "stalepayload001",
		CreatorID:  user.ID,
		Content:    "imported memo #work",
		Visibility: store.Private,
		Payload:    &storepb.MemoPayload{},
	})
	require.NoError(t, err)

	resp, err := ts.Service.RenameMemoTag(ts.CreateUserContext(ctx, user.ID), &apiv1.RenameMemoTagRequest{OldTag: "work", NewTag: "job"})
	require.NoError(t, err)
	require.Equal(t, int32(1), resp.UpdatedMemoCount)

	stored, err := ts.Store.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
	require.NoError(t, err)
	require.Equal(t, "imported memo #job", stored.Content)
	require.Equal(t, []string{"job"}, stored.Payload.GetTags())
}

func TestRenameMemoTagHonorsContentLimit(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "test-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)
	original := strings.Repeat("x", store.DefaultContentLengthLimit-2) + "#a"
	memo, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{Content: original, Visibility: apiv1.Visibility_PRIVATE},
	})
	require.NoError(t, err)

	resp, err := ts.Service.RenameMemoTag(userCtx, &apiv1.RenameMemoTagRequest{OldTag: "a", NewTag: "longer"})
	require.Nil(t, resp)
	require.Equal(t, codes.InvalidArgument, status.Code(err))

	stored, err := ts.Service.GetMemo(userCtx, &apiv1.GetMemoRequest{Name: memo.Name})
	require.NoError(t, err)
	require.Equal(t, original, stored.Content)
}

func TestRenameMemoTagExactMatching(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "test-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	content := `# Title with #todo-ish words

todo #todoist #project/todo and #todo. #Todo stays.

- list item with #todo

` + "```" + `
#code #todo in code block stays
` + "```" + `

Inline ` + "`#todo code`" + ` stays too.

Link [release #todo](https://example.com#todo) stays.
Image ![#todo](https://example.com/a.png) stays.
URL https://example.com/page#todo stays.

#todo #todo second occurrence #项目/后端 stays.
`
	memo, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{Content: content, Visibility: apiv1.Visibility_PRIVATE},
	})
	require.NoError(t, err)

	resp, err := ts.Service.RenameMemoTag(userCtx, &apiv1.RenameMemoTagRequest{OldTag: "todo", NewTag: "done"})
	require.NoError(t, err)
	require.Equal(t, int32(1), resp.UpdatedMemoCount)

	updated, err := ts.Service.GetMemo(userCtx, &apiv1.GetMemoRequest{Name: memo.Name})
	require.NoError(t, err)

	require.Contains(t, updated.Content, "#done")
	// Exact boundaries: no prefix/suffix or partial matches.
	require.Contains(t, updated.Content, "#todoist")
	require.Contains(t, updated.Content, "#project/todo")
	require.Contains(t, updated.Content, "#todo-ish")
	// Headings, code, links, images, and URL fragments are untouched.
	require.Contains(t, updated.Content, "# Title with")
	require.Contains(t, updated.Content, "#code #todo in code block stays")
	require.Contains(t, updated.Content, "`#todo code`")
	require.Contains(t, updated.Content, "[release #todo](https://example.com#todo)")
	require.Contains(t, updated.Content, "![#todo](https://example.com/a.png)")
	require.Contains(t, updated.Content, "https://example.com/page#todo")
	// Case sensitivity: "#Todo" is a different tag and stays unchanged.
	require.Contains(t, updated.Content, "#Todo stays.")
	require.Equal(t, 4, strings.Count(updated.Content, "#done"))
	// Payload tags are rebuilt consistently with the new content.
	require.Equal(t, []string{"todo-ish", "todoist", "project", "project/todo", "done", "Todo", "项目", "项目/后端"}, memoPayloadTags(t, ts, memoUIDFromName(memo.Name)))

	// The rest of the content is preserved byte-for-byte around the splices.
	expected := content[:len("# Title with ")]
	require.Equal(t, expected, updated.Content[:len(expected)])
}

func TestRenameMemoTagHierarchicalAndUnicode(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "test-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	_, err = ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{Content: "working on #项目/后端 today", Visibility: apiv1.Visibility_PRIVATE},
	})
	require.NoError(t, err)

	resp, err := ts.Service.RenameMemoTag(userCtx, &apiv1.RenameMemoTagRequest{OldTag: "项目/后端", NewTag: "项目/服务端"})
	require.NoError(t, err)
	require.Equal(t, int32(1), resp.UpdatedMemoCount)
}

func TestRenameMemoTagMultipleOccurrencesCountOnce(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "test-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	_, err = ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{Content: "#todo first\n\n#todo second\n\n#todo third", Visibility: apiv1.Visibility_PRIVATE},
	})
	require.NoError(t, err)

	resp, err := ts.Service.RenameMemoTag(userCtx, &apiv1.RenameMemoTagRequest{OldTag: "todo", NewTag: "done"})
	require.NoError(t, err)
	require.Equal(t, int32(1), resp.UpdatedMemoCount)
}

func TestRenameMemoTagMergesIntoExistingTag(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "test-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	first, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{Content: "#todo old task", Visibility: apiv1.Visibility_PRIVATE},
	})
	require.NoError(t, err)
	second, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{Content: "#done already finished", Visibility: apiv1.Visibility_PRIVATE},
	})
	require.NoError(t, err)

	resp, err := ts.Service.RenameMemoTag(userCtx, &apiv1.RenameMemoTagRequest{OldTag: "todo", NewTag: "done"})
	require.NoError(t, err)
	require.Equal(t, int32(1), resp.UpdatedMemoCount)

	updated, err := ts.Service.GetMemo(userCtx, &apiv1.GetMemoRequest{Name: first.Name})
	require.NoError(t, err)
	require.Contains(t, updated.Content, "#done old task")

	// The memo that already used the target tag is untouched.
	unchanged, err := ts.Service.GetMemo(userCtx, &apiv1.GetMemoRequest{Name: second.Name})
	require.NoError(t, err)
	require.Equal(t, "#done already finished", unchanged.Content)

	require.Equal(t, []string{"done"}, memoPayloadTags(t, ts, memoUIDFromName(first.Name)))
}

func TestRenameMemoTagIncludesArchivedAndComments(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "test-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	parent, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{Content: "parent memo", Visibility: apiv1.Visibility_PRIVATE},
	})
	require.NoError(t, err)
	comment, err := ts.Service.CreateMemoComment(userCtx, &apiv1.CreateMemoCommentRequest{
		Name:    parent.Name,
		Comment: &apiv1.Memo{Content: "comment #todo", Visibility: apiv1.Visibility_PRIVATE},
	})
	require.NoError(t, err)
	archived, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{Content: "archived #todo", Visibility: apiv1.Visibility_PRIVATE},
	})
	require.NoError(t, err)
	archived.State = apiv1.State_ARCHIVED
	_, err = ts.Service.UpdateMemo(userCtx, &apiv1.UpdateMemoRequest{
		Memo:       archived,
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"state"}},
	})
	require.NoError(t, err)

	resp, err := ts.Service.RenameMemoTag(userCtx, &apiv1.RenameMemoTagRequest{OldTag: "todo", NewTag: "done"})
	require.NoError(t, err)
	require.Equal(t, int32(2), resp.UpdatedMemoCount)

	for _, name := range []string{comment.Name, archived.Name} {
		memo, err := ts.Service.GetMemo(userCtx, &apiv1.GetMemoRequest{Name: name})
		require.NoError(t, err)
		require.Contains(t, memo.Content, "#done")
	}
}

func TestRenameMemoTagIsolatedBetweenUsers(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	userOne, err := ts.CreateRegularUser(ctx, "user-one")
	require.NoError(t, err)
	userOneCtx := ts.CreateUserContext(ctx, userOne.ID)

	userTwo, err := ts.CreateRegularUser(ctx, "user-two")
	require.NoError(t, err)
	userTwoCtx := ts.CreateUserContext(ctx, userTwo.ID)

	admin, err := ts.CreateHostUser(ctx, "admin")
	require.NoError(t, err)
	adminCtx := ts.CreateUserContext(ctx, admin.ID)

	ownerMemo, err := ts.Service.CreateMemo(userOneCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{Content: "mine #todo", Visibility: apiv1.Visibility_PUBLIC},
	})
	require.NoError(t, err)
	otherMemo, err := ts.Service.CreateMemo(userTwoCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{Content: "theirs #todo", Visibility: apiv1.Visibility_PUBLIC},
	})
	require.NoError(t, err)

	resp, err := ts.Service.RenameMemoTag(userOneCtx, &apiv1.RenameMemoTagRequest{OldTag: "todo", NewTag: "done"})
	require.NoError(t, err)
	require.Equal(t, int32(1), resp.UpdatedMemoCount)

	// Even a superuser renaming the same tag only touches their own memos.
	adminResp, err := ts.Service.RenameMemoTag(adminCtx, &apiv1.RenameMemoTagRequest{OldTag: "todo", NewTag: "done"})
	require.NoError(t, err)
	require.Equal(t, int32(0), adminResp.UpdatedMemoCount)

	updatedOwner, err := ts.Service.GetMemo(userOneCtx, &apiv1.GetMemoRequest{Name: ownerMemo.Name})
	require.NoError(t, err)
	require.Contains(t, updatedOwner.Content, "#done")

	updatedOther, err := ts.Service.GetMemo(adminCtx, &apiv1.GetMemoRequest{Name: otherMemo.Name})
	require.NoError(t, err)
	require.Contains(t, updatedOther.Content, "#todo")
	require.NotContains(t, updatedOther.Content, "#done")
}

func TestRenameMemoTagProcessesMultipleBatches(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "test-user")
	require.NoError(t, err)

	const total = 250 // spans more than one internal batch of 100.
	memoIDs := make([]int32, 0, total)
	for i := range total {
		memo, err := ts.Store.CreateMemo(ctx, &store.Memo{
			UID:        fmt.Sprintf("memo%03d", i),
			CreatorID:  user.ID,
			Content:    fmt.Sprintf("memo %d #todo", i),
			Visibility: store.Private,
		})
		require.NoError(t, err)
		memoIDs = append(memoIDs, memo.ID)
	}
	// One decoy memo that must not be renamed by the tag change.
	decoy, err := ts.Store.CreateMemo(ctx, &store.Memo{
		UID:        "decoy",
		CreatorID:  user.ID,
		Content:    "decoy #todoist",
		Visibility: store.Private,
	})
	require.NoError(t, err)

	userCtx := ts.CreateUserContext(ctx, user.ID)
	resp, err := ts.Service.RenameMemoTag(userCtx, &apiv1.RenameMemoTagRequest{OldTag: "todo", NewTag: "done"})
	require.NoError(t, err)
	require.Equal(t, int32(total), resp.UpdatedMemoCount)

	// Every memo across all batches was renamed; none skipped.
	memos, err := ts.Store.ListMemos(ctx, &store.FindMemo{IDList: memoIDs})
	require.NoError(t, err)
	require.Len(t, memos, total)
	for _, memo := range memos {
		require.Contains(t, memo.Content, "#done", "memo id %d", memo.ID)
		require.Equal(t, []string{"done"}, memo.Payload.Tags, "memo id %d", memo.ID)
	}

	decoyMemo, err := ts.Store.GetMemo(ctx, &store.FindMemo{ID: &decoy.ID})
	require.NoError(t, err)
	require.Equal(t, "decoy #todoist", decoyMemo.Content)
}

func memoPayloadTags(t *testing.T, ts *TestService, memoUID string) []string {
	t.Helper()
	ctx := context.Background()
	memo, err := ts.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	require.NoError(t, err)
	require.NotNil(t, memo)
	require.NotNil(t, memo.Payload)
	return memo.Payload.Tags
}

func memoUIDFromName(name string) string {
	return strings.TrimPrefix(name, "memos/")
}
