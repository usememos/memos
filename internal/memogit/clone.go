package memogit

import (
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

// Clone performs the first full export: pull every own memo in the given
// workspace into local files, init a git repo, and commit a baseline
// snapshot. root is the KB directory (usually the current working dir).
// workspaceTitle selects which of the user's workspaces (knowledge bases) to
// check out; if empty, the user's default (first) workspace is used, but only
// when they have exactly one — with several, the title must be given
// explicitly so clone never guesses the wrong knowledge base.
//
// folders, when non-empty, limits the checkout to those server folders while
// keeping the knowledge base in its own subfolder (see WorkspaceConfig.Folders);
// it cannot be combined with sparse.
func Clone(ctx context.Context, root string, cfg *Config, workspaceTitle, filter, sparse string, sparseSubdir, noAttachments bool, folders []string, out io.Writer) error {
	folders, err := NormalizeFolders(folders)
	if err != nil {
		return err
	}
	if len(folders) > 0 && strings.TrimSpace(sparse) != "" {
		return fmt.Errorf("folders and a sparse checkout cannot be combined")
	}
	client := NewClient(cfg)
	user, err := client.CurrentUser(ctx)
	if err != nil {
		return err
	}
	username := user.GetUsername()

	remote, err := resolveCloneWorkspace(ctx, client, workspaceTitle)
	if err != nil {
		return err
	}
	wsCfg := &WorkspaceConfig{
		Workspace:     remote.GetName(),
		Title:         remote.GetTitle(),
		Dir:           workspaceDir(remote.GetTitle()),
		Filter:        filter,
		NoAttachments: noAttachments,
		Folders:       folders,
	}
	// A sparse checkout maps one server folder to the checkout root itself: the
	// content sits at the root (Dir "."), the folder prefix is stripped locally
	// (Sparse), and a separate Name identifies the state file since "." can't.
	if sparse = sanitizeFolderPath(sparse); sparse != "" {
		wsCfg.Sparse = sparse
		wsCfg.SparseSubdir = sparseSubdir
		wsCfg.Dir = "."
		wsCfg.Name = workspaceDir(remote.GetTitle())
	}
	// Refuse to clobber a completed checkout, but retake the entry of a clone
	// that was interrupted before it ever wrote a baseline.
	resumed, err := cfg.Adopt(root, wsCfg)
	if err != nil {
		return err
	}
	if err := cfg.Save(root); err != nil {
		return err
	}
	if resumed {
		fmt.Fprintf(out, "Resuming an interrupted clone of %q (no sync state yet); re-fetching everything.\n", wsCfg.Title)
	}

	if wsCfg.Sparse != "" {
		fmt.Fprintf(out, "Authenticated as %q, fetching memos under folder %q of workspace %q (%s) on %s ...\n",
			username, wsCfg.Sparse, wsCfg.Title, wsCfg.Workspace, cfg.Server)
		if wsCfg.SparseSubdir {
			fmt.Fprintf(out, "  (keeping %q as a subdirectory of the checkout root)\n", wsCfg.Sparse)
		}
	} else if len(wsCfg.Folders) > 0 {
		fmt.Fprintf(out, "Authenticated as %q, fetching memos under %s of workspace %q (%s) on %s ...\n",
			username, wsCfg.scopeLabel(), wsCfg.Title, wsCfg.Workspace, cfg.Server)
	} else {
		fmt.Fprintf(out, "Authenticated as %q, fetching memos from workspace %q (%s) on %s ...\n",
			username, wsCfg.Title, wsCfg.Workspace, cfg.Server)
	}

	scope := scopeOf(user)
	if scope.Admin {
		fmt.Fprintln(out, "  (admin: the checkout covers every document in the workspace, not only your own)")
	}
	// Sub-documents come along with their parents, or a fresh checkout would
	// lack every one of them until its first full pull.
	inScope, subDocs, err := listInScope(ctx, client, wsCfg, scopedFilter(scope, wsCfg.Filter))
	if err != nil {
		return err
	}
	warnEmptyFolders(wsCfg, inScope, out)
	memos := append(inScope, subDocs...)

	state := NewState(cfg.Server)
	if err := checkPathCollisions(wsCfg, memos, out); err != nil {
		return err
	}
	contentRoot := ContentRoot(root, wsCfg)
	// Sub-documents are placed beside their parent's file, so their paths depend
	// on where the parents land; a clone starts from an empty state, so the index
	// is built entirely from this listing.
	parents := newParentIndex(wsCfg, state, memos)
	warn := &attachmentWarner{out: out}
	attachmentCount := 0
	for _, m := range memos {
		ms, nDown, err := exportMemo(ctx, client, wsCfg, parents, contentRoot, m, nil, warn)
		if err != nil {
			return err
		}
		state.Memos[uidFromName(m.GetName())] = ms
		attachmentCount += nDown
		fmt.Fprintf(out, "  + %s\n", ms.Path)
	}
	state.LastSync = time.Now().UTC()

	if err := state.Save(root, wsCfg.stateName()); err != nil {
		return err
	}
	if err := writeGitignore(root); err != nil {
		return err
	}
	// Make the checkout self-describing to coding agents before the baseline
	// commit, so the guide is part of the first snapshot.
	if err := WriteAgentDocs(root, cfg, out); err != nil {
		return err
	}
	if err := GitInitIfNeeded(root); err != nil {
		return err
	}
	// A fresh machine may have no git identity at all; seed a repo-local one
	// from the memogit account so the baseline commit doesn't hard-fail.
	gitName := user.GetDisplayName()
	if strings.TrimSpace(gitName) == "" {
		gitName = username
	}
	if err := EnsureGitIdentity(root, gitName, user.GetEmail()); err != nil {
		return err
	}
	if err := GitCommitAll(root, fmt.Sprintf("memogit clone %s: baseline snapshot of %d memos", wsCfg.Title, len(memos))); err != nil {
		return err
	}

	dest := wsCfg.Dir + "/"
	if wsCfg.Sparse != "" {
		dest = root // sparse checkout: content sits at the root itself
	}
	fmt.Fprintf(out, "Cloned %d memos (%d attachments) into %s and committed baseline.\n", len(memos), attachmentCount, dest)
	if warn.failed > 0 {
		fmt.Fprintf(out, "%d attachment(s) could not be downloaded (see ! lines above); `memogit pull` retries them.\n", warn.failed)
	}
	return nil
}

// resolveCloneWorkspace resolves the workspace to clone: by explicit title if
// given, otherwise the user's sole workspace (erroring rather than guessing if
// they have more than one).
func resolveCloneWorkspace(ctx context.Context, client *Client, title string) (*v1pb.Workspace, error) {
	if title != "" {
		return client.ResolveWorkspace(ctx, title)
	}
	list, err := client.ListWorkspaces(ctx)
	if err != nil {
		return nil, err
	}
	switch len(list) {
	case 0:
		return nil, fmt.Errorf("account has no workspaces yet; create one in memos first")
	case 1:
		return list[0], nil
	default:
		var titles []string
		for _, w := range list {
			titles = append(titles, w.GetTitle())
		}
		return nil, fmt.Errorf("multiple workspaces found, pass one explicitly: memogit clone <title> (have: %v)", titles)
	}
}

// warnEmptyFolders names every configured folder that matched no document.
// Folder names are case-sensitive and not checked against the server's tree,
// so a typo would otherwise check out an empty folder without a word.
func warnEmptyFolders(ws *WorkspaceConfig, memos []*v1pb.Memo, out io.Writer) {
	for _, folder := range ws.Folders {
		found := false
		for _, m := range memos {
			if underFolder(strings.Trim(m.GetFolderPath(), "/"), folder) {
				found = true
				break
			}
		}
		if !found {
			fmt.Fprintf(out, "  ! folder %q matched no document in %q (names are case-sensitive; typo?)\n", folder, ws.Title)
		}
	}
}
