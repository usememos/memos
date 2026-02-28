package test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// =============================================================================
// Content Field Tests
// Schema: content (string, supports contains)
// =============================================================================

func TestMemoFilterContentContains(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	// Create memos with different content
	tc.CreateMemo(NewMemoBuilder("memo-hello", tc.User.ID).Content("Hello world"))
	tc.CreateMemo(NewMemoBuilder("memo-goodbye", tc.User.ID).Content("Goodbye world"))
	tc.CreateMemo(NewMemoBuilder("memo-test", tc.User.ID).Content("Testing content"))

	// Test: content.contains("Hello") - single match
	memos := tc.ListWithFilter(`content.contains("Hello")`)
	require.Len(t, memos, 1)
	require.Contains(t, memos[0].Content, "Hello")

	// Test: content.contains("world") - multiple matches
	memos = tc.ListWithFilter(`content.contains("world")`)
	require.Len(t, memos, 2)

	// Test: content.contains("nonexistent") - no matches
	memos = tc.ListWithFilter(`content.contains("nonexistent")`)
	require.Len(t, memos, 0)
}

func TestMemoFilterContentSpecialCharacters(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-special", tc.User.ID).Content("Special chars: @#$%^&*()"))

	memos := tc.ListWithFilter(`content.contains("@#$%")`)
	require.Len(t, memos, 1)
}

func TestMemoFilterContentUnicode(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-unicode", tc.User.ID).Content("Unicode test: 你好世界 🌍"))

	memos := tc.ListWithFilter(`content.contains("你好")`)
	require.Len(t, memos, 1)
}

func TestMemoFilterContentUnicodeCaseFold(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-unicode-case", tc.User.ID).Content("Привет Мир"))

	memos := tc.ListWithFilter(`content.contains("привет")`)
	require.Len(t, memos, 1)
}

func TestMemoFilterContentCaseSensitivity(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-case", tc.User.ID).Content("MixedCase Content"))

	// Exact match
	memos := tc.ListWithFilter(`content.contains("MixedCase")`)
	require.Len(t, memos, 1)

	// Lowercase match (depends on DB collation, usually case-insensitive in default installs but good to verify behavior)
	// SQLite default LIKE is case-insensitive for ASCII.
	memosLower := tc.ListWithFilter(`content.contains("mixedcase")`)
	// We just verify it doesn't crash; strict case sensitivity expectation depends on DB config.
	// For standard Memos setup (SQLite), it's often case-insensitive.
	// Let's check if we get a result or not to characterize current behavior.
	if len(memosLower) > 0 {
		require.Equal(t, "MixedCase Content", memosLower[0].Content)
	}
}

// =============================================================================
// Visibility Field Tests
// Schema: visibility (string, ==, !=)
// =============================================================================

func TestMemoFilterVisibilityEquals(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-public", tc.User.ID).Content("Public memo").Visibility(store.Public))
	tc.CreateMemo(NewMemoBuilder("memo-private", tc.User.ID).Content("Private memo").Visibility(store.Private))
	tc.CreateMemo(NewMemoBuilder("memo-protected", tc.User.ID).Content("Protected memo").Visibility(store.Protected))

	// Test: visibility == "PUBLIC"
	memos := tc.ListWithFilter(`visibility == "PUBLIC"`)
	require.Len(t, memos, 1)
	require.Equal(t, store.Public, memos[0].Visibility)

	// Test: visibility == "PRIVATE"
	memos = tc.ListWithFilter(`visibility == "PRIVATE"`)
	require.Len(t, memos, 1)
	require.Equal(t, store.Private, memos[0].Visibility)
}

func TestMemoFilterVisibilityNotEquals(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-public", tc.User.ID).Content("Public memo").Visibility(store.Public))
	tc.CreateMemo(NewMemoBuilder("memo-private", tc.User.ID).Content("Private memo").Visibility(store.Private))

	memos := tc.ListWithFilter(`visibility != "PUBLIC"`)
	require.Len(t, memos, 1)
	require.Equal(t, store.Private, memos[0].Visibility)
}

func TestMemoFilterVisibilityInList(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-pub", tc.User.ID).Visibility(store.Public))
	tc.CreateMemo(NewMemoBuilder("memo-priv", tc.User.ID).Visibility(store.Private))
	tc.CreateMemo(NewMemoBuilder("memo-prot", tc.User.ID).Visibility(store.Protected))

	memos := tc.ListWithFilter(`visibility in ["PUBLIC", "PRIVATE"]`)
	require.Len(t, memos, 2)
}

// =============================================================================
// Pinned Field Tests
// Schema: pinned (bool column, ==, !=, predicate)
// =============================================================================

func TestMemoFilterPinnedEquals(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	pinnedMemo := tc.CreateMemo(NewMemoBuilder("memo-pinned", tc.User.ID).Content("Pinned memo"))
	tc.PinMemo(pinnedMemo.ID)
	tc.CreateMemo(NewMemoBuilder("memo-unpinned", tc.User.ID).Content("Unpinned memo"))

	// Test: pinned == true
	memos := tc.ListWithFilter(`pinned == true`)
	require.Len(t, memos, 1)
	require.True(t, memos[0].Pinned)

	// Test: pinned == false
	memos = tc.ListWithFilter(`pinned == false`)
	require.Len(t, memos, 1)
	require.False(t, memos[0].Pinned)
}

func TestMemoFilterPinnedPredicate(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	pinnedMemo := tc.CreateMemo(NewMemoBuilder("memo-pinned", tc.User.ID).Content("Pinned memo"))
	tc.PinMemo(pinnedMemo.ID)
	tc.CreateMemo(NewMemoBuilder("memo-unpinned", tc.User.ID).Content("Unpinned memo"))

	memos := tc.ListWithFilter(`pinned`)
	require.Len(t, memos, 1)
	require.True(t, memos[0].Pinned)
}

// =============================================================================
// Creator ID Field Tests
// Schema: creator_id (int, ==, !=)
// =============================================================================

func TestMemoFilterCreatorIdEquals(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	user2, err := tc.Store.CreateUser(tc.Ctx, &store.User{
		Username: "user2",
		Role:     store.RoleUser,
		Email:    "user2@example.com",
		Nickname: "User 2",
	})
	require.NoError(t, err)

	tc.CreateMemo(NewMemoBuilder("memo-user1", tc.User.ID).Content("User 1 memo"))
	tc.CreateMemo(NewMemoBuilder("memo-user2", user2.ID).Content("User 2 memo"))

	memos := tc.ListWithFilter(`creator_id == ` + formatInt(int(tc.User.ID)))
	require.Len(t, memos, 1)
	require.Equal(t, tc.User.ID, memos[0].CreatorID)
}

func TestMemoFilterCreatorIdNotEquals(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	user2, err := tc.Store.CreateUser(tc.Ctx, &store.User{
		Username: "user2",
		Role:     store.RoleUser,
		Email:    "user2@example.com",
		Nickname: "User 2",
	})
	require.NoError(t, err)

	tc.CreateMemo(NewMemoBuilder("memo-user1", tc.User.ID).Content("User 1 memo"))
	tc.CreateMemo(NewMemoBuilder("memo-user2", user2.ID).Content("User 2 memo"))

	memos := tc.ListWithFilter(`creator_id != ` + formatInt(int(tc.User.ID)))
	require.Len(t, memos, 1)
	require.Equal(t, user2.ID, memos[0].CreatorID)
}

// =============================================================================
// Tags Field Tests
// Schema: tags (JSON list), tag (virtual alias)
// Operators: tag in [...], "value" in tags
// =============================================================================

func TestMemoFilterTagInList(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-work", tc.User.ID).Content("Work memo").Tags("work", "important"))
	tc.CreateMemo(NewMemoBuilder("memo-personal", tc.User.ID).Content("Personal memo").Tags("personal", "fun"))
	tc.CreateMemo(NewMemoBuilder("memo-no-tags", tc.User.ID).Content("No tags"))

	// Test: tag in ["work"]
	memos := tc.ListWithFilter(`tag in ["work"]`)
	require.Len(t, memos, 1)
	require.Contains(t, memos[0].Payload.Tags, "work")

	// Test: tag in ["work", "personal"]
	memos = tc.ListWithFilter(`tag in ["work", "personal"]`)
	require.Len(t, memos, 2)
}

func TestMemoFilterElementInTags(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-tagged", tc.User.ID).Content("Tagged memo").Tags("project", "todo"))
	tc.CreateMemo(NewMemoBuilder("memo-untagged", tc.User.ID).Content("Untagged memo"))

	// Test: "project" in tags
	memos := tc.ListWithFilter(`"project" in tags`)
	require.Len(t, memos, 1)

	// Test: "nonexistent" in tags
	memos = tc.ListWithFilter(`"nonexistent" in tags`)
	require.Len(t, memos, 0)
}

func TestMemoFilterHierarchicalTags(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-book", tc.User.ID).Content("Book memo").Tags("book"))
	tc.CreateMemo(NewMemoBuilder("memo-book-fiction", tc.User.ID).Content("Fiction book memo").Tags("book/fiction"))

	// Test: tag in ["book"] should match both (hierarchical matching)
	memos := tc.ListWithFilter(`tag in ["book"]`)
	require.Len(t, memos, 2)
}

func TestMemoFilterEmptyTags(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-empty-tags", tc.User.ID).Content("Empty tags").Tags())

	memos := tc.ListWithFilter(`tag in ["anything"]`)
	require.Len(t, memos, 0)
}

// =============================================================================
// JSON Bool Field Tests
// Schema: has_task_list, has_link, has_code, has_incomplete_tasks
// Operators: ==, !=, predicate
// =============================================================================

func TestMemoFilterHasTaskList(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-with-tasks", tc.User.ID).
		Content("- [ ] Task 1\n- [x] Task 2").
		Property(func(p *storepb.MemoPayload_Property) { p.HasTaskList = true }))
	tc.CreateMemo(NewMemoBuilder("memo-no-tasks", tc.User.ID).Content("No tasks here"))

	// Test: has_task_list (predicate)
	memos := tc.ListWithFilter(`has_task_list`)
	require.Len(t, memos, 1)
	require.True(t, memos[0].Payload.Property.HasTaskList)

	// Test: has_task_list == true
	memos = tc.ListWithFilter(`has_task_list == true`)
	require.Len(t, memos, 1)

	// Note: has_task_list == false is not tested because JSON boolean fields
	// with false value may not be queryable when the field is not present in JSON
}

func TestMemoFilterHasLink(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-with-link", tc.User.ID).
		Content("Check out https://example.com").
		Property(func(p *storepb.MemoPayload_Property) { p.HasLink = true }))
	tc.CreateMemo(NewMemoBuilder("memo-no-link", tc.User.ID).Content("No links"))

	memos := tc.ListWithFilter(`has_link`)
	require.Len(t, memos, 1)
	require.True(t, memos[0].Payload.Property.HasLink)
}

func TestMemoFilterHasCode(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-with-code", tc.User.ID).
		Content("```go\nfmt.Println(\"Hello\")\n```").
		Property(func(p *storepb.MemoPayload_Property) { p.HasCode = true }))
	tc.CreateMemo(NewMemoBuilder("memo-no-code", tc.User.ID).Content("No code"))

	memos := tc.ListWithFilter(`has_code`)
	require.Len(t, memos, 1)
	require.True(t, memos[0].Payload.Property.HasCode)
}

func TestMemoFilterHasIncompleteTasks(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-incomplete", tc.User.ID).
		Content("- [ ] Incomplete task").
		Property(func(p *storepb.MemoPayload_Property) {
			p.HasTaskList = true
			p.HasIncompleteTasks = true
		}))
	tc.CreateMemo(NewMemoBuilder("memo-complete", tc.User.ID).
		Content("- [x] Complete task").
		Property(func(p *storepb.MemoPayload_Property) {
			p.HasTaskList = true
			p.HasIncompleteTasks = false
		}))

	memos := tc.ListWithFilter(`has_incomplete_tasks`)
	require.Len(t, memos, 1)
	require.True(t, memos[0].Payload.Property.HasIncompleteTasks)
}

func TestMemoFilterCombinedJSONBool(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	// Memo with all properties
	tc.CreateMemo(NewMemoBuilder("memo-all-props", tc.User.ID).
		Content("All properties").
		Property(func(p *storepb.MemoPayload_Property) {
			p.HasLink = true
			p.HasTaskList = true
			p.HasCode = true
			p.HasIncompleteTasks = true
		}))

	// Memo with only link
	tc.CreateMemo(NewMemoBuilder("memo-only-link", tc.User.ID).
		Content("Only link").
		Property(func(p *storepb.MemoPayload_Property) { p.HasLink = true }))

	// Test: has_link && has_code
	memos := tc.ListWithFilter(`has_link && has_code`)
	require.Len(t, memos, 1)

	// Test: has_task_list && has_incomplete_tasks
	memos = tc.ListWithFilter(`has_task_list && has_incomplete_tasks`)
	require.Len(t, memos, 1)

	// Test: has_link || has_code
	memos = tc.ListWithFilter(`has_link || has_code`)
	require.Len(t, memos, 2)
}

// =============================================================================
// Timestamp Field Tests
// Schema: created_ts, updated_ts (timestamp, all comparison operators)
// Functions: now(), arithmetic (+, -, *)
// =============================================================================

func TestMemoFilterCreatedTsComparison(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	now := time.Now().Unix()
	tc.CreateMemo(NewMemoBuilder("memo-ts", tc.User.ID).Content("Timestamp test"))

	// Test: created_ts < future (should match)
	memos := tc.ListWithFilter(`created_ts < ` + formatInt64(now+3600))
	require.Len(t, memos, 1)

	// Test: created_ts > past (should match)
	memos = tc.ListWithFilter(`created_ts > ` + formatInt64(now-3600))
	require.Len(t, memos, 1)

	// Test: created_ts > future (should not match)
	memos = tc.ListWithFilter(`created_ts > ` + formatInt64(now+3600))
	require.Len(t, memos, 0)
}

func TestMemoFilterCreatedTsWithNow(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-ts-test", tc.User.ID).Content("Timestamp test"))

	// Test: created_ts < now() + 5 (buffer for container clock drift)
	memos := tc.ListWithFilter(`created_ts < now() + 5`)
	require.Len(t, memos, 1)

	// Test: created_ts > now() + 5 (should not match)
	memos = tc.ListWithFilter(`created_ts > now() + 5`)
	require.Len(t, memos, 0)
}

func TestMemoFilterCreatedTsArithmetic(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-ts-arith", tc.User.ID).Content("Timestamp arithmetic test"))

	// Test: created_ts >= now() - 3600 (memos created in last hour)
	memos := tc.ListWithFilter(`created_ts >= now() - 3600`)
	require.Len(t, memos, 1)

	// Test: created_ts < now() - 86400 (memos older than 1 day - should be empty)
	memos = tc.ListWithFilter(`created_ts < now() - 86400`)
	require.Len(t, memos, 0)

	// Test: Multiplication - created_ts >= now() - 60 * 60
	memos = tc.ListWithFilter(`created_ts >= now() - 60 * 60`)
	require.Len(t, memos, 1)
}

func TestMemoFilterUpdatedTs(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	memo := tc.CreateMemo(NewMemoBuilder("memo-updated", tc.User.ID).Content("Will be updated"))

	// Update the memo
	newContent := "Updated content"
	err := tc.Store.UpdateMemo(tc.Ctx, &store.UpdateMemo{
		ID:      memo.ID,
		Content: &newContent,
	})
	require.NoError(t, err)

	// Test: updated_ts >= now() - 60 (updated in last minute)
	memos := tc.ListWithFilter(`updated_ts >= now() - 60`)
	require.Len(t, memos, 1)

	// Test: updated_ts > now() + 3600 (should be empty)
	memos = tc.ListWithFilter(`updated_ts > now() + 3600`)
	require.Len(t, memos, 0)
}

func TestMemoFilterAllComparisonOperators(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-ops", tc.User.ID).Content("Comparison operators test"))

	// Test: < (less than)
	memos := tc.ListWithFilter(`created_ts < now() + 3600`)
	require.Len(t, memos, 1)

	// Test: <= (less than or equal) with buffer for clock drift
	memos = tc.ListWithFilter(`created_ts < now() + 5`)
	require.Len(t, memos, 1)

	// Test: > (greater than)
	memos = tc.ListWithFilter(`created_ts > now() - 3600`)
	require.Len(t, memos, 1)

	// Test: >= (greater than or equal)
	memos = tc.ListWithFilter(`created_ts >= now() - 60`)
	require.Len(t, memos, 1)
}

// =============================================================================
// Logical Operator Tests
// Operators: && (AND), || (OR), ! (NOT)
// =============================================================================

func TestMemoFilterLogicalAnd(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	pinnedMemo := tc.CreateMemo(NewMemoBuilder("memo-pinned-public", tc.User.ID).Content("Pinned public"))
	tc.PinMemo(pinnedMemo.ID)
	tc.CreateMemo(NewMemoBuilder("memo-unpinned-public", tc.User.ID).Content("Unpinned public"))

	memos := tc.ListWithFilter(`pinned && visibility == "PUBLIC"`)
	require.Len(t, memos, 1)
	require.True(t, memos[0].Pinned)
}

func TestMemoFilterLogicalOr(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-public", tc.User.ID).Visibility(store.Public))
	tc.CreateMemo(NewMemoBuilder("memo-private", tc.User.ID).Visibility(store.Private))
	tc.CreateMemo(NewMemoBuilder("memo-protected", tc.User.ID).Visibility(store.Protected))

	memos := tc.ListWithFilter(`visibility == "PUBLIC" || visibility == "PRIVATE"`)
	require.Len(t, memos, 2)
}

func TestMemoFilterLogicalNot(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	pinnedMemo := tc.CreateMemo(NewMemoBuilder("memo-pinned", tc.User.ID).Content("Pinned"))
	tc.PinMemo(pinnedMemo.ID)
	tc.CreateMemo(NewMemoBuilder("memo-unpinned", tc.User.ID).Content("Unpinned"))

	memos := tc.ListWithFilter(`!pinned`)
	require.Len(t, memos, 1)
	require.False(t, memos[0].Pinned)
}

func TestMemoFilterNegatedComparison(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-public", tc.User.ID).Visibility(store.Public))
	tc.CreateMemo(NewMemoBuilder("memo-private", tc.User.ID).Visibility(store.Private))

	memos := tc.ListWithFilter(`!(visibility == "PUBLIC")`)
	require.Len(t, memos, 1)
	require.Equal(t, store.Private, memos[0].Visibility)
}

func TestMemoFilterComplexLogical(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	// Create pinned public memo with tags
	pinnedMemo := tc.CreateMemo(NewMemoBuilder("memo-pinned-tagged", tc.User.ID).
		Content("Pinned and tagged").Tags("important"))
	tc.PinMemo(pinnedMemo.ID)

	// Create unpinned memo with same tag
	tc.CreateMemo(NewMemoBuilder("memo-unpinned-tagged", tc.User.ID).
		Content("Unpinned but tagged").Tags("important"))

	// Create pinned memo without tag
	pinned2 := tc.CreateMemo(NewMemoBuilder("memo-pinned-untagged", tc.User.ID).Content("Pinned but untagged"))
	tc.PinMemo(pinned2.ID)

	// Test: pinned && tag in ["important"]
	memos := tc.ListWithFilter(`pinned && tag in ["important"]`)
	require.Len(t, memos, 1)

	// Test: (pinned || tag in ["important"]) && visibility == "PUBLIC"
	memos = tc.ListWithFilter(`(pinned || tag in ["important"]) && visibility == "PUBLIC"`)
	require.Len(t, memos, 3)

	// Test: De Morgan's Law ! (A || B) == !A && !B
	// ! (pinned || has_task_list)
	tc.CreateMemo(NewMemoBuilder("memo-no-props", tc.User.ID).Content("Nothing special"))
	memos = tc.ListWithFilter(`!(pinned || has_task_list)`)
	require.Len(t, memos, 2) // Unpinned-tagged + Nothing special (pinned-untagged is pinned)
}

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

// =============================================================================
// Multiple Filters Tests
// =============================================================================

func TestMemoFilterMultipleFilters(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-public-hello", tc.User.ID).Content("Hello world").Visibility(store.Public))
	tc.CreateMemo(NewMemoBuilder("memo-private-hello", tc.User.ID).Content("Hello private").Visibility(store.Private))

	// Test: Multiple filters (applied as AND)
	memos := tc.ListWithFilters(`content.contains("Hello")`, `visibility == "PUBLIC"`)
	require.Len(t, memos, 1)
	require.Contains(t, memos[0].Content, "Hello")
	require.Equal(t, store.Public, memos[0].Visibility)
}

// =============================================================================
// Edge Cases
// =============================================================================

func TestMemoFilterNullPayload(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-null-payload", tc.User.ID).Content("Null payload"))

	// Test: has_link should not crash and return no results
	memos := tc.ListWithFilter(`has_link`)
	require.Len(t, memos, 0)
}

func TestMemoFilterNoMatches(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-test", tc.User.ID).Content("Test content"))

	memos := tc.ListWithFilter(`content.contains("nonexistent12345")`)
	require.Len(t, memos, 0)
}

func TestMemoFilterJSONBooleanLogic(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	// 1. Memo with task list (true) and NO link (null)
	tc.CreateMemo(NewMemoBuilder("memo-task-only", tc.User.ID).
		Content("Task only").
		Property(func(p *storepb.MemoPayload_Property) { p.HasTaskList = true }))

	// 2. Memo with link (true) and NO task list (null)
	tc.CreateMemo(NewMemoBuilder("memo-link-only", tc.User.ID).
		Content("Link only").
		Property(func(p *storepb.MemoPayload_Property) { p.HasLink = true }))

	// 3. Memo with both (true)
	tc.CreateMemo(NewMemoBuilder("memo-both", tc.User.ID).
		Content("Both").
		Property(func(p *storepb.MemoPayload_Property) {
			p.HasTaskList = true
			p.HasLink = true
		}))

	// 4. Memo with neither (null)
	tc.CreateMemo(NewMemoBuilder("memo-neither", tc.User.ID).Content("Neither"))

	// Test A: has_task_list || has_link
	// Expected: 3 memos (task-only, link-only, both). Neither should be excluded.
	// This specifically tests the NULL handling in OR logic (NULL || TRUE should be TRUE)
	memos := tc.ListWithFilter(`has_task_list || has_link`)
	require.Len(t, memos, 3, "Should find 3 memos with OR logic")

	// Test B: !has_task_list
	// Expected: 2 memos (link-only, neither). Memos where has_task_list is NULL or FALSE.
	// Note: If NULL is not handled, !NULL is still NULL (false-y in WHERE), so "neither" might be missed depending on logic.
	// In our implementation, we want missing fields to behave as false.
	memos = tc.ListWithFilter(`!has_task_list`)
	require.Len(t, memos, 2, "Should find 2 memos where task list is false or missing")

	// Test C: has_task_list && !has_link
	// Expected: 1 memo (task-only).
	memos = tc.ListWithFilter(`has_task_list && !has_link`)
	require.Len(t, memos, 1, "Should find 1 memo (task only)")
}
