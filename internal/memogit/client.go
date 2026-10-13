package memogit

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"connectrpc.com/connect"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/proto/gen/api/v1/apiv1connect"
)

// Client wraps the memos Connect API clients with PAT auth and exposes the
// subset of operations memogit needs.
type Client struct {
	memo      apiv1connect.MemoServiceClient
	auth      apiv1connect.AuthServiceClient
	workspace apiv1connect.WorkspaceServiceClient

	// baseURL and token back the raw HTTP calls (attachment download) that go
	// through the /file/ route rather than the Connect API.
	baseURL string
	token   string
	http    *http.Client
}

// patInterceptor injects `Authorization: Bearer <token>` on every request.
type patInterceptor struct {
	token string
}

func (i patInterceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		req.Header().Set("Authorization", "Bearer "+i.token)
		return next(ctx, req)
	}
}

func (i patInterceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return func(ctx context.Context, spec connect.Spec) connect.StreamingClientConn {
		conn := next(ctx, spec)
		conn.RequestHeader().Set("Authorization", "Bearer "+i.token)
		return conn
	}
}

func (i patInterceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return next
}

// NewClient builds a Client for the given server URL and PAT.
func NewClient(cfg *Config) *Client {
	httpClient := &http.Client{Timeout: 60 * time.Second}
	baseURL := strings.TrimRight(cfg.Server, "/")
	opts := connect.WithInterceptors(patInterceptor{token: cfg.Token})
	return &Client{
		memo:      apiv1connect.NewMemoServiceClient(httpClient, baseURL, opts),
		auth:      apiv1connect.NewAuthServiceClient(httpClient, baseURL, opts),
		workspace: apiv1connect.NewWorkspaceServiceClient(httpClient, baseURL, opts),
		baseURL:   baseURL,
		token:     cfg.Token,
		http:      httpClient,
	}
}

// CurrentUser returns the authenticated user (username scopes list queries to
// the user's own memos; the email seeds the git commit identity on clone).
func (c *Client) CurrentUser(ctx context.Context) (*v1pb.User, error) {
	resp, err := c.auth.GetCurrentUser(ctx, connect.NewRequest(&v1pb.GetCurrentUserRequest{}))
	if err != nil {
		return nil, fmt.Errorf("get current user (check server URL and token): %w", err)
	}
	user := resp.Msg.GetUser()
	if user == nil || user.GetUsername() == "" {
		return nil, fmt.Errorf("current user response missing username")
	}
	return user, nil
}

// CurrentUsername returns the authenticated user's username (used to scope
// list queries to the user's own memos).
func (c *Client) CurrentUsername(ctx context.Context) (string, error) {
	user, err := c.CurrentUser(ctx)
	if err != nil {
		return "", err
	}
	return user.GetUsername(), nil
}

// ResolveWorkspace looks up a workspace owned by the current user by its
// display title (unique per user) and returns its resource name
// ("workspaces/{uid}"). There is no server-side title lookup for ListMemos'
// workspace filter (unlike CreateMemo, which accepts a title), so this pages
// through ListWorkspaces client-side and matches by exact title.
func (c *Client) ResolveWorkspace(ctx context.Context, title string) (*v1pb.Workspace, error) {
	list, err := c.ListWorkspaces(ctx)
	if err != nil {
		return nil, err
	}
	var names []string
	for _, w := range list {
		names = append(names, w.GetTitle())
		if strings.EqualFold(w.GetTitle(), title) {
			return w, nil
		}
	}
	return nil, fmt.Errorf("no workspace titled %q (have: %v)", title, names)
}

// ListWorkspaces returns every workspace the current user can see, in server
// order (the first is the default).
func (c *Client) ListWorkspaces(ctx context.Context) ([]*v1pb.Workspace, error) {
	resp, err := c.workspace.ListWorkspaces(ctx, connect.NewRequest(&v1pb.ListWorkspacesRequest{}))
	if err != nil {
		return nil, fmt.Errorf("list workspaces: %w", err)
	}
	return resp.Msg.GetWorkspaces(), nil
}

// WorkspaceByName looks a workspace up by its resource name ("workspaces/{uid}"),
// which is stable across server-side renames. Returns nil (no error) when the
// workspace no longer exists.
func (c *Client) WorkspaceByName(ctx context.Context, name string) (*v1pb.Workspace, error) {
	list, err := c.ListWorkspaces(ctx)
	if err != nil {
		return nil, err
	}
	for _, w := range list {
		if w.GetName() == name {
			return w, nil
		}
	}
	return nil, nil
}

// DefaultWorkspace returns the current user's first workspace, matching the
// server's own "first workspace is the default" convention
// (resolveOrCreateDefaultWorkspace). Errors if the user has none yet — the
// server only auto-creates one lazily on first memo write, and clone should
// not silently write to the server.
func (c *Client) DefaultWorkspace(ctx context.Context) (*v1pb.Workspace, error) {
	resp, err := c.workspace.ListWorkspaces(ctx, connect.NewRequest(&v1pb.ListWorkspacesRequest{}))
	if err != nil {
		return nil, fmt.Errorf("list workspaces: %w", err)
	}
	list := resp.Msg.GetWorkspaces()
	if len(list) == 0 {
		return nil, fmt.Errorf("account has no workspaces yet; create one in memos first")
	}
	return list[0], nil
}

// ListAllMemos pages through ListMemos scoped to the given workspace and
// returns every NORMAL memo. filter is a full CEL expression (already
// including any creator scoping); workspace is a resource name
// ("workspaces/{uid}").
func (c *Client) ListAllMemos(ctx context.Context, workspace, filter string) ([]*v1pb.Memo, error) {
	docs, _, _, err := c.listAllMemos(ctx, workspace, filter, false)
	return docs, err
}

// ListAllMemosWithSubDocs is ListAllMemos that also returns the sub-documents
// of every listed document, in the same round trips. ok is false when the
// server predates include_sub_docs: subDocs is then empty, which must not be
// read as "these documents have no sub-documents".
func (c *Client) ListAllMemosWithSubDocs(ctx context.Context, workspace, filter string) (docs, subDocs []*v1pb.Memo, ok bool, err error) {
	return c.listAllMemos(ctx, workspace, filter, true)
}

func (c *Client) listAllMemos(ctx context.Context, workspace, filter string, includeSubDocs bool) (docs, subDocs []*v1pb.Memo, ok bool, err error) {
	ok = includeSubDocs
	pageToken := ""
	for {
		req := &v1pb.ListMemosRequest{
			PageSize:  200,
			PageToken: pageToken,
			State:     v1pb.State_NORMAL,
			// Oldest first keeps clone output deterministic and git-friendly.
			OrderBy:        "create_time asc",
			Filter:         filter,
			Workspace:      workspace,
			IncludeSubDocs: includeSubDocs,
		}
		resp, err := c.memo.ListMemos(ctx, connect.NewRequest(req))
		if err != nil {
			return nil, nil, false, fmt.Errorf("list memos: %w", err)
		}
		docs = append(docs, resp.Msg.GetMemos()...)
		subDocs = append(subDocs, resp.Msg.GetSubDocs()...)
		ok = ok && resp.Msg.GetSubDocsIncluded()
		pageToken = resp.Msg.GetNextPageToken()
		if pageToken == "" {
			break
		}
	}
	return docs, subDocs, ok, nil
}

// ListMemoComments fetches a document's child memos — its comments and its
// sub-documents, which share one relation and therefore one endpoint. Callers
// pick out the sub-documents by folder path; see subdocs.go.
//
// Paginated the same way as ListAllMemos: the server caps a page, and a document
// with many children would otherwise be silently truncated.
func (c *Client) ListMemoComments(ctx context.Context, memoName string) ([]*v1pb.Memo, error) {
	var out []*v1pb.Memo
	pageToken := ""
	for {
		req := &v1pb.ListMemoCommentsRequest{Name: memoName, PageSize: 200, PageToken: pageToken}
		resp, err := c.memo.ListMemoComments(ctx, connect.NewRequest(req))
		if err != nil {
			return nil, fmt.Errorf("list comments of %s: %w", memoName, err)
		}
		out = append(out, resp.Msg.GetMemos()...)
		pageToken = resp.Msg.GetNextPageToken()
		if pageToken == "" {
			break
		}
	}
	return out, nil
}

// GetMemo fetches a single memo by uid ("memos/{uid}"). Used by push to read the
// server's current state for conflict detection.
func (c *Client) GetMemo(ctx context.Context, uid string) (*v1pb.Memo, error) {
	resp, err := c.memo.GetMemo(ctx, connect.NewRequest(&v1pb.GetMemoRequest{Name: "memos/" + uid}))
	if err != nil {
		return nil, fmt.Errorf("get memo %s: %w", uid, err)
	}
	return resp.Msg, nil
}

// CreateMemo creates a new memo from a local file and returns the server memo
// (with its assigned uid/timestamps). workspace/folderPath/title/docType place
// it in the knowledge base hierarchy; visibility defaults to PRIVATE.
func (c *Client) CreateMemo(ctx context.Context, workspace, folderPath, title, docType, content string) (*v1pb.Memo, error) {
	memo := &v1pb.Memo{
		Content:    content,
		Visibility: v1pb.Visibility_PRIVATE,
		State:      v1pb.State_NORMAL,
		Workspace:  workspace,
		FolderPath: folderPath,
		Title:      title,
		DocType:    docTypeFromString(docType),
	}
	resp, err := c.memo.CreateMemo(ctx, connect.NewRequest(&v1pb.CreateMemoRequest{Memo: memo}))
	if err != nil {
		return nil, fmt.Errorf("create memo %q: %w", title, err)
	}
	return resp.Msg, nil
}

// UpdateMemoContent pushes new content to an existing memo, touching only the
// content field (update_mask=[content]) so other attributes are preserved.
func (c *Client) UpdateMemoContent(ctx context.Context, uid, content string) (*v1pb.Memo, error) {
	req := &v1pb.UpdateMemoRequest{
		Memo:       &v1pb.Memo{Name: "memos/" + uid, Content: content},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"content"}},
	}
	resp, err := c.memo.UpdateMemo(ctx, connect.NewRequest(req))
	if err != nil {
		return nil, fmt.Errorf("update memo %s: %w", uid, err)
	}
	return resp.Msg, nil
}

// MoveMemo relocates an existing memo in the knowledge base hierarchy,
// touching only folder_path and title (update_mask=[folder_path, title]) so the
// document keeps its uid — and with it its version history, comments,
// reactions, shares and every inbound link. This is what a local `mv` or rename
// pushes; recreating the document instead would strand all of that on the
// original. The server bumps updated_ts for structural changes, so the next
// pull sees the move, and rejects a move onto an existing (folder_path, title)
// with a duplicate-path error rather than silently merging.
func (c *Client) MoveMemo(ctx context.Context, uid, folderPath, title string) (*v1pb.Memo, error) {
	req := &v1pb.UpdateMemoRequest{
		Memo:       &v1pb.Memo{Name: "memos/" + uid, FolderPath: folderPath, Title: title},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"folder_path", "title"}},
	}
	resp, err := c.memo.UpdateMemo(ctx, connect.NewRequest(req))
	if err != nil {
		return nil, fmt.Errorf("move memo %s to %s/%s: %w", uid, folderPath, title, err)
	}
	return resp.Msg, nil
}

// ArchiveMemo soft-deletes a memo by moving it to the ARCHIVED state
// (update_mask=[state]). memogit never hard-deletes on the server.
func (c *Client) ArchiveMemo(ctx context.Context, uid string) error {
	req := &v1pb.UpdateMemoRequest{
		Memo:       &v1pb.Memo{Name: "memos/" + uid, State: v1pb.State_ARCHIVED},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"state"}},
	}
	if _, err := c.memo.UpdateMemo(ctx, connect.NewRequest(req)); err != nil {
		return fmt.Errorf("archive memo %s: %w", uid, err)
	}
	return nil
}

// errorBodySuffix reads an error response body and renders it as a short
// parenthesised suffix (empty when there is nothing useful to show). It reads a
// bounded amount: an error body is a short JSON message, never a file.
func errorBodySuffix(body io.Reader) string {
	data, err := io.ReadAll(io.LimitReader(body, 2048))
	if err != nil {
		return ""
	}
	var payload struct {
		Message string `json:"message"`
	}
	msg := strings.TrimSpace(string(data))
	if json.Unmarshal(data, &payload) == nil && payload.Message != "" {
		msg = payload.Message
	}
	msg = strings.Join(strings.Fields(msg), " ")
	if msg == "" {
		return ""
	}
	return " (" + msg + ")"
}

// DownloadAttachment fetches an attachment's raw bytes via the /file/ route,
// which accepts the same PAT Bearer auth as the Connect API. attachmentName is
// the resource name ("attachments/{uid}"); filename is the display filename.
func (c *Client) DownloadAttachment(ctx context.Context, attachmentName, filename string) ([]byte, error) {
	u := fmt.Sprintf("%s/file/%s/%s", c.baseURL, attachmentName, url.PathEscape(filename))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("download %s: %w", filename, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		// The status alone doesn't say which failure it was — the file route
		// answers a missing blob, a broken permission check and a store error all
		// with 500 — so carry the body's message along.
		return nil, fmt.Errorf("download %s: server returned %s%s", filename, resp.Status, errorBodySuffix(resp.Body))
	}
	return io.ReadAll(resp.Body)
}
