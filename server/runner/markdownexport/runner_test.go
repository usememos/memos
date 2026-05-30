package markdownexport

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/internal/version"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/db"
)

func TestSafeSegment(t *testing.T) {
	cases := []struct{ in, out string }{
		{"colin", "colin"},
		{"user.name-1", "user.name-1"},
		{"some/path", "some_path"},
		{"naïve", "na_ve"},
		{"", "_"},
		{".", "_"},
		{"..", "_"},
		{"\x00\x01", "__"},
	}
	for _, tc := range cases {
		require.Equalf(t, tc.out, safeSegment(tc.in), "input: %q", tc.in)
	}
}

func TestMemoDate(t *testing.T) {
	// UpdatedTs is intentionally on a different day to confirm we ignore it.
	memo := &store.Memo{
		CreatedTs: time.Date(2024, 3, 14, 12, 34, 56, 0, time.UTC).Unix(),
		UpdatedTs: time.Date(2024, 5, 1, 0, 0, 0, 0, time.UTC).Unix(),
	}
	require.Equal(t, "2024-03-14", memoDate(memo))
}

func TestRenderMemo(t *testing.T) {
	t.Run("full frontmatter with sorted tags", func(t *testing.T) {
		memo := &store.Memo{
			UID:        "memo123",
			CreatedTs:  time.Date(2024, 1, 2, 3, 4, 5, 0, time.UTC).Unix(),
			UpdatedTs:  time.Date(2024, 1, 2, 4, 5, 6, 0, time.UTC).Unix(),
			Visibility: store.Public,
			Pinned:     true,
			Content:    "hello world",
			Payload:    &storepb.MemoPayload{Tags: []string{"zeta", "alpha", "beta"}},
		}
		expected := strings.Join([]string{
			"---",
			"uid: memo123",
			"created: 2024-01-02T03:04:05Z",
			"updated: 2024-01-02T04:05:06Z",
			"visibility: PUBLIC",
			"pinned: true",
			"tags:",
			"  - alpha",
			"  - beta",
			"  - zeta",
			"---",
			"",
			"hello world",
			"",
		}, "\n")
		require.Equal(t, expected, renderMemo(memo))
	})

	t.Run("no tags omits tags block", func(t *testing.T) {
		memo := &store.Memo{
			UID:        "memo-abc",
			CreatedTs:  time.Date(2024, 6, 1, 0, 0, 0, 0, time.UTC).Unix(),
			UpdatedTs:  time.Date(2024, 6, 1, 0, 0, 0, 0, time.UTC).Unix(),
			Visibility: store.Private,
			Content:    "a\nb\n",
			Payload:    &storepb.MemoPayload{},
		}
		rendered := renderMemo(memo)
		require.Contains(t, rendered, "visibility: PRIVATE\n")
		require.Contains(t, rendered, "pinned: false\n")
		require.NotContains(t, rendered, "tags:")
		require.True(t, strings.HasSuffix(rendered, "a\nb\n"))
		require.False(t, strings.HasSuffix(rendered, "a\nb\n\n"))
	})

	t.Run("content without trailing newline gets one", func(t *testing.T) {
		memo := &store.Memo{
			UID:        "memo-x",
			Visibility: store.Protected,
			Content:    "single line",
			Payload:    &storepb.MemoPayload{},
		}
		require.True(t, strings.HasSuffix(renderMemo(memo), "single line\n"))
	})

	t.Run("nil payload tolerated", func(t *testing.T) {
		memo := &store.Memo{
			UID:        "memo-nil",
			Visibility: store.Protected,
			Content:    "x",
			Payload:    nil,
		}
		require.Contains(t, renderMemo(memo), "visibility: PROTECTED\n")
	})
}

func TestWriteIfChanged(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "deep", "nested", "file.md")

	require.NoError(t, writeIfChanged(path, "hello"))
	before, err := os.Stat(path)
	require.NoError(t, err)

	// Bump the mtime backward so any rewrite produces a strictly newer one.
	old := before.ModTime().Add(-time.Hour)
	require.NoError(t, os.Chtimes(path, old, old))

	// Identical content: no rewrite, mtime stays at the bumped-back value.
	require.NoError(t, writeIfChanged(path, "hello"))
	same, err := os.Stat(path)
	require.NoError(t, err)
	require.True(t, same.ModTime().Equal(old), "expected mtime preserved, got %v vs %v", same.ModTime(), old)

	// Changed content: rewrite, mtime moves forward.
	require.NoError(t, writeIfChanged(path, "hello world"))
	after, err := os.Stat(path)
	require.NoError(t, err)
	require.True(t, after.ModTime().After(old), "expected mtime advanced after rewrite")

	body, err := os.ReadFile(path)
	require.NoError(t, err)
	require.Equal(t, "hello world", string(body))
}

func TestPruneOrphans(t *testing.T) {
	dir := t.TempDir()

	mustWrite(t, filepath.Join(dir, "alice", "2024-01-01", "keep.md"), "keep")
	mustWrite(t, filepath.Join(dir, "alice", "2024-01-01", "orphan.md"), "orphan")
	mustWrite(t, filepath.Join(dir, "alice", "2024-01-01", "notes.txt"), "non-markdown")
	mustWrite(t, filepath.Join(dir, "bob", "2024-02-02", "bob-orphan.md"), "orphan")
	mustWrite(t, filepath.Join(dir, "carol", "2024-03-03", "carol-orphan.md"), "orphan")

	written := map[string]struct{}{
		filepath.Join(dir, "alice", "2024-01-01", "keep.md"): {},
	}

	pruneOrphans(dir, written)

	requireExists(t, filepath.Join(dir, "alice", "2024-01-01", "keep.md"))
	requireExists(t, filepath.Join(dir, "alice", "2024-01-01", "notes.txt"))
	requireExists(t, filepath.Join(dir, "alice", "2024-01-01"))
	requireExists(t, filepath.Join(dir, "alice"))

	requireMissing(t, filepath.Join(dir, "alice", "2024-01-01", "orphan.md"))
	requireMissing(t, filepath.Join(dir, "bob", "2024-02-02", "bob-orphan.md"))
	requireMissing(t, filepath.Join(dir, "bob", "2024-02-02"))
	requireMissing(t, filepath.Join(dir, "bob"))
	requireMissing(t, filepath.Join(dir, "carol"))

	// The export dir itself stays even when it ends up empty.
	requireExists(t, dir)
}

// TestExportEndToEnd builds a real sqlite-backed store, exports it, and
// verifies the file tree before and after deleting a memo. Catches the
// integration glue between Runner, the store, and the filesystem layout.
func TestExportEndToEnd(t *testing.T) {
	ctx := context.Background()
	dataDir := t.TempDir()
	exportDir := t.TempDir()

	prof := &profile.Profile{
		Data:    dataDir,
		DSN:     filepath.Join(dataDir, "memos.db"),
		Driver:  "sqlite",
		Version: version.GetCurrentVersion(),
	}
	dbDriver, err := db.NewDBDriver(prof)
	require.NoError(t, err)
	st := store.New(dbDriver, prof)
	require.NoError(t, st.Migrate(ctx))
	t.Cleanup(func() { _ = st.Close() })

	alice, err := st.CreateUser(ctx, &store.User{
		Username:     "alice",
		Role:         store.RoleAdmin,
		Email:        "alice@example.com",
		PasswordHash: "x",
	})
	require.NoError(t, err)
	bob, err := st.CreateUser(ctx, &store.User{
		Username:     "bob",
		Role:         store.RoleUser,
		Email:        "bob@example.com",
		PasswordHash: "x",
	})
	require.NoError(t, err)

	day1Sec := time.Date(2024, 4, 1, 12, 0, 0, 0, time.UTC).Unix()
	day2Sec := time.Date(2024, 4, 2, 12, 0, 0, 0, time.UTC).Unix()

	_, err = st.CreateMemo(ctx, &store.Memo{
		UID:        "memoa1",
		CreatorID:  alice.ID,
		CreatedTs:  day1Sec,
		UpdatedTs:  day1Sec,
		Content:    "alice memo 1",
		Visibility: store.Public,
		Payload:    &storepb.MemoPayload{},
		RowStatus:  store.Normal,
	})
	require.NoError(t, err)

	aliceMemo2, err := st.CreateMemo(ctx, &store.Memo{
		UID:        "memoa2",
		CreatorID:  alice.ID,
		CreatedTs:  day2Sec,
		UpdatedTs:  day2Sec,
		Content:    "alice memo 2",
		Visibility: store.Private,
		Payload:    &storepb.MemoPayload{Tags: []string{"work"}},
		RowStatus:  store.Normal,
	})
	require.NoError(t, err)

	_, err = st.CreateMemo(ctx, &store.Memo{
		UID:        "memob1",
		CreatorID:  bob.ID,
		CreatedTs:  day1Sec,
		UpdatedTs:  day1Sec,
		Content:    "bob memo 1",
		Visibility: store.Protected,
		Payload:    &storepb.MemoPayload{},
		RowStatus:  store.Normal,
	})
	require.NoError(t, err)

	t.Setenv("MEMOS_MARKDOWN_EXPORT_DIR", exportDir)
	runner := NewRunner(st, prof)
	runner.RunOnce(ctx)

	requireExists(t, filepath.Join(exportDir, "alice", "2024-04-01", "memoa1.md"))
	requireExists(t, filepath.Join(exportDir, "alice", "2024-04-02", "memoa2.md"))
	requireExists(t, filepath.Join(exportDir, "bob", "2024-04-01", "memob1.md"))

	body, err := os.ReadFile(filepath.Join(exportDir, "alice", "2024-04-02", "memoa2.md"))
	require.NoError(t, err)
	bodyStr := string(body)
	require.Contains(t, bodyStr, "uid: memoa2\n")
	require.Contains(t, bodyStr, "visibility: PRIVATE\n")
	require.Contains(t, bodyStr, "  - work\n")
	require.True(t, strings.HasSuffix(bodyStr, "alice memo 2\n"), "body: %q", bodyStr)

	// Delete one memo, re-export, verify prune.
	require.NoError(t, st.DeleteMemo(ctx, &store.DeleteMemo{ID: aliceMemo2.ID}))
	runner.RunOnce(ctx)

	requireMissing(t, filepath.Join(exportDir, "alice", "2024-04-02", "memoa2.md"))
	requireMissing(t, filepath.Join(exportDir, "alice", "2024-04-02"))
	requireExists(t, filepath.Join(exportDir, "alice", "2024-04-01", "memoa1.md"))
	requireExists(t, filepath.Join(exportDir, "bob", "2024-04-01", "memob1.md"))
}

func mustWrite(t *testing.T, path, content string) {
	t.Helper()
	require.NoError(t, os.MkdirAll(filepath.Dir(path), 0o755))
	require.NoError(t, os.WriteFile(path, []byte(content), 0o644))
}

func requireExists(t *testing.T, path string) {
	t.Helper()
	_, err := os.Stat(path)
	require.NoErrorf(t, err, "expected %s to exist", path)
}

func requireMissing(t *testing.T, path string) {
	t.Helper()
	_, err := os.Stat(path)
	require.Truef(t, os.IsNotExist(err), "expected %s to be missing, got err=%v", path, err)
}
