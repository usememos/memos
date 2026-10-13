package test

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"connectrpc.com/connect"
	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/memogit"
	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
	v1 "github.com/usememos/memos/server/router/api/v1"
	"github.com/usememos/memos/store"
)

// memogit's sub-document handling runs against the real API here: the
// server's Connect handlers and PAT auth behind an httptest server, and a real
// clone on disk. What goes wrong in this area only shows up in how the two
// sides agree — the local "<parent>.subdocs/" folder on one side, the
// "_sub/<uid>" binding on the other — so neither side alone can test it.

type memogitHarness struct {
	t         *testing.T
	ts        *TestService
	userCtx   context.Context
	workspace *apiv1.Workspace
	cfg       *memogit.Config
	root      string
	out       bytes.Buffer
}

func newMemogitHarness(t *testing.T) *memogitHarness {
	t.Helper()
	// The environment overrides config.yaml, so a developer's own server or
	// token would otherwise send every reload of the config to the wrong place.
	for _, name := range []string{memogit.EnvToucanServer, memogit.EnvToucanToken, memogit.EnvServer, memogit.EnvToken} {
		t.Setenv(name, "")
	}
	ctx := context.Background()
	ts := NewTestService(t)
	t.Cleanup(ts.Cleanup)

	user, err := ts.CreateHostUser(ctx, "gituser")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)
	workspace, err := ts.Service.CreateWorkspace(userCtx, &apiv1.CreateWorkspaceRequest{
		Workspace: &apiv1.Workspace{Title: "KB"},
	})
	require.NoError(t, err)
	pat, err := ts.Service.CreatePersonalAccessToken(userCtx, &apiv1.CreatePersonalAccessTokenRequest{
		Parent: "users/" + user.Username, Description: "memogit test",
	})
	require.NoError(t, err)

	mux := http.NewServeMux()
	v1.NewConnectServiceHandler(ts.Service).RegisterConnectHandlers(mux, connect.WithInterceptors(
		v1.NewMetadataInterceptor(),
		v1.NewAuthInterceptor(v1.NewAuthorizer(ts.Store, ts.Secret, ts.Profile)),
	))
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	return &memogitHarness{
		t:         t,
		ts:        ts,
		userCtx:   userCtx,
		workspace: workspace,
		cfg:       &memogit.Config{Server: srv.URL, Token: pat.GetToken()},
		root:      t.TempDir(),
	}
}

func (h *memogitHarness) create(folderPath, title, content string) *apiv1.Memo {
	h.t.Helper()
	m, err := h.ts.Service.CreateMemo(h.userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{Workspace: h.workspace.Name, FolderPath: folderPath, Title: title, Content: content},
	})
	require.NoError(h.t, err)
	return m
}

func (h *memogitHarness) get(name string) *apiv1.Memo {
	h.t.Helper()
	m, err := h.ts.Service.GetMemo(h.userCtx, &apiv1.GetMemoRequest{Name: name})
	require.NoError(h.t, err)
	return m
}

func (h *memogitHarness) clone() {
	h.t.Helper()
	require.NoError(h.t, memogit.Clone(context.Background(), h.root, h.cfg, "KB", "", "", false, true, nil, &h.out), h.out.String())
}

func (h *memogitHarness) ws() *memogit.WorkspaceConfig {
	h.t.Helper()
	cfg, err := memogit.LoadConfig(h.root)
	require.NoError(h.t, err)
	h.cfg = cfg
	wss, err := cfg.Select("KB")
	require.NoError(h.t, err)
	return wss[0]
}

func (h *memogitHarness) push() *memogit.PushResult {
	h.t.Helper()
	res, err := memogit.Push(context.Background(), h.root, h.cfg, h.ws(), false, &h.out)
	require.NoError(h.t, err, h.out.String())
	return res
}

func (h *memogitHarness) pull() {
	h.t.Helper()
	_, err := memogit.Pull(context.Background(), h.root, h.cfg, h.ws(), &h.out)
	require.NoError(h.t, err, h.out.String())
}

// path is relative to the workspace's checkout folder.
func (h *memogitHarness) path(rel string) string {
	return filepath.Join(memogit.ContentRoot(h.root, h.ws()), filepath.FromSlash(rel))
}

func (h *memogitHarness) mv(from, to string) {
	h.t.Helper()
	require.NoError(h.t, os.MkdirAll(filepath.Dir(h.path(to)), 0o755))
	require.NoError(h.t, os.Rename(h.path(from), h.path(to)))
}

func (h *memogitHarness) write(rel, body string) {
	h.t.Helper()
	require.NoError(h.t, os.MkdirAll(filepath.Dir(h.path(rel)), 0o755))
	require.NoError(h.t, os.WriteFile(h.path(rel), []byte(body), 0o644))
}

func (h *memogitHarness) exists(rel string) bool {
	_, err := os.Stat(h.path(rel))
	return err == nil
}

func (h *memogitHarness) requireSubDocOf(name string, parent *apiv1.Memo) {
	h.t.Helper()
	m := h.get(name)
	require.Equal(h.t, parent.Name, m.GetParent(), "%s should be a sub-document of %s\n%s", m.Title, parent.Title, h.out.String())
	require.Equal(h.t, v1.SubDocFolderPath(memoUIDFromName(h.t, parent.Name)), m.FolderPath)
}

// The case that produced a folder literally named "X.subdocs" on the server:
// documents that already exist as ordinary documents are moved into the
// parent's ".subdocs" folder locally. They must be attached in place — same
// uid — not moved into a real folder by that name.
func TestMemogitMoveIntoSubDocsAttachesInPlace(t *testing.T) {
	h := newMemogitHarness(t)
	parent := h.create("Campaigns", "Patrol", "main")
	sources := h.create("Campaigns/Patrol", "Sources", "the sources")
	log := h.create("Campaigns/Patrol", "Log", "the log")
	h.clone()

	h.mv("Campaigns/Patrol/Sources.md", "Campaigns/Patrol.subdocs/Sources.md")
	h.mv("Campaigns/Patrol/Log.md", "Campaigns/Patrol.subdocs/Log.md")
	res := h.push()

	require.Zero(t, res.Created, h.out.String())
	h.requireSubDocOf(sources.Name, parent)
	h.requireSubDocOf(log.Name, parent)

	// And the mirror agrees: a pull leaves everything where it is.
	h.pull()
	require.True(t, h.exists("Campaigns/Patrol.subdocs/Sources.md"))
	require.True(t, h.exists("Campaigns/Patrol.subdocs/Log.md"))
}

// Documents an older memogit pushed into a real folder named "X.subdocs" (the
// server did not reserve the name then) are healed by the next push: the
// checkout already shows them as X's sub-documents, so push binds them.
func TestMemogitHealsLegacySubDocsFolder(t *testing.T) {
	h := newMemogitHarness(t)
	parent := h.create("Campaigns", "Patrol", "main")
	stray := h.create("Campaigns", "Sources", "the sources")
	// The API no longer allows this folder name, so plant it the way the old
	// data got there: straight in the store.
	legacyFolder := "Campaigns/Patrol.subdocs"
	strayID := mustMemoID(t, h, stray.Name)
	require.NoError(t, h.ts.Store.UpdateMemo(context.Background(), &store.UpdateMemo{ID: strayID, FolderPath: &legacyFolder}))
	h.clone()
	require.True(t, h.exists("Campaigns/Patrol.subdocs/Sources.md"))

	h.push()
	h.requireSubDocOf(stray.Name, parent)
	h.pull()
	require.True(t, h.exists("Campaigns/Patrol.subdocs/Sources.md"))
}

func TestMemogitNewParentAndSubDocInOnePush(t *testing.T) {
	h := newMemogitHarness(t)
	h.create("", "Seed", "x")
	h.clone()

	h.write("Plans/Trip.md", "# Trip\n")
	h.write("Plans/Trip.subdocs/Packing.md", "# Packing\n")
	res := h.push()
	require.Equal(t, 2, res.Created, h.out.String())
	require.Empty(t, res.Skipped, h.out.String())

	parent := findMemo(t, h, "Plans", "Trip")
	children, err := h.ts.Service.ListMemoComments(h.userCtx, &apiv1.ListMemoCommentsRequest{Name: parent.Name})
	require.NoError(t, err)
	require.Len(t, children.Memos, 1)
	require.Equal(t, "Packing", children.Memos[0].Title)
	require.Equal(t, parent.Name, children.Memos[0].GetParent())
}

func TestMemogitRenameParentWithItsSubDocs(t *testing.T) {
	h := newMemogitHarness(t)
	parent := h.create("Campaigns", "Patrol", "main")
	sub, err := h.ts.Service.CreateMemo(h.userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{FolderPath: v1.SubDocFolderPath(memoUIDFromName(t, parent.Name)), Title: "Sources", Content: "s"},
	})
	require.NoError(t, err)
	h.clone()
	require.True(t, h.exists("Campaigns/Patrol.subdocs/Sources.md"))

	h.mv("Campaigns/Patrol.md", "Campaigns/Watch.md")
	h.mv("Campaigns/Patrol.subdocs", "Campaigns/Watch.subdocs")
	res := h.push()
	require.Empty(t, res.Skipped, h.out.String())
	require.Equal(t, "Watch", h.get(parent.Name).Title)
	h.requireSubDocOf(sub.Name, parent)
	require.Equal(t, "Sources", h.get(sub.Name).Title)

	h.pull()
	require.True(t, h.exists("Campaigns/Watch.subdocs/Sources.md"))
	require.False(t, h.exists("Campaigns/Patrol.subdocs"))
}

func TestMemogitRenameSubDocInsideItsFolder(t *testing.T) {
	h := newMemogitHarness(t)
	parent := h.create("", "Patrol", "main")
	sub, err := h.ts.Service.CreateMemo(h.userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{FolderPath: v1.SubDocFolderPath(memoUIDFromName(t, parent.Name)), Title: "Sources", Content: "s"},
	})
	require.NoError(t, err)
	h.clone()

	h.mv("Patrol.subdocs/Sources.md", "Patrol.subdocs/Source List.md")
	res := h.push()
	require.Empty(t, res.Skipped, h.out.String())
	require.Equal(t, "Source List", h.get(sub.Name).Title)
	h.requireSubDocOf(sub.Name, parent)
}

func TestMemogitSubDocMovedOutIsSkippedNotFatal(t *testing.T) {
	h := newMemogitHarness(t)
	parent := h.create("", "Patrol", "main")
	sub, err := h.ts.Service.CreateMemo(h.userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{FolderPath: v1.SubDocFolderPath(memoUIDFromName(t, parent.Name)), Title: "Sources", Content: "s"},
	})
	require.NoError(t, err)
	other := h.create("", "Other", "before")
	h.clone()

	h.mv("Patrol.subdocs/Sources.md", "Sources.md")
	h.write("Other.md", "after\n")
	res := h.push()
	require.Equal(t, []string{"Sources.md"}, res.Skipped, h.out.String())
	h.requireSubDocOf(sub.Name, parent)
	require.Equal(t, "after", h.get(other.Name).Content, "the rest of the push still goes through")
}

func TestMemogitSubDocWithoutParentIsNeverAnOrdinaryDocument(t *testing.T) {
	h := newMemogitHarness(t)
	h.create("", "Seed", "x")
	h.clone()

	h.write("Ghost.subdocs/Note.md", "# Note\n")
	h.write("Seed.subdocs/deeper/Note.md", "# Deep\n")
	h.write("Seed.subdocs/Page.html", "<p>x</p>\n")
	res := h.push()
	require.Zero(t, res.Created, h.out.String())
	require.ElementsMatch(t, []string{"Ghost.subdocs/Note.md", "Seed.subdocs/deeper/Note.md", "Seed.subdocs/Page.html"}, res.Skipped)

	listed, err := h.ts.Service.ListMemos(h.userCtx, &apiv1.ListMemosRequest{})
	require.NoError(t, err)
	for _, m := range listed.Memos {
		require.NotContains(t, m.FolderPath, ".subdocs")
	}
}

// The parent exists on the server but not in this checkout yet (made on the
// web since the last pull): push still finds it and binds to it.
func TestMemogitFindsParentOnTheServer(t *testing.T) {
	h := newMemogitHarness(t)
	h.create("", "Seed", "x")
	h.clone()
	parent := h.create("Notes", "Later", "made on the web")

	h.write("Notes/Later.subdocs/Appendix.md", "# Appendix\n")
	res := h.push()
	require.Equal(t, 1, res.Created, h.out.String())
	children, err := h.ts.Service.ListMemoComments(h.userCtx, &apiv1.ListMemoCommentsRequest{Name: parent.Name})
	require.NoError(t, err)
	require.Len(t, children.Memos, 1)
	require.Equal(t, "Appendix", children.Memos[0].Title)
}

func mustMemoID(t *testing.T, h *memogitHarness, name string) int32 {
	t.Helper()
	uid := memoUIDFromName(t, name)
	m, err := h.ts.Store.GetMemo(context.Background(), &store.FindMemo{UID: &uid})
	require.NoError(t, err)
	require.NotNil(t, m)
	return m.ID
}

func findMemo(t *testing.T, h *memogitHarness, folderPath, title string) *apiv1.Memo {
	t.Helper()
	listed, err := h.ts.Service.ListMemos(h.userCtx, &apiv1.ListMemosRequest{})
	require.NoError(t, err)
	for _, m := range listed.Memos {
		if m.FolderPath == folderPath && m.Title == title {
			return m
		}
	}
	t.Fatalf("no document %s/%s", folderPath, title)
	return nil
}
