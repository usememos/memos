package memogit

import (
	"context"
	"fmt"
	"io"
	"sort"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

// StatusResult is the computed sync state shown by `memogit status`.
type StatusResult struct {
	// Local changes pending push.
	LocalModified []string
	LocalNew      []string
	LocalDeleted  []string
	// LocalMoved holds "<old path> → <new path>" for files that moved or were
	// renamed in the work tree; push relocates the memo rather than recreating it.
	LocalMoved []string
	// Remote changes pending pull.
	RemoteNew     []string
	RemoteUpdated []string
	RemoteDeleted []string
	// Changed on both sides (a push/pull will report a conflict).
	Conflicts []string
	// Uncommitted git working-tree entries.
	GitDirty int
}

// Status computes and prints what is out of sync between the local checkout and
// the server, in two layers: (1) local vs server pending changes, and (2) the
// local git working tree. It is read-only — it hits the server to compare but
// never writes files, sync-state, or memos.
func Status(ctx context.Context, root string, cfg *Config, ws *WorkspaceConfig, out io.Writer) (*StatusResult, error) {
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
	contentRoot := ContentRoot(root, ws)

	res := &StatusResult{GitDirty: GitStatusPorcelain(root)}

	// Full current server listing (scoped to own memos in the workspace):
	// used for both remote-new/updated and remote-deleted detection.
	serverDocs, serverSubDocs, err := listInScope(ctx, client, ws, scopedFilter(scope, ws.Filter))
	if err != nil {
		return nil, err
	}
	current := append(serverDocs, serverSubDocs...)
	serverByUID := make(map[string]string, len(current)) // uid -> canonical server hash
	alive := make(map[string]bool, len(current))
	for _, m := range current {
		uid := uidFromName(m.GetName())
		serverByUID[uid] = CanonicalHash(m.GetContent())
		alive[uid] = true
	}

	// --- Local side: walk the work tree, classify each file. Identity comes from
	// the same resolution push uses, so a moved file is reported as a move here
	// and pushed as one. ---
	present, err := listDocFiles(contentRoot, state)
	if err != nil {
		return nil, err
	}
	docs, err := loadLocalDocs(contentRoot, present)
	if err != nil {
		return nil, err
	}
	resolveIdentities(docs, state)

	claimed := make(map[string]bool, len(docs))
	for _, doc := range docs {
		if doc.UID == "" {
			if doc.DocType != "PDF" { // generated stub, never pushed as new
				res.LocalNew = append(res.LocalNew, doc.Path)
			}
			continue
		}
		claimed[doc.UID] = true
		prev := state.Memos[doc.UID]
		if prev.Path != doc.Path {
			res.LocalMoved = append(res.LocalMoved, prev.Path+" → "+doc.Path)
		}
		if prev.DocType == "PDF" || doc.DocType == "PDF" {
			continue
		}
		localChanged := CanonicalHash(doc.Content) != prev.ContentHash
		serverChanged := alive[doc.UID] && serverByUID[doc.UID] != prev.ContentHash
		switch {
		case localChanged && serverChanged:
			res.Conflicts = append(res.Conflicts, doc.Path)
		case localChanged:
			res.LocalModified = append(res.LocalModified, doc.Path)
		}
	}

	// --- Remote side: tracked memos whose server hash moved (pull will bring
	// them down), plus brand-new server memos and server-side deletions. ---
	for uid, srvHash := range serverByUID {
		prev, tracked := state.Memos[uid]
		if !tracked {
			// New on the server; name it by where it will land locally.
			res.RemoteNew = append(res.RemoteNew, serverPath(ws, current, uid))
			continue
		}
		if srvHash != prev.ContentHash && !contains(res.Conflicts, prev.Path) {
			res.RemoteUpdated = append(res.RemoteUpdated, prev.Path)
		}
	}
	for _, uid := range sortedUIDs(state) {
		if !alive[uid] {
			res.RemoteDeleted = append(res.RemoteDeleted, state.Memos[uid].Path)
		}
	}

	// Tracked memos no longer claimed by any local file → pending archive on push.
	// A file that merely moved was claimed above, so it is not a deletion.
	for _, uid := range sortedUIDs(state) {
		if !claimed[uid] && alive[uid] {
			res.LocalDeleted = append(res.LocalDeleted, state.Memos[uid].Path)
		}
	}

	printStatus(out, ws, res)
	return res, nil
}

// serverPath returns the local relative path a server memo (identified by uid)
// would map to, for display of remote-new documents.
func serverPath(ws *WorkspaceConfig, memos []*v1pb.Memo, uid string) string {
	for _, m := range memos {
		if uidFromName(m.GetName()) == uid {
			return ws.LocalRelPath(m.GetFolderPath(), m.GetTitle(), docTypeString(m))
		}
	}
	return uid
}

func contains(ss []string, s string) bool {
	for _, x := range ss {
		if x == s {
			return true
		}
	}
	return false
}

func printStatus(out io.Writer, ws *WorkspaceConfig, res *StatusResult) {
	fmt.Fprintf(out, "memogit status (workspace %q)\n\n", ws.Title)

	type line struct {
		marker string
		items  []string
	}
	group := func(title string, lines ...line) {
		total := 0
		for _, l := range lines {
			total += len(l.items)
		}
		if total == 0 {
			return
		}
		fmt.Fprintf(out, "%s\n", title)
		for _, l := range lines {
			items := append([]string(nil), l.items...)
			sort.Strings(items)
			for _, it := range items {
				fmt.Fprintf(out, "  %s %s\n", l.marker, it)
			}
		}
		fmt.Fprintln(out)
	}

	group("Local changes to push:",
		line{"~", res.LocalModified}, line{"+", res.LocalNew},
		line{"→", res.LocalMoved}, line{"-", res.LocalDeleted})
	group("Remote changes to pull:",
		line{"~", res.RemoteUpdated}, line{"+", res.RemoteNew}, line{"-", res.RemoteDeleted})
	group("Conflicts (changed on both sides — resolve manually):",
		line{"⚠", res.Conflicts})

	nLocal := len(res.LocalModified) + len(res.LocalNew) + len(res.LocalDeleted) + len(res.LocalMoved)
	nRemote := len(res.RemoteUpdated) + len(res.RemoteNew) + len(res.RemoteDeleted)
	if nLocal == 0 && nRemote == 0 && len(res.Conflicts) == 0 {
		fmt.Fprintln(out, "In sync with the server. Nothing to push or pull.")
	} else {
		fmt.Fprintf(out, "Summary: %d to push, %d to pull, %d conflicts.\n", nLocal, nRemote, len(res.Conflicts))
	}
}

// Quiet reports whether the workspace has nothing pending against the server.
// The git working tree is deliberately excluded: it is a property of the whole
// checkout, not of one knowledge base.
func (r *StatusResult) Quiet() bool {
	return len(r.LocalModified)+len(r.LocalNew)+len(r.LocalDeleted)+len(r.LocalMoved)+
		len(r.RemoteUpdated)+len(r.RemoteNew)+len(r.RemoteDeleted)+len(r.Conflicts) == 0
}
