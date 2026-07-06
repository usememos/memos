package test

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// =============================================================================
// size() on string fields
// =============================================================================

func TestMemoFilterSizeContent(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-short", tc.User.ID).Content("abc"))       // length 3
	tc.CreateMemo(NewMemoBuilder("memo-long", tc.User.ID).Content("abcdefghij")) // length 10

	require.Len(t, tc.ListWithFilter(`size(content) > 5`), 1)
	require.Len(t, tc.ListWithFilter(`size(content) < 5`), 1)
	require.Len(t, tc.ListWithFilter(`size(content) == 3`), 1)
	require.Len(t, tc.ListWithFilter(`size(content) >= 3`), 2)
}

// =============================================================================
// Timestamp accessors (UTC). 1700000000 == 2023-11-14 22:13:20 UTC (a Tuesday).
// =============================================================================

func TestMemoFilterTimestampAccessors(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-dated", tc.User.ID).Content("dated").CreatedTs(1700000000))

	require.Len(t, tc.ListWithFilter(`created_ts.getFullYear() == 2023`), 1)
	require.Len(t, tc.ListWithFilter(`created_ts.getFullYear() == 2022`), 0)
	// getMonth is 0-based: November == 10.
	require.Len(t, tc.ListWithFilter(`created_ts.getMonth() == 10`), 1)
	require.Len(t, tc.ListWithFilter(`created_ts.getMonth() == 11`), 0)
	require.Len(t, tc.ListWithFilter(`created_ts.getDate() == 14`), 1)
	require.Len(t, tc.ListWithFilter(`created_ts.getHours() == 22`), 1)
	// getDayOfWeek is 0-based, 0=Sunday: 2023-11-14 is a Tuesday == 2.
	require.Len(t, tc.ListWithFilter(`created_ts.getDayOfWeek() == 2`), 1)
}

// =============================================================================
// ext.Sets(): contains / intersects / equivalent over tags
// =============================================================================

func TestMemoFilterSets(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-wu", tc.User.ID).Content("work urgent").Tags("work", "urgent"))
	tc.CreateMemo(NewMemoBuilder("memo-home", tc.User.ID).Content("home").Tags("home"))

	// contains: tags must be a superset of the list.
	require.Len(t, tc.ListWithFilter(`sets.contains(tags, ["work", "urgent"])`), 1)
	require.Len(t, tc.ListWithFilter(`sets.contains(tags, ["work", "home"])`), 0)

	// intersects: any element in common.
	require.Len(t, tc.ListWithFilter(`sets.intersects(tags, ["urgent", "home"])`), 2)
	require.Len(t, tc.ListWithFilter(`sets.intersects(tags, ["missing"])`), 0)

	// equivalent: exactly the same set.
	require.Len(t, tc.ListWithFilter(`sets.equivalent(tags, ["work", "urgent"])`), 1)
	require.Len(t, tc.ListWithFilter(`sets.equivalent(tags, ["work"])`), 0)
}

// =============================================================================
// exists_one(): exactly one element matches the predicate
// =============================================================================

func TestMemoFilterExistsOne(t *testing.T) {
	t.Parallel()
	tc := NewMemoFilterTestContext(t)
	defer tc.Close()

	tc.CreateMemo(NewMemoBuilder("memo-one-x", tc.User.ID).Content("one x").Tags("x"))       // 1 tag starts with x
	tc.CreateMemo(NewMemoBuilder("memo-two-x", tc.User.ID).Content("two x").Tags("x", "xy")) // 2 tags start with x
	tc.CreateMemo(NewMemoBuilder("memo-no-x", tc.User.ID).Content("no x").Tags("z"))         // 0 tags start with x

	// Only memo-one-x has exactly one tag starting with "x".
	require.Len(t, tc.ListWithFilter(`tags.exists_one(t, t.startsWith("x"))`), 1)
	// Only memo-no-x has exactly one tag equal to "z".
	require.Len(t, tc.ListWithFilter(`tags.exists_one(t, t == "z")`), 1)
}
