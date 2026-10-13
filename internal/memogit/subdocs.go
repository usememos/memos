package memogit

import (
	"context"
	"path/filepath"
	"strings"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

// Sub-documents in the local checkout.
//
// A sub-document is a document that belongs to another document rather than to
// a folder. On the server it is addressed by a reserved folder path,
// "_sub/<parent uid>" (see server/router/api/v1/subdoc.go). Mirroring that path
// literally would give the checkout a tree of uid-named directories, which is
// unreadable to the humans and agents the local tree exists for — so it is
// mapped to a folder sitting beside the parent's own file:
//
//	notes/Architecture.md
//	notes/Architecture.subdocs/Failure modes.md
//
// The mapping is one-to-one in both directions: pull computes the local path
// from the parent's, and push recovers "_sub/<parent uid>" from the ".subdocs"
// folder by looking up which document the neighbouring file is.
//
// Requirements: docs/dev/requirements/knowledge-base/sub-documents.md.
const (
	// SubDocFolderPrefix is the server-side reserved folder path prefix.
	SubDocFolderPrefix = "_sub"
	// SubDocDirSuffix is appended to a parent's filename stem to name the local
	// folder holding its sub-documents.
	SubDocDirSuffix = ".subdocs"
)

// ParentUIDFromSubDocFolder reads the parent uid out of a server folder path,
// reporting whether the path addresses a sub-document at all. Only the exact
// "_sub/<uid>" shape counts, matching the server's own reading.
func ParentUIDFromSubDocFolder(folderPath string) (string, bool) {
	rest, ok := strings.CutPrefix(strings.Trim(folderPath, "/"), SubDocFolderPrefix+"/")
	if !ok || rest == "" || strings.Contains(rest, "/") {
		return "", false
	}
	return rest, true
}

// SubDocFolderPath is the server folder path for a sub-document of parentUID.
func SubDocFolderPath(parentUID string) string {
	return SubDocFolderPrefix + "/" + parentUID
}

// SubDocDirRel is the repo-relative folder holding the sub-documents of the
// parent whose own file is at parentRel ("notes/Architecture.md" ->
// "notes/Architecture.subdocs").
func SubDocDirRel(parentRel string) string {
	return strings.TrimSuffix(parentRel, filepath.Ext(parentRel)) + SubDocDirSuffix
}

// SubDocRelPath is the repo-relative path of one sub-document, given its
// parent's file path and its own title.
func SubDocRelPath(parentRel, title string) string {
	stem := sanitizeSegment(title)
	if stem == "" {
		stem = untitled
	}
	return filepath.Join(SubDocDirRel(parentRel), stem+extForDocType("MARKDOWN"))
}

// ParentRelFromSubDocPath is the inverse: given a repo-relative path inside a
// ".subdocs" folder, it returns the parent document's file path. The extension
// is the one the parent would have as a markdown document — every document that
// can hold sub-documents is one.
//
// Returns ok=false for any path not inside such a folder, which is how push
// tells an ordinary new file apart from a new sub-document.
func ParentRelFromSubDocPath(rel string) (parentRel string, ok bool) {
	dir, _ := filepath.Split(filepath.FromSlash(rel))
	dir = strings.TrimSuffix(dir, string(filepath.Separator))
	if dir == "" || !strings.HasSuffix(dir, SubDocDirSuffix) {
		return "", false
	}
	return strings.TrimSuffix(dir, SubDocDirSuffix) + extForDocType("MARKDOWN"), true
}

// parentIndex maps a parent document's uid to its local file path, so a
// sub-document can be placed beside it. Built from the sync state plus whatever
// this run has just fetched — a parent is never itself a sub-document, so the
// index never needs to resolve recursively.
type parentIndex map[string]string

// newParentIndex seeds the index from the last-synced state, then overlays the
// paths the memos in this run will land at. The overlay matters when a parent
// was renamed or moved in the same run: its sub-documents have to follow it to
// the new folder, not be written beside where it used to be.
func newParentIndex(ws *WorkspaceConfig, state *State, memos []*v1pb.Memo) parentIndex {
	index := make(parentIndex, len(state.Memos)+len(memos))
	for uid, ms := range state.Memos {
		index[uid] = ms.Path
	}
	for _, m := range memos {
		if _, isSubDoc := ParentUIDFromSubDocFolder(m.GetFolderPath()); isSubDoc {
			continue
		}
		index[uidFromName(m.GetName())] = ws.LocalRelPath(m.GetFolderPath(), m.GetTitle(), docTypeString(m))
	}
	return index
}

// localRelPathOf is the single place a memo's local path is decided. For an
// ordinary document it is the workspace mapping; for a sub-document it is a
// folder beside the parent.
//
// A sub-document whose parent is not in the index (the parent is outside a
// sparse checkout, or has not been pulled yet) falls back to mirroring the
// server path literally. That is ugly but honest: the content lands somewhere
// real rather than being silently dropped.
func localRelPathOf(ws *WorkspaceConfig, parents parentIndex, m *v1pb.Memo) string {
	if parentUID, ok := ParentUIDFromSubDocFolder(m.GetFolderPath()); ok {
		if parentRel, known := parents[parentUID]; known {
			return SubDocRelPath(parentRel, m.GetTitle())
		}
	}
	return ws.LocalRelPath(m.GetFolderPath(), m.GetTitle(), docTypeString(m))
}

// listInScope lists the documents matching filter that belong to this
// checkout, together with their sub-documents: the full set of live memos a
// checkout mirrors. Anything that decides "is this tracked document still on
// the server?" must look at both — the plain listing never contains
// sub-documents, so checking against it alone reads every one of them as
// deleted (pull would remove them, push would skip them as orphans).
//
// Scope follows the parent rather than being re-derived: a sub-document's
// server folder path is the reserved "_sub/<uid>", which matches no sparse or
// folders prefix, so it is kept exactly when its parent is.
func listInScope(ctx context.Context, client *Client, ws *WorkspaceConfig, filter string) (docs, subDocs []*v1pb.Memo, err error) {
	all, subDocs, ok, err := client.ListAllMemosWithSubDocs(ctx, ws.Workspace, filter)
	if err != nil {
		return nil, nil, err
	}
	docs = inScopeMemos(ws, all)
	if !ok {
		// An older server ignores include_sub_docs; ask parent by parent.
		subDocs, err = fetchSubDocs(ctx, client, docs)
		if err != nil {
			return nil, nil, err
		}
		return docs, subDocs, nil
	}
	return docs, subDocsOf(docs, subDocs), nil
}

// subDocsOf keeps the sub-documents whose parent is one of docs.
func subDocsOf(docs, subDocs []*v1pb.Memo) []*v1pb.Memo {
	parents := make(map[string]bool, len(docs))
	for _, d := range docs {
		parents[uidFromName(d.GetName())] = true
	}
	kept := subDocs[:0:0]
	for _, sd := range subDocs {
		if parentUID, ok := ParentUIDFromSubDocFolder(sd.GetFolderPath()); ok && parents[parentUID] {
			kept = append(kept, sd)
		}
	}
	return kept
}

// fetchSubDocs returns the sub-documents of every given parent, one request per
// parent. It is listInScope's fallback for a server whose listing cannot carry
// sub-documents (one that predates include_sub_docs).
func fetchSubDocs(ctx context.Context, client *Client, parents []*v1pb.Memo) ([]*v1pb.Memo, error) {
	var subDocs []*v1pb.Memo
	for _, parent := range parents {
		if _, isSubDoc := ParentUIDFromSubDocFolder(parent.GetFolderPath()); isSubDoc {
			continue // one level deep; a sub-document has no children
		}
		children, err := client.ListMemoComments(ctx, parent.GetName())
		if err != nil {
			return nil, err
		}
		for _, child := range children {
			// Comments come back from the same call and are not mirrored as
			// files: they are a discussion about the document, not content of it.
			if _, ok := ParentUIDFromSubDocFolder(child.GetFolderPath()); ok {
				subDocs = append(subDocs, child)
			}
		}
	}
	return subDocs, nil
}
