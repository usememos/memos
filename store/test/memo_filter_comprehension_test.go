package test

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// =============================================================================
// Tag Comprehension Tests (exists macro)
// Schema: tags (list of strings, supports exists/all macros with predicates)
// =============================================================================

func TestMemoFilterTagsExistsStartsWith(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	// Create memos with different tags
	tc.CreateMemo(NewMemoBuilder("memo-archive1", tc.User.ID).
		Content("Archived project memo").
		Tags("archive/project", "done"))

	tc.CreateMemo(NewMemoBuilder("memo-archive2", tc.User.ID).
		Content("Archived work memo").
		Tags("archive/work", "old"))

	tc.CreateMemo(NewMemoBuilder("memo-active", tc.User.ID).
		Content("Active project memo").
		Tags("project/active", "todo"))

	tc.CreateMemo(NewMemoBuilder("memo-homelab", tc.User.ID).
		Content("Homelab memo").
		Tags("homelab/memos", "tech"))

	// Test: tags.exists(t, t.startsWith("archive")) - should match archived memos
	memos := tc.ListWithFilter(`tags.exists(t, t.startsWith("archive"))`)
	require.Len(t, memos, 2, "Should find 2 archived memos")
	for _, memo := range memos {
		hasArchiveTag := false
		for _, tag := range memo.Payload.Tags {
			if len(tag) >= 7 && tag[:7] == "archive" {
				hasArchiveTag = true
				break
			}
		}
		require.True(t, hasArchiveTag, "Memo should have tag starting with 'archive'")
	}

	// Test: !tags.exists(t, t.startsWith("archive")) - should match non-archived memos
	memos = tc.ListWithFilter(`!tags.exists(t, t.startsWith("archive"))`)
	require.Len(t, memos, 2, "Should find 2 non-archived memos")

	// Test: tags.exists(t, t.startsWith("project")) - should match project memos
	memos = tc.ListWithFilter(`tags.exists(t, t.startsWith("project"))`)
	require.Len(t, memos, 1, "Should find 1 project memo")

	// Test: tags.exists(t, t.startsWith("homelab")) - should match homelab memos
	memos = tc.ListWithFilter(`tags.exists(t, t.startsWith("homelab"))`)
	require.Len(t, memos, 1, "Should find 1 homelab memo")

	// Test: tags.exists(t, t.startsWith("nonexistent")) - should match nothing
	memos = tc.ListWithFilter(`tags.exists(t, t.startsWith("nonexistent"))`)
	require.Len(t, memos, 0, "Should find no memos")
}

func TestMemoFilterTagsExistsContains(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	// Create memos with different tags
	tc.CreateMemo(NewMemoBuilder("memo-todo1", tc.User.ID).
		Content("Todo task 1").
		Tags("project/todo", "urgent"))

	tc.CreateMemo(NewMemoBuilder("memo-todo2", tc.User.ID).
		Content("Todo task 2").
		Tags("work/todo-list", "pending"))

	tc.CreateMemo(NewMemoBuilder("memo-done", tc.User.ID).
		Content("Done task").
		Tags("project/completed", "done"))

	// Test: tags.exists(t, t.contains("todo")) - should match todos
	memos := tc.ListWithFilter(`tags.exists(t, t.contains("todo"))`)
	require.Len(t, memos, 2, "Should find 2 todo memos")

	// Test: tags.exists(t, t.contains("done")) - should match done
	memos = tc.ListWithFilter(`tags.exists(t, t.contains("done"))`)
	require.Len(t, memos, 1, "Should find 1 done memo")

	// Test: !tags.exists(t, t.contains("todo")) - should exclude todos
	memos = tc.ListWithFilter(`!tags.exists(t, t.contains("todo"))`)
	require.Len(t, memos, 1, "Should find 1 non-todo memo")
}

func TestMemoFilterTagsExistsEndsWith(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	// Create memos with different tag endings
	tc.CreateMemo(NewMemoBuilder("memo-bug", tc.User.ID).
		Content("Bug report").
		Tags("project/bug", "critical"))

	tc.CreateMemo(NewMemoBuilder("memo-debug", tc.User.ID).
		Content("Debug session").
		Tags("work/debug", "dev"))

	tc.CreateMemo(NewMemoBuilder("memo-feature", tc.User.ID).
		Content("New feature").
		Tags("project/feature", "new"))

	// Test: tags.exists(t, t.endsWith("bug")) - should match bug-related tags
	memos := tc.ListWithFilter(`tags.exists(t, t.endsWith("bug"))`)
	require.Len(t, memos, 2, "Should find 2 bug-related memos")

	// Test: tags.exists(t, t.endsWith("feature")) - should match feature
	memos = tc.ListWithFilter(`tags.exists(t, t.endsWith("feature"))`)
	require.Len(t, memos, 1, "Should find 1 feature memo")

	// Test: !tags.exists(t, t.endsWith("bug")) - should exclude bug-related
	memos = tc.ListWithFilter(`!tags.exists(t, t.endsWith("bug"))`)
	require.Len(t, memos, 1, "Should find 1 non-bug memo")
}

func TestMemoFilterTagsExistsCombinedWithOtherFilters(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	// Create memos with tags and other properties
	tc.CreateMemo(NewMemoBuilder("memo-archived-old", tc.User.ID).
		Content("Old archived memo").
		Tags("archive/old", "done"))

	tc.CreateMemo(NewMemoBuilder("memo-archived-recent", tc.User.ID).
		Content("Recent archived memo with TODO").
		Tags("archive/recent", "done"))

	tc.CreateMemo(NewMemoBuilder("memo-active-todo", tc.User.ID).
		Content("Active TODO").
		Tags("project/active", "todo"))

	// Test: Combine tag filter with content filter
	memos := tc.ListWithFilter(`tags.exists(t, t.startsWith("archive")) && content.contains("TODO")`)
	require.Len(t, memos, 1, "Should find 1 archived memo with TODO in content")

	// Test: OR condition with tag filters
	memos = tc.ListWithFilter(`tags.exists(t, t.startsWith("archive")) || tags.exists(t, t.contains("todo"))`)
	require.Len(t, memos, 3, "Should find all memos (archived or with todo tag)")

	// Test: Complex filter - archived but not containing "Recent"
	memos = tc.ListWithFilter(`tags.exists(t, t.startsWith("archive")) && !content.contains("Recent")`)
	require.Len(t, memos, 1, "Should find 1 old archived memo")
}

func TestMemoFilterTagsExistsEmptyAndNullCases(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	// Create memo with no tags
	tc.CreateMemo(NewMemoBuilder("memo-no-tags", tc.User.ID).
		Content("Memo without tags"))

	// Create memo with tags
	tc.CreateMemo(NewMemoBuilder("memo-with-tags", tc.User.ID).
		Content("Memo with tags").
		Tags("tag1", "tag2"))

	// Test: tags.exists should not match memos without tags
	memos := tc.ListWithFilter(`tags.exists(t, t.startsWith("tag"))`)
	require.Len(t, memos, 1, "Should only find memo with tags")

	// Test: Negation should match memos without matching tags
	memos = tc.ListWithFilter(`!tags.exists(t, t.startsWith("tag"))`)
	require.Len(t, memos, 1, "Should find memo without matching tags")
}

// =============================================================================
// Issue #5480 - Real-world use case test
// =============================================================================

func TestMemoFilterIssue5480_ArchiveWorkflow(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	// Create a realistic scenario as described in issue #5480
	// User has hierarchical tags and archives memos by prefixing with "archive"

	// Active memos
	tc.CreateMemo(NewMemoBuilder("memo-homelab", tc.User.ID).
		Content("Setting up Memos").
		Tags("homelab/memos", "tech"))

	tc.CreateMemo(NewMemoBuilder("memo-project-alpha", tc.User.ID).
		Content("Project Alpha notes").
		Tags("work/project-alpha", "active"))

	// Archived memos (user prefixed tags with "archive")
	tc.CreateMemo(NewMemoBuilder("memo-old-homelab", tc.User.ID).
		Content("Old homelab setup").
		Tags("archive/homelab/old-server", "done"))

	tc.CreateMemo(NewMemoBuilder("memo-old-project", tc.User.ID).
		Content("Old project beta").
		Tags("archive/work/project-beta", "completed"))

	tc.CreateMemo(NewMemoBuilder("memo-archived-personal", tc.User.ID).
		Content("Archived personal note").
		Tags("archive/personal/2024", "old"))

	// Test: Filter out ALL archived memos using startsWith
	memos := tc.ListWithFilter(`!tags.exists(t, t.startsWith("archive"))`)
	require.Len(t, memos, 2, "Should only show active memos (not archived)")
	for _, memo := range memos {
		for _, tag := range memo.Payload.Tags {
			require.NotContains(t, tag, "archive", "Active memos should not have archive prefix")
		}
	}

	// Test: Show ONLY archived memos
	memos = tc.ListWithFilter(`tags.exists(t, t.startsWith("archive"))`)
	require.Len(t, memos, 3, "Should find all archived memos")
	for _, memo := range memos {
		hasArchiveTag := false
		for _, tag := range memo.Payload.Tags {
			if len(tag) >= 7 && tag[:7] == "archive" {
				hasArchiveTag = true
				break
			}
		}
		require.True(t, hasArchiveTag, "All returned memos should have archive prefix")
	}

	// Test: Filter archived homelab memos specifically
	memos = tc.ListWithFilter(`tags.exists(t, t.startsWith("archive/homelab"))`)
	require.Len(t, memos, 1, "Should find only archived homelab memos")
}
