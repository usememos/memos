package memogit

import (
	"context"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

// PushResult summarizes a push run.
type PushResult struct {
	Created   int
	Updated   int
	Moved     int
	Archived  int
	Unchanged int
	Conflicts []string // repo-relative paths skipped because both sides changed
	// Orphaned holds paths whose memo is no longer live on the server (archived
	// there, or hard-deleted) while the local file is still present. Nothing is
	// pushed for them; the user decides whether to restore the document or drop
	// the file.
	Orphaned []string
	// Skipped holds paths push refused to send because the local layout asks
	// for something the server cannot do (a sub-document with no parent to
	// bind to, a sub-document moved out of its folder, ...). Each is explained
	// by a "!" line; nothing about them changed on the server.
	Skipped []string
}

// Quiet reports whether the push moved nothing: no memo created, updated,
// relocated or archived, and nothing left needing the user's attention.
func (r *PushResult) Quiet() bool {
	return r.Created+r.Updated+r.Moved+r.Archived+len(r.Conflicts)+len(r.Orphaned)+len(r.Skipped) == 0
}

// skip records a file push will not send and says why on a "!" line.
func (r *PushResult) skip(out io.Writer, path, why string, args ...any) {
	r.Skipped = append(r.Skipped, path)
	fmt.Fprintf(out, "  ! %s: %s — skipped\n", path, fmt.Sprintf(why, args...))
}

// orphan records a tracked file whose document is no longer live on the server.
func (r *PushResult) orphan(out io.Writer, path string) {
	r.Orphaned = append(r.Orphaned, path)
	fmt.Fprintf(out, "  ! %s: archived or deleted on the server — local file kept. "+
		"Restore the document on the server, or delete this file and push to confirm the removal.\n", path)
}

// localDoc is one work-tree document file, resolved to the memo it belongs to.
type localDoc struct {
	// Path is the file's current repo-relative path.
	Path string
	// Content is the file body with the identity marker stripped — i.e. exactly
	// what the server should hold.
	Content string
	// MarkerUID is the uid the file itself claims, "" when it carries no marker.
	MarkerUID string
	// UID is the resolved identity: the memo this file will be pushed to, or ""
	// for a document that does not exist on the server yet.
	UID string
	// DocType is derived from the file extension.
	DocType string
}

// Push syncs local file changes back to the server: new files become memos
// (CreateMemo), edited tracked files update their memo's content
// (UpdateMemo, content-only), files that moved or were renamed relocate their
// memo (UpdateMemo folder_path/title, uid preserved), and tracked files deleted
// locally archive their memo (soft delete). Before updating a changed file it
// re-checks the server: if the server also changed since the last sync, the file
// is reported as a conflict and left for manual resolution (run `memogit pull`
// first).
//
// dryRun prints the plan without calling the API, mutating sync-state, or
// committing. Attachments are one-way (download only) and never pushed.
func Push(ctx context.Context, root string, cfg *Config, ws *WorkspaceConfig, dryRun bool, out io.Writer) (*PushResult, error) {
	state, err := LoadState(root, ws.stateName())
	if err != nil {
		return nil, err
	}
	if ws.Workspace == "" {
		return nil, fmt.Errorf("config missing workspace; re-run `memogit clone` (older config?)")
	}
	client := NewClient(cfg)
	contentRoot := ContentRoot(root, ws)
	parents := newParentIndex(ws, state, nil)

	present, err := listDocFiles(contentRoot, state)
	if err != nil {
		return nil, err
	}
	docs, err := loadLocalDocs(contentRoot, present)
	if err != nil {
		return nil, err
	}
	resolveIdentities(docs, state)

	live, err := liveMemos(ctx, client, ws)
	if err != nil {
		return nil, err
	}
	finder := newParentFinder(ws, docs, live)

	res := &PushResult{}
	fmt.Fprintf(out, "Pushing workspace %q ...\n", ws.Title)
	if dryRun {
		fmt.Fprintln(out, "Dry run — no changes will be sent.")
	}
	warnUnmarked(docs, out)

	// 1. New, moved, and modified local files. Files in ".subdocs" folders go
	// after everything else, so a parent created or moved in this same run
	// already has its identity when its sub-documents look for it
	// (listDocFiles sorts, so the output order within each pass is stable).
	for _, i := range pushOrder(docs) {
		doc := docs[i]
		if dir, nested := nestedUnderSubDocDir(doc.Path); nested {
			res.skip(out, doc.Path, "%s/ holds sub-documents directly and nothing can sit deeper inside it "+
				"(sub-documents are one level deep)", dir)
			continue
		}
		if parentRel, isSubDoc := ParentRelFromSubDocPath(doc.Path); isSubDoc {
			uid, err := pushSubDoc(ctx, client, ws, parents, finder, contentRoot, doc, parentRel, state, res, dryRun, out)
			if err != nil {
				return nil, err
			}
			if docs[i].UID == "" {
				docs[i].UID = uid
			}
			continue
		}

		if doc.UID == "" {
			if folder, outside := ws.outOfScope(doc.Path); outside {
				res.skip(out, doc.Path, "would be created in folder %q, outside this checkout's %s, and drop out of "+
					"the checkout on the next pull; put it inside one of them, or add the folder to %s",
					folder, ws.scopeLabel(), RepoConfigFile)
				continue
			}
			folderPath, _, _ := deriveMemoFromPath(doc.Path)
			created, err := pushNewDoc(ctx, client, ws, parents, contentRoot, doc, ws.ServerFolderPath(folderPath), state, res, dryRun, out)
			if err != nil {
				return nil, err
			}
			// Record the identity the server just handed out: the archive pass below
			// works off claimed identities, and a document created moments ago must
			// not look like one whose file went missing. Its sub-documents, later
			// in this run, look it up the same way.
			if created != nil {
				docs[i].UID = uidFromName(created.GetName())
				finder.live[docs[i].UID] = created
			}
			continue
		}

		// The document is tracked, but is it still live on the server? Without this
		// check an unchanged file never touches the network, so a document archived
		// on the web reads as "in sync" forever: the user keeps pushing, keeps
		// seeing "unchanged", and never learns their document is not published.
		current := live[doc.UID]
		if current == nil {
			res.orphan(out, doc.Path)
			continue
		}

		prev := state.Memos[doc.UID]
		if prev.Path != doc.Path {
			if _, isSubDoc := ParentUIDFromSubDocFolder(current.GetFolderPath()); isSubDoc {
				// The server would refuse the move anyway; saying why here beats an
				// RPC error, and leaves the rest of the push to go through.
				res.skip(out, doc.Path, "is a sub-document and cannot leave its parent's %s folder; "+
					"move it back to %s", SubDocDirSuffix, prev.Path)
				continue
			}
			if folder, outside := ws.outOfScope(doc.Path); outside {
				// Moving the document out of the checkout's folders is a real server
				// move, but the next pull would then drop the file, so it looks like
				// the document vanished. Leave that to the web UI, where it is seen.
				res.skip(out, doc.Path, "would move the document to folder %q, outside this checkout's %s; "+
					"move it back to %s, or move the document in the web UI", folder, ws.scopeLabel(), prev.Path)
				continue
			}
			// The file moved or was renamed locally. Relocate the memo in place so
			// its history, comments and inbound links follow the document, then fall
			// through to the content comparison below — a move and an edit in the
			// same push are two independent changes to the same memo.
			moved, err := moveDoc(ctx, client, ws, parents, doc, prev, dryRun, out)
			if err != nil {
				return nil, err
			}
			if !dryRun {
				prev = rebaseState(ws, parents, moved, doc.Path, prev)
				state.Memos[doc.UID] = prev
			} else {
				prev.Path = doc.Path
			}
			res.Moved++
		}

		// PDF documents are backed by uploaded bytes; the local file is a generated
		// stub with no editable body, so a move is the only thing worth pushing.
		if prev.DocType == "PDF" || doc.DocType == "PDF" {
			continue
		}

		if err := pushDocContent(ctx, client, ws, parents, contentRoot, doc, prev, state, res, dryRun, out); err != nil {
			return nil, err
		}
	}

	// 2. Tracked memos no longer claimed by any local file → archive (soft
	// delete). A memo whose file merely moved was claimed above by its marker, so
	// it never reaches this loop.
	claimed := claimedUIDs(docs)
	for _, uid := range sortedUIDs(state) {
		if claimed[uid] {
			continue
		}
		prev := state.Memos[uid]
		if live[uid] == nil {
			// Gone locally and gone on the server: nothing to archive, just stop
			// tracking it rather than spending a call to re-archive an archived memo.
			fmt.Fprintf(out, "  - %s (already gone on the server, untracked)\n", prev.Path)
			if !dryRun {
				delete(state.Memos, uid)
			}
			continue
		}
		fmt.Fprintf(out, "  - %s (deleted → archive)\n", prev.Path)
		if dryRun {
			res.Archived++
			continue
		}
		if err := client.ArchiveMemo(ctx, uid); err != nil {
			return nil, err
		}
		delete(state.Memos, uid)
		res.Archived++
	}

	if dryRun {
		fmt.Fprintf(out, "Dry run: %d to create, %d to update, %d to move, %d to archive, %d unchanged, %d conflicts.\n",
			res.Created, res.Updated, res.Moved, res.Archived, res.Unchanged, len(res.Conflicts))
		reportOrphans(out, res)
		reportSkipped(out, res)
		return res, nil
	}

	// LastSync is pull's incremental watermark and is deliberately left alone
	// here: advancing it on push would hide every server-side memo whose last
	// update predates this moment but was never pulled, and the updated_ts filter
	// only looks forward, so those memos would never be fetched again.
	state.Server = cfg.Server
	if err := state.Save(root, ws.stateName()); err != nil {
		return nil, err
	}
	if err := GitCommitAll(root, fmt.Sprintf("memogit push %s: %d created, %d updated, %d moved, %d archived",
		ws.Title, res.Created, res.Updated, res.Moved, res.Archived)); err != nil {
		return nil, err
	}

	fmt.Fprintf(out, "Push complete: %d created, %d updated, %d moved, %d archived, %d unchanged, %d conflicts.\n",
		res.Created, res.Updated, res.Moved, res.Archived, res.Unchanged, len(res.Conflicts))
	if len(res.Conflicts) > 0 {
		fmt.Fprintf(out, "Conflicts left for manual resolution: %v\n", res.Conflicts)
	}
	reportOrphans(out, res)
	reportSkipped(out, res)
	return res, nil
}

// reportOrphans surfaces documents that exist locally but not on the server. It
// is called out separately from the counts because "nothing was pushed" is
// exactly what it looks like otherwise, and that is the misreading it exists to
// prevent.
func reportOrphans(out io.Writer, res *PushResult) {
	if len(res.Orphaned) == 0 {
		return
	}
	fmt.Fprintf(out, "Not on the server (archived or deleted there), kept locally: %v\n", res.Orphaned)
}

// reportSkipped lists the files push refused to send, each already explained
// by its own "!" line. Like orphans, they are easy to miss in a run that
// otherwise looks successful.
func reportSkipped(out io.Writer, res *PushResult) {
	if len(res.Skipped) == 0 {
		return
	}
	fmt.Fprintf(out, "Not pushed (see ! lines above): %v\n", res.Skipped)
}

// pushNewDoc creates a memo at folderPath for a work-tree file that belongs to
// no known memo, then stamps the file with the uid the server assigned so the
// next move of this file is recognised as a move. Returns the created memo (nil
// for a dry run, or for a PDF stub, which is generated output and never
// becomes a document).
func pushNewDoc(ctx context.Context, client *Client, ws *WorkspaceConfig, parents parentIndex, contentRoot string,
	doc localDoc, folderPath string, state *State, res *PushResult, dryRun bool, out io.Writer) (*v1pb.Memo, error) {
	// PDF stubs are generated, not editable content — never push them.
	if doc.DocType == "PDF" {
		return nil, nil
	}
	_, title, docType := deriveMemoFromPath(doc.Path)
	fmt.Fprintf(out, "  + %s (new)\n", doc.Path)
	if dryRun {
		res.Created++
		return nil, nil
	}
	created, err := client.CreateMemo(ctx, ws.Workspace, folderPath, title, docType, doc.Content)
	if err != nil {
		return nil, err
	}
	uid := uidFromName(created.GetName())
	// Keep the local mapping even if the server normalized the title.
	state.Memos[uid] = rebaseState(ws, parents, created, doc.Path, MemoState{})
	if err := writeFile(contentRoot, doc.Path, InjectLocalID(doc.Content, uid, docType)); err != nil {
		return nil, err
	}
	res.Created++
	return created, nil
}

// moveDoc relocates a memo to match its file's new path. The target folder/title
// are derived from the path, which is the same derivation used for new
// documents, so a move and a create place a document identically.
func moveDoc(ctx context.Context, client *Client, ws *WorkspaceConfig, parents parentIndex, doc localDoc,
	prev MemoState, dryRun bool, out io.Writer) (*v1pb.Memo, error) {
	folderPath, title, _ := deriveMemoFromPath(doc.Path)
	folderPath = ws.ServerFolderPath(folderPath)
	fmt.Fprintf(out, "  → %s → %s (moved)\n", prev.Path, doc.Path)
	if dryRun {
		return nil, nil
	}
	moved, err := client.MoveMemo(ctx, doc.UID, folderPath, title)
	if err != nil {
		return nil, err
	}
	// A server that does not understand these mask paths ignores them and answers
	// 200 with the document right where it was. Left unchecked, the local move
	// would be recorded as done and the next pull would quietly drag the file
	// back, so verify the server actually moved it.
	// Comparing where the document now maps locally (rather than the raw fields)
	// absorbs the server's own normalization and the filename sanitization, and
	// asks the only question that matters: did the document end up where the file
	// is?
	if landed := memoState(ws, parents, moved).Path; landed != doc.Path {
		return nil, fmt.Errorf("server did not apply the move of %s: it now maps to %s, not %s "+
			"(server too old to move documents? move it in the web UI and run `memogit pull`)",
			prev.Path, landed, doc.Path)
	}
	return moved, nil
}

// pushDocContent is the content half of a push for one tracked document:
// conflict bookkeeping, the server re-check, and the actual content update.
func pushDocContent(ctx context.Context, client *Client, ws *WorkspaceConfig, parents parentIndex, contentRoot string,
	doc localDoc, prev MemoState, state *State, res *PushResult, dryRun bool, out io.Writer) error {
	uid := doc.UID

	// A document already flagged as a conflict is only pushable once the user
	// has merged and deleted its "<path>.remote" sidecar.
	if prev.ConflictServerHash != "" {
		if conflictSidecarExists(contentRoot, doc.Path) {
			res.Conflicts = append(res.Conflicts, doc.Path)
			fmt.Fprintf(out, "  ⚠ %s: unresolved conflict — merge and delete %s, then push\n",
				doc.Path, conflictSidecarRel(doc.Path))
			return nil
		}
		// Sidecar gone → resolved. Push only if the server hasn't moved again
		// since the conflict was recorded.
		serverMemo, err := client.GetMemo(ctx, uid)
		if err != nil {
			return err
		}
		if CanonicalHash(serverMemo.GetContent()) != prev.ConflictServerHash {
			// Server changed again → re-open the conflict with fresh content.
			if !dryRun {
				if err := writeConflictSidecar(contentRoot, doc.Path, FileContent(serverMemo, prev.Attachments)); err != nil {
					return err
				}
				p := prev
				p.ConflictServerHash = CanonicalHash(serverMemo.GetContent())
				state.Memos[uid] = p
			}
			res.Conflicts = append(res.Conflicts, doc.Path)
			fmt.Fprintf(out, "  ⚠ %s: server changed again — new %s written, merge again\n",
				doc.Path, conflictSidecarRel(doc.Path))
			return nil
		}
		fmt.Fprintf(out, "  ~ %s (resolved conflict)\n", doc.Path)
		if dryRun {
			res.Updated++
			return nil
		}
		updated, err := client.UpdateMemoContent(ctx, uid, doc.Content)
		if err != nil {
			return err
		}
		// ConflictServerHash is cleared by the fresh baseline.
		state.Memos[uid] = rebaseState(ws, parents, updated, doc.Path, prev)
		res.Updated++
		return nil
	}

	if CanonicalHash(doc.Content) == prev.ContentHash {
		res.Unchanged++
		return nil
	}

	// Local file changed → make sure the server hasn't also moved on.
	serverMemo, err := client.GetMemo(ctx, uid)
	if err != nil {
		return err
	}
	if CanonicalHash(serverMemo.GetContent()) != prev.ContentHash {
		// Both sides changed → write the server version to "<path>.remote" for
		// the user to merge, record the conflict, and skip.
		if !dryRun {
			if err := writeConflictSidecar(contentRoot, doc.Path, FileContent(serverMemo, prev.Attachments)); err != nil {
				return err
			}
			p := prev
			p.ConflictServerHash = CanonicalHash(serverMemo.GetContent())
			state.Memos[uid] = p
		}
		res.Conflicts = append(res.Conflicts, doc.Path)
		fmt.Fprintf(out, "  ⚠ %s: conflict — server version written to %s, merge and delete it, then push\n",
			doc.Path, conflictSidecarRel(doc.Path))
		return nil
	}

	fmt.Fprintf(out, "  ~ %s (modified)\n", doc.Path)
	if dryRun {
		res.Updated++
		return nil
	}
	updated, err := client.UpdateMemoContent(ctx, uid, doc.Content)
	if err != nil {
		return err
	}
	state.Memos[uid] = rebaseState(ws, parents, updated, doc.Path, prev)
	res.Updated++
	return nil
}

// rebaseState builds a fresh baseline from a server response, keeping the two
// things the response cannot tell us: the local path mapping (the server may
// have normalized the title, but the file on disk is what it is) and the
// attachment record (pull owns that). ConflictServerHash is deliberately not
// carried over — reaching here means the document is in sync again.
func rebaseState(ws *WorkspaceConfig, parents parentIndex, m *v1pb.Memo, localPath string, prev MemoState) MemoState {
	ms := memoState(ws, parents, m)
	ms.Path = localPath
	ms.Attachments = prev.Attachments
	return ms
}

// loadLocalDocs reads every work-tree document, stripping the identity marker so
// Content is what the server should hold and MarkerUID is what the file claims
// to be.
func loadLocalDocs(contentRoot string, present []string) ([]localDoc, error) {
	docs := make([]localDoc, 0, len(present))
	for _, relPath := range present {
		data, err := os.ReadFile(filepath.Join(contentRoot, relPath))
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", relPath, err)
		}
		raw := string(data)
		docs = append(docs, localDoc{
			Path:      relPath,
			Content:   StripLocalID(raw),
			MarkerUID: ParseLocalID(raw),
			DocType:   docTypeFromExt(relPath),
		})
	}
	return docs, nil
}

// resolveIdentities decides, for every work-tree file, which memo it is — the
// step that turns a local `mv` into a move rather than a delete plus a create.
//
// The file's own marker wins, because it is the only signal that survives being
// moved. The path index is the fallback for files written before markers existed
// (or whose marker a human or an agent deleted), which is exactly the
// pre-marker behaviour: a move without a marker still degrades to
// archive-plus-create, and nothing else regresses.
//
// A uid claimed by two files is a copy, not a move: the file sitting at the
// memo's recorded path keeps the identity, and the others are pushed as new
// documents (their stale marker is replaced when they are created).
func resolveIdentities(docs []localDoc, state *State) {
	claimed := make(map[string]int, len(docs)) // uid -> index of the winning doc
	for i, doc := range docs {
		if doc.MarkerUID == "" {
			continue
		}
		prev, tracked := state.Memos[doc.MarkerUID]
		if !tracked {
			// A marker pointing at nothing we track: a document copied in from
			// another checkout, or one archived on the server. Treat it as new.
			continue
		}
		if winner, dup := claimed[doc.MarkerUID]; dup {
			// Keep whichever file sits where the memo is recorded; if neither does,
			// the first in sorted order wins so the outcome is deterministic.
			if docs[winner].Path == prev.Path || doc.Path != prev.Path {
				continue
			}
			docs[winner].UID = ""
		}
		claimed[doc.MarkerUID] = i
		docs[i].UID = doc.MarkerUID
	}

	pathIndex := state.PathIndex()
	for i, doc := range docs {
		if doc.UID != "" {
			continue
		}
		uid, tracked := pathIndex[doc.Path]
		if !tracked {
			continue
		}
		if _, taken := claimed[uid]; taken {
			// Another file already carries this memo's marker — this one is a
			// leftover at the old path, so it becomes a new document.
			continue
		}
		claimed[uid] = i
		docs[i].UID = uid
	}
}

// liveMemos returns every memo currently live in the workspace's checkout
// scope, sub-documents included, by uid. Push needs it to tell "nothing to do"
// apart from "this document is not on the server any more", which the hash
// comparison alone can never distinguish — an unchanged file is never looked
// up remotely — and to see where each document actually sits on the server,
// which is what decides whether a file in a ".subdocs" folder is bound yet.
func liveMemos(ctx context.Context, client *Client, ws *WorkspaceConfig) (map[string]*v1pb.Memo, error) {
	scope, err := currentScope(ctx, client)
	if err != nil {
		return nil, err
	}
	docs, subDocs, err := listInScope(ctx, client, ws, scopedFilter(scope, ws.Filter))
	if err != nil {
		return nil, err
	}
	memos := append(docs, subDocs...)
	live := make(map[string]*v1pb.Memo, len(memos))
	for _, m := range memos {
		live[uidFromName(m.GetName())] = m
	}
	return live, nil
}

// claimedUIDs is the set of memos some work-tree file is responsible for. Push
// archives exactly the tracked memos missing from it, so every file that stands
// for a live document — including one created earlier in the same run — must
// have had its identity recorded by the time this is called.
func claimedUIDs(docs []localDoc) map[string]bool {
	claimed := make(map[string]bool, len(docs))
	for _, doc := range docs {
		if doc.UID != "" {
			claimed[doc.UID] = true
		}
	}
	return claimed
}

// warnUnmarked reports work-tree files that belong to a known memo but carry no
// identity marker. They still sync, but a move of one cannot be told apart from
// a delete plus a create, so it would lose the document's history. A pull
// re-stamps them.
func warnUnmarked(docs []localDoc, out io.Writer) {
	n := 0
	for _, doc := range docs {
		if doc.MarkerUID == "" && doc.UID != "" {
			n++
		}
	}
	if n == 0 {
		return
	}
	fmt.Fprintf(out, "  note: %d tracked file(s) carry no memogit id (checkout predates them). "+
		"Run `memogit pull` once so moves are pushed as moves, not as delete+create.\n", n)
}

// listDocFiles returns every document file under contentRoot (repo-relative to
// contentRoot), sorted, skipping the attachments directory and any dotfiles.
//
// state may be nil. When given, it decides the one ambiguous case: a file named
// AGENTS.md or CLAUDE.md is normally memogit's generated agent entry point and
// not a document, but a knowledge base cloned before those files existed may
// genuinely contain a document by that name. A tracked path always wins, so
// pushing never archives a real document just because it shares the name.
func listDocFiles(contentRoot string, state *State) ([]string, error) {
	tracked := trackedPaths(state)
	var out []string
	err := filepath.WalkDir(contentRoot, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			if os.IsNotExist(err) {
				return nil // content root not created yet (empty workspace)
			}
			return err
		}
		if d.IsDir() {
			if d.Name() == attachmentsDir || strings.HasPrefix(d.Name(), ".") {
				return filepath.SkipDir
			}
			return nil
		}
		if strings.HasPrefix(d.Name(), ".") || isConflictSidecar(d.Name()) {
			return nil // dotfiles and conflict sidecars are not documents
		}
		rel, err := filepath.Rel(contentRoot, p)
		if err != nil {
			return err
		}
		// memogit's own agent entry points live in the tree but are not
		// knowledge-base documents — unless one is a document already tracked
		// from before they existed.
		if isAgentDoc(d.Name()) && !tracked[filepath.ToSlash(rel)] {
			return nil
		}
		out = append(out, rel)
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("scan work tree: %w", err)
	}
	sort.Strings(out)
	return out, nil
}

// deriveMemoFromPath recovers a new memo's folder_path, title, and doc_type from
// its repo-relative file path. Title/folder derivation is best-effort: filename
// sanitization on the way down is lossy, so titles with reserved characters may
// not round-trip exactly (the server assigns the canonical value).
func deriveMemoFromPath(relPath string) (folderPath, title, docType string) {
	docType = docTypeFromExt(relPath)
	title = stripDocExt(filepath.Base(relPath))
	if dir := filepath.Dir(relPath); dir != "." {
		folderPath = filepath.ToSlash(dir)
	}
	return folderPath, title, docType
}

// sortedUIDs returns the state's memo uids in a stable order for deterministic
// archive output.
func sortedUIDs(state *State) []string {
	uids := make([]string, 0, len(state.Memos))
	for uid := range state.Memos {
		uids = append(uids, uid)
	}
	sort.Strings(uids)
	return uids
}
