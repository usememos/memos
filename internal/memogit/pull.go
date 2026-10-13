package memogit

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

// PullResult summarizes a pull run.
type PullResult struct {
	Added             int
	Updated           int
	Unchanged         int
	Conflicts         []string // uids skipped because both sides changed
	Missing           []string // uids whose local file is gone (pending push)
	Attachments       int      // attachment files freshly downloaded this pull
	AttachmentsFailed int      // attachments the server refused to serve (retried next pull)
	Removed           int      // local files removed because deleted/archived on server
	Orphaned          []string // paths deleted on server but kept (locally modified)
}

// Quiet reports whether the pull changed nothing locally and left nothing
// needing the user's attention.
func (r *PullResult) Quiet() bool {
	return r.Added+r.Updated+r.Removed+r.Attachments+r.AttachmentsFailed+
		len(r.Conflicts)+len(r.Missing)+len(r.Orphaned) == 0
}

// Pull incrementally fetches memos changed on the server since the last sync,
// updates local files where only the server changed, and commits. Files where
// both server and local changed are reported as conflicts and left untouched.
func Pull(ctx context.Context, root string, cfg *Config, ws *WorkspaceConfig, out io.Writer) (*PullResult, error) {
	state, err := LoadState(root, ws.stateName())
	if err != nil {
		return nil, err
	}
	if ws.Workspace == "" {
		return nil, fmt.Errorf("config missing workspace; re-run `memogit clone` (older config?)")
	}
	client := NewClient(cfg)
	scope, err := currentScope(ctx, client)
	if err != nil {
		return nil, err
	}
	if err := syncWorkspaceTitle(ctx, client, root, cfg, ws, out); err != nil {
		return nil, err
	}

	// Overlap by one second to avoid missing memos updated in the same second
	// as the last sync; the hash comparison below dedupes the overlap.
	sinceUnix := state.LastSync.Unix() - 1
	// updated_ts is a timestamp field in the CEL schema, so compare against
	// timestamp(<epoch>) rather than a bare int.
	filter := andFilter(scopedFilter(scope, ws.Filter), fmt.Sprintf("updated_ts > timestamp(%d)", sinceUnix))
	fmt.Fprintf(out, "Pulling changes since %s (workspace %q) ...\n", state.LastSync.Format(time.RFC3339), ws.Title)

	// Sub-documents come with their parents. Writing one bumps its parent's
	// update_time, which is what puts that parent in this incremental listing in
	// the first place, so a sub-document edited on its own is never missed.
	memos, subDocs, err := listInScope(ctx, client, ws, filter)
	if err != nil {
		return nil, err
	}
	parents := newParentIndex(ws, state, memos)
	memos = append(memos, subDocs...)

	contentRoot := ContentRoot(root, ws)
	res := &PullResult{}
	warn := &attachmentWarner{out: out}
	for _, m := range memos {
		uid := uidFromName(m.GetName())
		newState := memoState(ws, parents, m) // path + metadata + canonical server hash
		serverHash := newState.ContentHash

		prev, tracked := state.Memos[uid]
		if !tracked {
			// New memo on the server.
			ms, nDown, err := exportMemo(ctx, client, ws, parents, contentRoot, m, nil, warn)
			if err != nil {
				return nil, err
			}
			state.Memos[uid] = ms
			res.Added++
			res.Attachments += nDown
			fmt.Fprintf(out, "  + %s\n", ms.Path)
			continue
		}

		if serverHash == prev.ContentHash && newState.Path == prev.Path {
			res.Unchanged++
			continue // server didn't really change (overlap re-fetch)
		}

		localPath := filepath.Join(contentRoot, prev.Path)

		// PDF documents have no editable body — the local file is a generated
		// stub, so there is no "local edit" to conflict with. Just re-export and
		// adopt the server state.
		if prev.DocType == "PDF" || newState.DocType == "PDF" {
			ms, nDown, err := relocateMemo(ctx, client, ws, parents, contentRoot, prev.Path, m, &prev, warn)
			if err != nil {
				return nil, err
			}
			state.Memos[uid] = ms
			res.Updated++
			res.Attachments += nDown
			fmt.Fprintf(out, "  ~ %s\n", ms.Path)
			continue
		}

		// Read the local file to see whether it changed since last sync.
		data, readErr := os.ReadFile(localPath)
		if os.IsNotExist(readErr) {
			res.Missing = append(res.Missing, uid)
			fmt.Fprintf(out, "  ! %s: local file missing, skipped (resolve on push)\n", prev.Path)
			continue
		} else if readErr != nil {
			return nil, fmt.Errorf("read %s: %w", prev.Path, readErr)
		}
		if localHash(data) != prev.ContentHash {
			// Both sides changed → conflict. Leave the local file alone, but write
			// the server version to "<path>.remote" so the user can merge in their
			// editor, and record the conflict so push knows when it's resolved.
			if err := writeConflictSidecar(contentRoot, prev.Path, FileContent(m, prev.Attachments)); err != nil {
				return nil, err
			}
			p := prev
			p.ConflictServerHash = serverHash
			state.Memos[uid] = p
			res.Conflicts = append(res.Conflicts, uid)
			fmt.Fprintf(out, "  ⚠ %s: conflict — server version written to %s, merge and delete it, then push\n",
				prev.Path, conflictSidecarRel(prev.Path))
			continue
		}

		// Only the server changed → adopt server content, relocating the file if
		// its folder_path/title (and thus path) changed.
		ms, nDown, err := relocateMemo(ctx, client, ws, parents, contentRoot, prev.Path, m, &prev, warn)
		if err != nil {
			return nil, err
		}
		// Any prior conflict for this doc is now moot; drop its sidecar.
		removeConflictSidecar(contentRoot, prev.Path)
		removeConflictSidecar(contentRoot, ms.Path)
		state.Memos[uid] = ms
		res.Updated++
		res.Attachments += nDown
		fmt.Fprintf(out, "  ~ %s\n", ms.Path)
	}

	// Reconcile against a full current listing: catches server-side deletions
	// (never returned by the incremental filter) and path drift (memos whose
	// folder/title changed without their updated_ts moving).
	if err := reconcileFullListing(ctx, client, ws, scope, contentRoot, state, res, out, warn); err != nil {
		return nil, err
	}

	// Stamp any tracked file that lost (or never had) its identity marker, so a
	// later `mv` in the work tree is still recognisable as a move.
	if n, err := ensureLocalIDs(contentRoot, state); err != nil {
		return nil, err
	} else if n > 0 {
		fmt.Fprintf(out, "  stamped %d file(s) with their memogit id\n", n)
	}

	res.AttachmentsFailed = warn.failed
	state.LastSync = time.Now().UTC()
	// Re-record the server this baseline was actually synced against, so moving
	// the instance to a new URL doesn't leave the old hostname in the state file
	// forever (it is written at clone time and never read back).
	state.Server = cfg.Server
	if err := state.Save(root, ws.stateName()); err != nil {
		return nil, err
	}
	// Refresh the agent guide silently, so a checkout picks up manual updates
	// that shipped with a newer memogit.
	if err := WriteAgentDocs(root, cfg, nil); err != nil {
		return nil, err
	}
	if err := GitCommitAll(root, commitMessage(ws, res)); err != nil {
		return nil, err
	}

	fmt.Fprintf(out, "Pull complete: %d added, %d updated, %d removed, %d unchanged, %d conflicts, %d attachments downloaded.\n",
		res.Added, res.Updated, res.Removed, res.Unchanged, len(res.Conflicts), res.Attachments)
	if len(res.Conflicts) > 0 {
		fmt.Fprintf(out, "Conflicts left for manual resolution (uids): %v\n", res.Conflicts)
	}
	if len(res.Orphaned) > 0 {
		fmt.Fprintf(out, "Deleted on server but kept (locally modified): %v\n", res.Orphaned)
	}
	if res.AttachmentsFailed > 0 {
		fmt.Fprintf(out, "%d attachment(s) could not be downloaded (see ! lines above); the next pull retries them.\n", res.AttachmentsFailed)
	}
	return res, nil
}

// syncWorkspaceTitle follows a server-side rename. The workspace is tracked by
// its resource name, which never changes, so a renamed knowledge base stays
// bound to the same local files: only the recorded title is refreshed (used to
// select it on the command line). The checkout directory is deliberately left
// alone — renaming it would move every tracked file and lose git blame — so
// after a rename the folder keeps its original name.
//
// A workspace that no longer exists is reported rather than treated as "every
// memo was deleted", which would otherwise wipe the local files.
func syncWorkspaceTitle(ctx context.Context, client *Client, root string, cfg *Config, ws *WorkspaceConfig, out io.Writer) error {
	remote, err := client.WorkspaceByName(ctx, ws.Workspace)
	if err != nil {
		return err
	}
	if remote == nil {
		return fmt.Errorf("workspace %q (%s) no longer exists on the server; "+
			"local files in %s/ were left untouched", ws.Title, ws.Workspace, ws.Dir)
	}
	if remote.GetTitle() == ws.Title {
		return nil
	}
	fmt.Fprintf(out, "  workspace renamed on the server: %q → %q (folder %s/ unchanged)\n",
		ws.Title, remote.GetTitle(), ws.Dir)
	ws.Title = remote.GetTitle()
	return cfg.Save(root)
}

// reconcileFullListing walks a full current listing (scoped to the user's own
// memos in the workspace) and fixes up two things the incremental pass can miss:
//
//   - deletions/archives: tracked uids no longer present are removed locally,
//     except when the local file has unpushed edits, which are kept and recorded
//     in res.Orphaned for the user to resolve on push.
//   - path or content drift: a tracked memo whose server folder_path/title or
//     content no longer matches the local file is brought back in line. The
//     incremental filter only looks forward from last_sync, so any change older
//     than the watermark is invisible to it forever; comparing against the full
//     listing here makes pull self-healing.
//   - untracked memos: anything alive on the server but absent from the baseline
//     is exported as an add. The incremental filter only ever looks forward from
//     last_sync, so a memo whose last update predates the watermark is invisible
//     to it forever; the full listing is the ground truth that closes that gap.
func reconcileFullListing(ctx context.Context, client *Client, ws *WorkspaceConfig, scope syncScope, contentRoot string, state *State, res *PullResult, out io.Writer, warn *attachmentWarner) error {
	// Sparse checkout: a memo that left the mapped folder is no longer "alive"
	// here, so it is reconciled as a local removal below.
	//
	// Sub-documents must be in this listing too, and for a sharper reason than in
	// the incremental pass: everything tracked but absent from it is treated as
	// deleted on the server and removed locally. Leaving them out would delete
	// every sub-document from the checkout on the first reconcile.
	inScope, subDocs, err := listInScope(ctx, client, ws, scopedFilter(scope, ws.Filter))
	if err != nil {
		return err
	}
	parents := newParentIndex(ws, state, inScope)
	return reconcileAgainst(ctx, client, ws, parents, contentRoot, append(inScope, subDocs...), state, res, out, warn)
}

// reconcileAgainst is reconcileFullListing's logic over an already-fetched
// listing: the pure step, and the unit-test seam that needs no server.
func reconcileAgainst(ctx context.Context, client *Client, ws *WorkspaceConfig, parents parentIndex, contentRoot string, current []*v1pb.Memo, state *State, res *PullResult, out io.Writer, warn *attachmentWarner) error {
	alive := make(map[string]*v1pb.Memo, len(current))
	for _, m := range current {
		alive[uidFromName(m.GetName())] = m
	}

	for _, uid := range sortedUIDs(state) {
		if m := alive[uid]; m != nil {
			if err := reconcileDrifted(ctx, client, ws, parents, contentRoot, uid, m, state, res, out, warn); err != nil {
				return err
			}
			continue
		}
		prev := state.Memos[uid]
		full := filepath.Join(contentRoot, prev.Path)

		// Keep the file if it has local edits we haven't pushed (don't lose work).
		if data, readErr := os.ReadFile(full); readErr == nil && prev.DocType != "PDF" &&
			localHash(data) != prev.ContentHash {
			res.Orphaned = append(res.Orphaned, prev.Path)
			fmt.Fprintf(out, "  ⚠ %s: %s but modified locally, kept\n", prev.Path, goneReason(ws))
			continue
		}

		if err := os.Remove(full); err != nil && !os.IsNotExist(err) {
			return fmt.Errorf("remove %s: %w", prev.Path, err)
		}
		pruneEmptyDirs(contentRoot, filepath.Dir(full))
		removeMemoAttachments(contentRoot, prev.Attachments)
		delete(state.Memos, uid)
		res.Removed++
		fmt.Fprintf(out, "  - %s: removed (%s)\n", prev.Path, goneReason(ws))
	}

	// Adopt anything alive but untracked. current is ordered create_time asc, so
	// the adds come out oldest-first regardless of when they were missed.
	for _, m := range current {
		uid := uidFromName(m.GetName())
		if _, tracked := state.Memos[uid]; tracked {
			continue
		}
		ms, nDown, err := exportMemo(ctx, client, ws, parents, contentRoot, m, nil, warn)
		if err != nil {
			return err
		}
		state.Memos[uid] = ms
		res.Added++
		res.Attachments += nDown
		fmt.Fprintf(out, "  + %s\n", ms.Path)
	}
	return nil
}

// reconcileDrifted brings a tracked memo's local file back in line with the full
// server listing, for drift the incremental pass could not see — in path
// (folder/title changed) or in content. Both are invisible to the updated_ts
// filter once the change predates the watermark, which is how a document ends up
// permanently reported as "to pull" while pull keeps finding nothing to do. The
// full listing carries the server's content, so it is the ground truth for both.
//
// A locally modified file is never overwritten: a pure move would discard where
// the edit lives, and a content difference with edits on both sides is a genuine
// conflict. Either way the file is kept and reported so the user can push first.
func reconcileDrifted(ctx context.Context, client *Client, ws *WorkspaceConfig, parents parentIndex, contentRoot, uid string, m *v1pb.Memo, state *State, res *PullResult, out io.Writer, warn *attachmentWarner) error {
	prev := state.Memos[uid]
	next := memoState(ws, parents, m)
	movedOnServer := next.Path != prev.Path
	changedOnServer := next.ContentHash != prev.ContentHash
	if !movedOnServer && !changedOnServer {
		return nil
	}

	// PDF documents have no editable body — the local file is a generated stub,
	// so there is nothing a local edit could conflict with.
	if prev.DocType != "PDF" && next.DocType != "PDF" {
		data, readErr := os.ReadFile(filepath.Join(contentRoot, prev.Path))
		if readErr != nil {
			// Missing/unreadable file: the incremental pass already reports these.
			return nil
		}
		if localHash(data) != prev.ContentHash {
			if changedOnServer {
				// Both sides changed → hand the server version over for merging,
				// exactly as the incremental pass does.
				if err := writeConflictSidecar(contentRoot, prev.Path, FileContent(m, prev.Attachments)); err != nil {
					return err
				}
				p := prev
				p.ConflictServerHash = next.ContentHash
				state.Memos[uid] = p
				res.Conflicts = append(res.Conflicts, uid)
				fmt.Fprintf(out, "  ⚠ %s: conflict — server version written to %s, merge and delete it, then push\n",
					prev.Path, conflictSidecarRel(prev.Path))
				return nil
			}
			res.Orphaned = append(res.Orphaned, prev.Path)
			fmt.Fprintf(out, "  ⚠ %s: moved on server to %s but modified locally, kept in place\n", prev.Path, next.Path)
			return nil
		}
	}

	ms, nDown, err := relocateMemo(ctx, client, ws, parents, contentRoot, prev.Path, m, &prev, warn)
	if err != nil {
		return err
	}
	removeConflictSidecar(contentRoot, prev.Path)
	removeConflictSidecar(contentRoot, ms.Path)
	state.Memos[uid] = ms
	res.Updated++
	res.Attachments += nDown
	if movedOnServer {
		fmt.Fprintf(out, "  → %s → %s\n", prev.Path, ms.Path)
	} else {
		fmt.Fprintf(out, "  ~ %s\n", ms.Path)
	}
	return nil
}

func commitMessage(ws *WorkspaceConfig, res *PullResult) string {
	return fmt.Sprintf("memogit pull %s: %d added, %d updated", ws.Title, res.Added, res.Updated)
}

// goneReason says why a tracked document dropped out of the live listing. In a
// scoped checkout it may still be alive on the server, just moved out of the
// checkout's folders (or the folders were narrowed), and saying "deleted"
// there would send the user looking for a deletion that never happened.
func goneReason(ws *WorkspaceConfig) string {
	if ws.Sparse == "" && len(ws.Folders) == 0 {
		return "deleted/archived on server"
	}
	return "deleted/archived on server, or no longer under this checkout's " + ws.scopeLabel()
}
