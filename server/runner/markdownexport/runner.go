// Package markdownexport provides a background runner that mirrors all memos
// to a directory of markdown files on disk. It performs a one-way sync from the
// store to the filesystem: new memos become files, deleted memos have their
// files pruned, and unchanged memos are left untouched (preserving mtimes).
//
// The export layout is:
//
//	<exportDir>/<username>/<YYYY-MM-DD>/<uid>.md
//
// The <date> directory tracks each memo's creation time so a memo's path
// never changes — edits rewrite the file in place. The <uid> leaf keeps
// every memo mapped to exactly one file, so deletes prune cleanly even when
// many memos share a date.
//
// Each file carries YAML frontmatter (uid, created, updated, visibility,
// pinned, tags) followed by the raw markdown content of the memo.
//
// Configuration (via environment):
//   - MEMOS_MARKDOWN_EXPORT_DIR: writable path to export into. If unset, the
//     runner is a no-op. A relative path resolves under the instance data
//     directory (Profile.Data); an absolute path is used as-is.
package markdownexport

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/store"
)

// Schedule the runner once a day. The work is cheap, but there is no value in
// running it more often for a filesystem mirror.
const runnerInterval = time.Second * 10

// listBatchSize bounds how many memos we pull from the store per query so the
// runner stays gentle on large instances.
const listBatchSize = 200

// unsafeFilenameChars matches anything we don't want to appear in a path
// segment derived from a username or uid.
var unsafeFilenameChars = regexp.MustCompile(`[^A-Za-z0-9._-]`)

type Runner struct {
	Store   *store.Store
	Profile *profile.Profile
}

func NewRunner(store *store.Store, profile *profile.Profile) *Runner {
	return &Runner{
		Store:   store,
		Profile: profile,
	}
}

func (r *Runner) Run(ctx context.Context) {
	ticker := time.NewTicker(runnerInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			r.RunOnce(ctx)
		case <-ctx.Done():
			return
		}
	}
}

func (r *Runner) RunOnce(ctx context.Context) {
	exportDir := r.exportDir()
	if exportDir == "" {
		// Feature disabled; nothing to do.
		return
	}

	if err := r.export(ctx, exportDir); err != nil {
		slog.Error("markdown export failed", slog.String("error", err.Error()))
	}
}

// exportDir resolves the configured export directory, or "" if disabled.
func (r *Runner) exportDir() string {
	dir := strings.TrimSpace(os.Getenv("MEMOS_MARKDOWN_EXPORT_DIR"))
	if dir == "" {
		return ""
	}
	if !filepath.IsAbs(dir) && r.Profile != nil && r.Profile.Data != "" {
		dir = filepath.Join(r.Profile.Data, dir)
	}
	return dir
}

// memoDate returns the YYYY-MM-DD directory name for a memo, in UTC.
//
// UTC is used for determinism: the same memo always lands in the same folder
// regardless of the host's timezone or DST. The memos web UI renders dates in
// the viewer's local timezone, so a late-evening memo may appear under the
// adjacent day here; that's the price of a stable, reproducible layout.
func memoDate(memo *store.Memo) string {
	return time.Unix(memo.CreatedTs, 0).UTC().Format("2006-01-02")
}

func (r *Runner) export(ctx context.Context, exportDir string) error {
	if err := os.MkdirAll(exportDir, 0o755); err != nil {
		return errors.Wrap(err, "create export dir")
	}

	// Build a creator_id -> username map up front so each memo file lands in
	// the right per-user folder.
	users, err := r.Store.ListUsers(ctx, &store.FindUser{})
	if err != nil {
		return errors.Wrap(err, "list users")
	}
	usernameByID := make(map[int32]string, len(users))
	for _, u := range users {
		usernameByID[u.ID] = u.Username
	}

	// Track every file we write this run. Anything in the tree that we did not
	// write is an orphan (its memo was deleted or archived) and gets pruned.
	written := make(map[string]struct{})

	normal := store.Normal
	offset := 0
	for {
		limit := listBatchSize
		off := offset
		memos, err := r.Store.ListMemos(ctx, &store.FindMemo{
			RowStatus: &normal,
			Limit:     &limit,
			Offset:    &off,
		})
		if err != nil {
			return errors.Wrap(err, "list memos")
		}
		if len(memos) == 0 {
			break
		}

		for _, memo := range memos {
			username := usernameByID[memo.CreatorID]
			if username == "" {
				// Defensive: memo with no resolvable owner. Bucket it so we
				// never silently drop data.
				username = fmt.Sprintf("user-%d", memo.CreatorID)
			}

			relPath := filepath.Join(safeSegment(username), memoDate(memo), safeSegment(memo.UID)+".md")
			absPath := filepath.Join(exportDir, relPath)

			if err := writeIfChanged(absPath, renderMemo(memo)); err != nil {
				slog.Error("failed to write memo file",
					slog.String("path", absPath),
					slog.String("error", err.Error()))
				continue
			}
			written[absPath] = struct{}{}
		}

		offset += len(memos)
	}

	pruneOrphans(exportDir, written)
	slog.Info("markdown export complete",
		slog.String("dir", exportDir),
		slog.Int("files", len(written)))
	return nil
}

// renderMemo produces the full file body: YAML frontmatter + raw content.
func renderMemo(memo *store.Memo) string {
	var b strings.Builder
	b.WriteString("---\n")
	fmt.Fprintf(&b, "uid: %s\n", memo.UID)
	fmt.Fprintf(&b, "created: %s\n", time.Unix(memo.CreatedTs, 0).UTC().Format(time.RFC3339))
	fmt.Fprintf(&b, "updated: %s\n", time.Unix(memo.UpdatedTs, 0).UTC().Format(time.RFC3339))
	fmt.Fprintf(&b, "visibility: %s\n", memo.Visibility.String())
	fmt.Fprintf(&b, "pinned: %t\n", memo.Pinned)

	if tags := memo.Payload.GetTags(); len(tags) > 0 {
		// Stable order so unchanged memos don't churn the file.
		sorted := append([]string(nil), tags...)
		slices.Sort(sorted)
		b.WriteString("tags:\n")
		for _, t := range sorted {
			fmt.Fprintf(&b, "  - %s\n", t)
		}
	}

	b.WriteString("---\n\n")
	b.WriteString(memo.Content)
	if !strings.HasSuffix(memo.Content, "\n") {
		b.WriteString("\n")
	}
	return b.String()
}

// writeIfChanged writes content only when the file is absent or differs, so we
// preserve mtimes for downstream tools (backups, indexers, file watchers).
func writeIfChanged(path, content string) error {
	if existing, err := os.ReadFile(path); err == nil && string(existing) == content {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(content), 0o644)
}

// pruneOrphans removes any .md file under exportDir that we did not write this
// run, then cleans up now-empty user directories.
func pruneOrphans(exportDir string, written map[string]struct{}) {
	_ = filepath.Walk(exportDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			// Skip unreadable entries; one bad path shouldn't stop pruning siblings.
			slog.Warn("markdown export walk error",
				slog.String("path", path),
				slog.String("error", err.Error()))
			return nil //nolint:nilerr // intentional: skip and keep walking
		}
		if info.IsDir() {
			return nil
		}
		if !strings.HasSuffix(path, ".md") {
			return nil
		}
		if _, ok := written[path]; !ok {
			if rmErr := os.Remove(path); rmErr != nil {
				slog.Error("failed to prune orphan file",
					slog.String("path", path),
					slog.String("error", rmErr.Error()))
			}
		}
		return nil
	})

	// Remove now-empty directories (date folders, then user folders) bottom-up.
	// Collect directories first so we delete children before parents in one
	// pass; os.Remove only succeeds on already-empty dirs, so a date folder
	// must go before we can clear its parent user folder.
	var dirs []string
	_ = filepath.Walk(exportDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			slog.Warn("markdown export walk error",
				slog.String("path", path),
				slog.String("error", err.Error()))
			return nil //nolint:nilerr // intentional: skip and keep walking
		}
		if !info.IsDir() || path == exportDir {
			return nil
		}
		dirs = append(dirs, path)
		return nil
	})
	// Deepest paths last in lexical order isn't guaranteed, so sort by descending
	// length: longer paths are deeper, so removing them first empties parents.
	slices.SortFunc(dirs, func(a, b string) int { return len(b) - len(a) })
	for _, dir := range dirs {
		if sub, err := os.ReadDir(dir); err == nil && len(sub) == 0 {
			_ = os.Remove(dir)
		}
	}
}

// safeSegment makes a string safe to use as a single path segment.
func safeSegment(s string) string {
	s = unsafeFilenameChars.ReplaceAllString(s, "_")
	if s == "" || s == "." || s == ".." {
		return "_"
	}
	return s
}
