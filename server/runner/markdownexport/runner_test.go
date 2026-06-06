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
		require.Equal(t, expected, renderMemo(memo, nil, ""))
	})

	t.Run("attachments listed after tags, with filename and path", func(t *testing.T) {
		memo := &store.Memo{
			UID:        "memo-att",
			CreatedTs:  time.Date(2024, 1, 2, 3, 4, 5, 0, time.UTC).Unix(),
			UpdatedTs:  time.Date(2024, 1, 2, 3, 4, 5, 0, time.UTC).Unix(),
			Visibility: store.Private,
			Content:    "see attached",
			Payload:    &storepb.MemoPayload{Tags: []string{"work"}},
		}
		// Out of order on input, with a name that needs YAML quoting, to confirm
		// we sort by filename and escape arbitrary user input.
		attachments := []*store.Attachment{
			{UID: "att2", Filename: "report: final.pdf", StorageType: storepb.AttachmentStorageType_LOCAL, Reference: "assets/2_report.pdf"},
			{UID: "att1", Filename: "diagram.png", StorageType: storepb.AttachmentStorageType_LOCAL, Reference: "assets/1_diagram.png"},
		}
		expected := strings.Join([]string{
			"---",
			"uid: memo-att",
			"created: 2024-01-02T03:04:05Z",
			"updated: 2024-01-02T03:04:05Z",
			"visibility: PRIVATE",
			"pinned: false",
			"tags:",
			"  - work",
			"attachments:",
			`  - filename: "diagram.png"`,
			`    path: "assets/1_diagram.png"`,
			`  - filename: "report: final.pdf"`,
			`    path: "assets/2_report.pdf"`,
			"---",
			"",
			"see attached",
			"",
		}, "\n")
		require.Equal(t, expected, renderMemo(memo, attachments, ""))
	})

	t.Run("attachment without a stored path omits the path line", func(t *testing.T) {
		memo := &store.Memo{
			UID:        "memo-nopath",
			Visibility: store.Private,
			Content:    "x",
			Payload:    &storepb.MemoPayload{},
		}
		// No storage type or reference (e.g. DB-stored): filename only, no path.
		attachments := []*store.Attachment{{UID: "a", Filename: "note.txt"}}
		rendered := renderMemo(memo, attachments, "")
		require.Contains(t, rendered, "attachments:\n  - filename: \"note.txt\"\n")
		require.NotContains(t, rendered, "path:")
	})

	t.Run("s3 attachment records the object key, not the presigned url", func(t *testing.T) {
		memo := &store.Memo{
			UID:        "memo-s3",
			Visibility: store.Private,
			Content:    "x",
			Payload:    &storepb.MemoPayload{},
		}
		attachments := []*store.Attachment{{
			UID:         "a",
			Filename:    "photo.jpg",
			StorageType: storepb.AttachmentStorageType_S3,
			// A volatile presigned URL; it must not leak into the stable export.
			Reference: "https://bucket.s3.amazonaws.com/assets/photo.jpg?X-Amz-Signature=deadbeef",
			Payload: &storepb.AttachmentPayload{
				Payload: &storepb.AttachmentPayload_S3Object_{
					S3Object: &storepb.AttachmentPayload_S3Object{Key: "assets/photo.jpg"},
				},
			},
		}}
		rendered := renderMemo(memo, attachments, "")
		require.Contains(t, rendered, "    path: \"assets/photo.jpg\"\n")
		require.NotContains(t, rendered, "X-Amz-Signature")
	})

	t.Run("duplicate filenames kept, ordered by uid", func(t *testing.T) {
		memo := &store.Memo{
			UID:        "memo-dup",
			Visibility: store.Private,
			Content:    "x",
			Payload:    &storepb.MemoPayload{},
		}
		attachments := []*store.Attachment{
			{UID: "b", Filename: "image.png", StorageType: storepb.AttachmentStorageType_LOCAL, Reference: "assets/b_image.png"},
			{UID: "a", Filename: "image.png", StorageType: storepb.AttachmentStorageType_LOCAL, Reference: "assets/a_image.png"},
		}
		rendered := renderMemo(memo, attachments, "")
		require.Contains(t, rendered, "attachments:\n  - filename: \"image.png\"\n    path: \"assets/a_image.png\"\n  - filename: \"image.png\"\n    path: \"assets/b_image.png\"\n")
	})

	t.Run("local path is relativized to the data dir", func(t *testing.T) {
		memo := &store.Memo{
			UID:        "memo-rel",
			Visibility: store.Private,
			Content:    "x",
			Payload:    &storepb.MemoPayload{},
		}
		dataDir := filepath.Join(string(filepath.Separator)+"var", "memos-data")
		attachments := []*store.Attachment{
			// Under the data dir: relativized to "assets/...".
			{UID: "a", Filename: "in.png", StorageType: storepb.AttachmentStorageType_LOCAL, Reference: filepath.Join(dataDir, "assets", "1_in.png")},
			// Outside the data dir: kept absolute (a "../.." path is less useful).
			{UID: "b", Filename: "out.png", StorageType: storepb.AttachmentStorageType_LOCAL, Reference: filepath.Join(string(filepath.Separator)+"mnt", "blobs", "2_out.png")},
		}
		rendered := renderMemo(memo, attachments, dataDir)
		require.Contains(t, rendered, "    path: \"assets/1_in.png\"\n")
		require.Contains(t, rendered, "    path: "+yamlQuoteString(filepath.Join(string(filepath.Separator)+"mnt", "blobs", "2_out.png"))+"\n")
	})

	t.Run("no attachments omits attachments block", func(t *testing.T) {
		memo := &store.Memo{
			UID:        "memo-noatt",
			Visibility: store.Private,
			Content:    "x",
			Payload:    &storepb.MemoPayload{},
		}
		require.NotContains(t, renderMemo(memo, nil, ""), "attachments:")
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
		rendered := renderMemo(memo, nil, "")
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
		require.True(t, strings.HasSuffix(renderMemo(memo, nil, ""), "single line\n"))
	})

	t.Run("nil payload tolerated", func(t *testing.T) {
		memo := &store.Memo{
			UID:        "memo-nil",
			Visibility: store.Protected,
			Content:    "x",
			Payload:    nil,
		}
		require.Contains(t, renderMemo(memo, nil, ""), "visibility: PROTECTED\n")
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

	// Attach two files to memoa2. They are created in non-alphabetical order
	// and share a creation timestamp, so the export must impose its own stable
	// (filename) order rather than relying on the store's newest-first listing.
	// References are absolute paths under the data dir (as the store writes them)
	// so the export must relativize them; the files don't exist on disk, which
	// the delete cascade tolerates, so deleting memoa2 below stays clean.
	_, err = st.CreateAttachment(ctx, &store.Attachment{
		UID:         "attreport",
		CreatorID:   alice.ID,
		Filename:    "report.pdf",
		Type:        "application/pdf",
		StorageType: storepb.AttachmentStorageType_LOCAL,
		Reference:   filepath.Join(dataDir, "assets", "1700000000_report.pdf"),
		MemoID:      &aliceMemo2.ID,
	})
	require.NoError(t, err)
	_, err = st.CreateAttachment(ctx, &store.Attachment{
		UID:         "attdiagram",
		CreatorID:   alice.ID,
		Filename:    "diagram.png",
		Type:        "image/png",
		StorageType: storepb.AttachmentStorageType_LOCAL,
		Reference:   filepath.Join(dataDir, "assets", "1700000001_diagram.png"),
		MemoID:      &aliceMemo2.ID,
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
	require.Contains(t, bodyStr,
		"attachments:\n"+
			"  - filename: \"diagram.png\"\n    path: \"assets/1700000001_diagram.png\"\n"+
			"  - filename: \"report.pdf\"\n    path: \"assets/1700000000_report.pdf\"\n")
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
