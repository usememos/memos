package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"github.com/lithammer/shortuuid/v4"
	"github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"
	"github.com/pkg/errors"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

// tagRegexp matches #tag patterns in memo content.
// A tag must start with a letter and contain no whitespace or # characters.
var tagRegexp = regexp.MustCompile(`(?:^|\s)#([A-Za-z][^\s#]*)`)

// extractTags does a best-effort extraction of #tags from raw markdown content.
// It is used when creating or updating memos via MCP to pre-populate Payload.Tags.
// The full markdown service may later rebuild a more accurate payload.
func extractTags(content string) []string {
	matches := tagRegexp.FindAllStringSubmatch(content, -1)
	seen := make(map[string]struct{}, len(matches))
	tags := make([]string, 0, len(matches))
	for _, m := range matches {
		tag := m[1]
		if _, ok := seen[tag]; !ok {
			seen[tag] = struct{}{}
			tags = append(tags, tag)
		}
	}
	return tags
}

// buildPayload constructs a MemoPayload with tags extracted from content.
// Returns nil when no tags are found so the store omits the payload entirely.
func buildPayload(content string) *storepb.MemoPayload {
	tags := extractTags(content)
	if len(tags) == 0 {
		return nil
	}
	return &storepb.MemoPayload{Tags: tags}
}

// propertyJSON is the serialisable form of MemoPayload.Property.
type propertyJSON struct {
	HasLink            bool `json:"has_link"`
	HasTaskList        bool `json:"has_task_list"`
	HasCode            bool `json:"has_code"`
	HasIncompleteTasks bool `json:"has_incomplete_tasks"`
}

// memoJSON is the canonical response shape for all MCP memo results.
// It serialises correctly with standard encoding/json (no proto marshalling needed).
type memoJSON struct {
	Name       string        `json:"name"`
	Creator    string        `json:"creator"`
	CreateTime int64         `json:"create_time"`
	UpdateTime int64         `json:"update_time"`
	Content    string        `json:"content,omitempty"`
	Visibility string        `json:"visibility"`
	Tags       []string      `json:"tags"`
	Pinned     bool          `json:"pinned"`
	State      string        `json:"state"`
	Property   *propertyJSON `json:"property,omitempty"`
	Parent     string        `json:"parent,omitempty"`
}

func storeMemoToJSON(m *store.Memo) memoJSON {
	j := memoJSON{
		Name:       "memos/" + m.UID,
		Creator:    fmt.Sprintf("users/%d", m.CreatorID),
		CreateTime: m.CreatedTs,
		UpdateTime: m.UpdatedTs,
		Content:    m.Content,
		Visibility: string(m.Visibility),
		Pinned:     m.Pinned,
		State:      string(m.RowStatus),
		Tags:       []string{},
	}
	if m.Payload != nil {
		if len(m.Payload.Tags) > 0 {
			j.Tags = m.Payload.Tags
		}
		if p := m.Payload.Property; p != nil && (p.HasLink || p.HasTaskList || p.HasCode || p.HasIncompleteTasks) {
			j.Property = &propertyJSON{
				HasLink:            p.HasLink,
				HasTaskList:        p.HasTaskList,
				HasCode:            p.HasCode,
				HasIncompleteTasks: p.HasIncompleteTasks,
			}
		}
	}
	if m.ParentUID != nil {
		j.Parent = "memos/" + *m.ParentUID
	}
	return j
}

// checkMemoAccess returns an error if the caller cannot read memo.
// userID == 0 means anonymous.
func checkMemoAccess(memo *store.Memo, userID int32) error {
	switch memo.Visibility {
	case store.Protected:
		if userID == 0 {
			return errors.New("permission denied")
		}
	case store.Private:
		if memo.CreatorID != userID {
			return errors.New("permission denied")
		}
	default:
		// store.Public and any unknown visibility: allow
	}
	return nil
}

// applyVisibilityFilter restricts find to memos the caller may see.
func applyVisibilityFilter(find *store.FindMemo, userID int32) {
	if userID == 0 {
		find.VisibilityList = []store.Visibility{store.Public}
	} else {
		find.Filters = append(find.Filters, fmt.Sprintf(`creator_id == %d || visibility in ["PUBLIC", "PROTECTED"]`, userID))
	}
}

// parseMemoUID extracts the UID from a "memos/<uid>" resource name.
func parseMemoUID(name string) (string, error) {
	uid, ok := strings.CutPrefix(name, "memos/")
	if !ok || uid == "" {
		return "", errors.Errorf(`memo name must be in the format "memos/<uid>", got %q`, name)
	}
	return uid, nil
}

// parseVisibility validates a visibility string and returns the store constant.
func parseVisibility(s string) (store.Visibility, error) {
	switch v := store.Visibility(s); v {
	case store.Public, store.Protected, store.Private:
		return v, nil
	default:
		return "", errors.Errorf("visibility must be PRIVATE, PROTECTED, or PUBLIC; got %q", s)
	}
}

// parseRowStatus validates a state string and returns the store constant.
func parseRowStatus(s string) (store.RowStatus, error) {
	switch rs := store.RowStatus(s); rs {
	case store.Normal, store.Archived:
		return rs, nil
	default:
		return "", errors.Errorf("state must be NORMAL or ARCHIVED; got %q", s)
	}
}

func extractUserID(ctx context.Context) (int32, error) {
	id := auth.GetUserID(ctx)
	if id == 0 {
		return 0, errors.New("unauthenticated: a personal access token is required")
	}
	return id, nil
}

func marshalJSON(v any) (string, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func (s *MCPService) registerMemoTools(mcpSrv *mcpserver.MCPServer) {
	mcpSrv.AddTool(mcp.NewTool("list_memos",
		mcp.WithDescription("List memos visible to the caller. Authenticated users see their own memos plus public and protected memos; unauthenticated callers see only public memos."),
		mcp.WithNumber("page_size", mcp.Description("Maximum memos to return (1–100, default 20)")),
		mcp.WithNumber("page", mcp.Description("Zero-based page index for pagination (default 0)")),
		mcp.WithString("state",
			mcp.Enum("NORMAL", "ARCHIVED"),
			mcp.Description("Filter by state: NORMAL (default) or ARCHIVED"),
		),
		mcp.WithBoolean("order_by_pinned", mcp.Description("When true, pinned memos appear first (default false)")),
		mcp.WithString("filter", mcp.Description(`Optional CEL filter, e.g. content.contains("keyword") or tags.exists(t, t == "work")`)),
	), s.handleListMemos)

	mcpSrv.AddTool(mcp.NewTool("get_memo",
		mcp.WithDescription("Get a single memo by resource name. Public memos are accessible without authentication."),
		mcp.WithString("name", mcp.Required(), mcp.Description(`Memo resource name, e.g. "memos/abc123"`)),
	), s.handleGetMemo)

	mcpSrv.AddTool(mcp.NewTool("create_memo",
		mcp.WithDescription("Create a new memo. Requires authentication."),
		mcp.WithString("content", mcp.Required(), mcp.Description("Memo content in Markdown. Use #tag syntax for tagging.")),
		mcp.WithString("visibility",
			mcp.Enum("PRIVATE", "PROTECTED", "PUBLIC"),
			mcp.Description("Visibility (default: PRIVATE)"),
		),
	), s.handleCreateMemo)

	mcpSrv.AddTool(mcp.NewTool("update_memo",
		mcp.WithDescription("Update a memo's content, visibility, pin state, or archive state. Requires authentication and ownership. Omit any field to leave it unchanged."),
		mcp.WithString("name", mcp.Required(), mcp.Description(`Memo resource name, e.g. "memos/abc123"`)),
		mcp.WithString("content", mcp.Description("New Markdown content")),
		mcp.WithString("visibility",
			mcp.Enum("PRIVATE", "PROTECTED", "PUBLIC"),
			mcp.Description("New visibility"),
		),
		mcp.WithBoolean("pinned", mcp.Description("Pin or unpin the memo")),
		mcp.WithString("state",
			mcp.Enum("NORMAL", "ARCHIVED"),
			mcp.Description("Set to ARCHIVED to archive, NORMAL to restore"),
		),
	), s.handleUpdateMemo)

	mcpSrv.AddTool(mcp.NewTool("delete_memo",
		mcp.WithDescription("Permanently delete a memo. Requires authentication and ownership."),
		mcp.WithString("name", mcp.Required(), mcp.Description(`Memo resource name, e.g. "memos/abc123"`)),
	), s.handleDeleteMemo)

	mcpSrv.AddTool(mcp.NewTool("search_memos",
		mcp.WithDescription("Search memo content. Authenticated users search their own and visible memos; unauthenticated callers search public memos only."),
		mcp.WithString("query", mcp.Required(), mcp.Description("Text to search for in memo content")),
	), s.handleSearchMemos)

	mcpSrv.AddTool(mcp.NewTool("list_memo_comments",
		mcp.WithDescription("List comments on a memo. Visibility rules for comments match those of the parent memo."),
		mcp.WithString("name", mcp.Required(), mcp.Description(`Memo resource name, e.g. "memos/abc123"`)),
	), s.handleListMemoComments)

	mcpSrv.AddTool(mcp.NewTool("create_memo_comment",
		mcp.WithDescription("Add a comment to a memo. The comment inherits the parent memo's visibility. Requires authentication."),
		mcp.WithString("name", mcp.Required(), mcp.Description(`Memo resource name to comment on, e.g. "memos/abc123"`)),
		mcp.WithString("content", mcp.Required(), mcp.Description("Comment content in Markdown")),
	), s.handleCreateMemoComment)
}

func (s *MCPService) handleListMemos(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := auth.GetUserID(ctx)

	pageSize := req.GetInt("page_size", 20)
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	page := req.GetInt("page", 0)
	if page < 0 {
		page = 0
	}

	var rowStatus *store.RowStatus
	if state := req.GetString("state", "NORMAL"); state != "" {
		rs, err := parseRowStatus(state)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		rowStatus = &rs
	}

	limit := pageSize + 1
	offset := page * pageSize
	find := &store.FindMemo{
		ExcludeComments: true,
		RowStatus:       rowStatus,
		Limit:           &limit,
		Offset:          &offset,
		OrderByPinned:   req.GetBool("order_by_pinned", false),
	}
	applyVisibilityFilter(find, userID)
	if filter := req.GetString("filter", ""); filter != "" {
		find.Filters = append(find.Filters, filter)
	}

	memos, err := s.store.ListMemos(ctx, find)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to list memos: %v", err)), nil
	}

	hasMore := len(memos) > pageSize
	if hasMore {
		memos = memos[:pageSize]
	}

	results := make([]memoJSON, len(memos))
	for i, m := range memos {
		results[i] = storeMemoToJSON(m)
	}

	type listResponse struct {
		Memos   []memoJSON `json:"memos"`
		HasMore bool       `json:"has_more"`
	}
	out, err := marshalJSON(listResponse{Memos: results, HasMore: hasMore})
	if err != nil {
		return nil, err
	}
	return mcp.NewToolResultText(out), nil
}

func (s *MCPService) handleGetMemo(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := auth.GetUserID(ctx)

	uid, err := parseMemoUID(req.GetString("name", ""))
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	memo, err := s.store.GetMemo(ctx, &store.FindMemo{UID: &uid})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to get memo: %v", err)), nil
	}
	if memo == nil {
		return mcp.NewToolResultError("memo not found"), nil
	}
	if err := checkMemoAccess(memo, userID); err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	out, err := marshalJSON(storeMemoToJSON(memo))
	if err != nil {
		return nil, err
	}
	return mcp.NewToolResultText(out), nil
}

func (s *MCPService) handleCreateMemo(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, err := extractUserID(ctx)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	content := req.GetString("content", "")
	if content == "" {
		return mcp.NewToolResultError("content is required"), nil
	}
	visibility, err := parseVisibility(req.GetString("visibility", "PRIVATE"))
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	memo, err := s.store.CreateMemo(ctx, &store.Memo{
		UID:        shortuuid.New(),
		CreatorID:  userID,
		Content:    content,
		Visibility: visibility,
		Payload:    buildPayload(content),
	})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to create memo: %v", err)), nil
	}

	out, err := marshalJSON(storeMemoToJSON(memo))
	if err != nil {
		return nil, err
	}
	return mcp.NewToolResultText(out), nil
}

func (s *MCPService) handleUpdateMemo(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, err := extractUserID(ctx)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	uid, err := parseMemoUID(req.GetString("name", ""))
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	memo, err := s.store.GetMemo(ctx, &store.FindMemo{UID: &uid})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to get memo: %v", err)), nil
	}
	if memo == nil {
		return mcp.NewToolResultError("memo not found"), nil
	}
	if memo.CreatorID != userID {
		return mcp.NewToolResultError("permission denied"), nil
	}

	update := &store.UpdateMemo{ID: memo.ID}
	args := req.GetArguments()

	if v := req.GetString("content", ""); v != "" {
		update.Content = &v
		update.Payload = buildPayload(v)
	}
	if v := req.GetString("visibility", ""); v != "" {
		vis, err := parseVisibility(v)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		update.Visibility = &vis
	}
	if v := req.GetString("state", ""); v != "" {
		rs, err := parseRowStatus(v)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		update.RowStatus = &rs
	}
	if _, ok := args["pinned"]; ok {
		pinned := req.GetBool("pinned", false)
		update.Pinned = &pinned
	}

	if err := s.store.UpdateMemo(ctx, update); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to update memo: %v", err)), nil
	}

	updated, err := s.store.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to fetch updated memo: %v", err)), nil
	}

	out, err := marshalJSON(storeMemoToJSON(updated))
	if err != nil {
		return nil, err
	}
	return mcp.NewToolResultText(out), nil
}

func (s *MCPService) handleDeleteMemo(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, err := extractUserID(ctx)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	uid, err := parseMemoUID(req.GetString("name", ""))
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	memo, err := s.store.GetMemo(ctx, &store.FindMemo{UID: &uid})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to get memo: %v", err)), nil
	}
	if memo == nil {
		return mcp.NewToolResultError("memo not found"), nil
	}
	if memo.CreatorID != userID {
		return mcp.NewToolResultError("permission denied"), nil
	}

	if err := s.store.DeleteMemo(ctx, &store.DeleteMemo{ID: memo.ID}); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to delete memo: %v", err)), nil
	}
	return mcp.NewToolResultText(`{"deleted":true}`), nil
}

func (s *MCPService) handleSearchMemos(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := auth.GetUserID(ctx)

	query := req.GetString("query", "")
	if query == "" {
		return mcp.NewToolResultError("query is required"), nil
	}

	limit := 50
	zero := 0
	rowStatus := store.Normal
	find := &store.FindMemo{
		ExcludeComments: true,
		RowStatus:       &rowStatus,
		Limit:           &limit,
		Offset:          &zero,
		Filters:         []string{fmt.Sprintf(`content.contains(%q)`, query)},
	}
	applyVisibilityFilter(find, userID)

	memos, err := s.store.ListMemos(ctx, find)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to search memos: %v", err)), nil
	}

	results := make([]memoJSON, len(memos))
	for i, m := range memos {
		results[i] = storeMemoToJSON(m)
	}
	out, err := marshalJSON(results)
	if err != nil {
		return nil, err
	}
	return mcp.NewToolResultText(out), nil
}

func (s *MCPService) handleListMemoComments(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := auth.GetUserID(ctx)

	uid, err := parseMemoUID(req.GetString("name", ""))
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	parent, err := s.store.GetMemo(ctx, &store.FindMemo{UID: &uid})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to get memo: %v", err)), nil
	}
	if parent == nil {
		return mcp.NewToolResultError("memo not found"), nil
	}
	if err := checkMemoAccess(parent, userID); err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	relationType := store.MemoRelationComment
	relations, err := s.store.ListMemoRelations(ctx, &store.FindMemoRelation{
		RelatedMemoID: &parent.ID,
		Type:          &relationType,
	})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to list relations: %v", err)), nil
	}
	if len(relations) == 0 {
		out, _ := marshalJSON([]memoJSON{})
		return mcp.NewToolResultText(out), nil
	}

	commentIDs := make([]int32, len(relations))
	for i, r := range relations {
		commentIDs[i] = r.MemoID
	}

	memos, err := s.store.ListMemos(ctx, &store.FindMemo{IDList: commentIDs})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to list comments: %v", err)), nil
	}

	results := make([]memoJSON, 0, len(memos))
	for _, m := range memos {
		if checkMemoAccess(m, userID) == nil {
			results = append(results, storeMemoToJSON(m))
		}
	}
	out, err := marshalJSON(results)
	if err != nil {
		return nil, err
	}
	return mcp.NewToolResultText(out), nil
}

func (s *MCPService) handleCreateMemoComment(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, err := extractUserID(ctx)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	uid, err := parseMemoUID(req.GetString("name", ""))
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	content := req.GetString("content", "")
	if content == "" {
		return mcp.NewToolResultError("content is required"), nil
	}

	parent, err := s.store.GetMemo(ctx, &store.FindMemo{UID: &uid})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to get memo: %v", err)), nil
	}
	if parent == nil {
		return mcp.NewToolResultError("memo not found"), nil
	}
	if err := checkMemoAccess(parent, userID); err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	comment, err := s.store.CreateMemo(ctx, &store.Memo{
		UID:        shortuuid.New(),
		CreatorID:  userID,
		Content:    content,
		Visibility: parent.Visibility,
		Payload:    buildPayload(content),
		ParentUID:  &parent.UID,
	})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to create comment: %v", err)), nil
	}

	if _, err = s.store.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        comment.ID,
		RelatedMemoID: parent.ID,
		Type:          store.MemoRelationComment,
	}); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to link comment: %v", err)), nil
	}

	out, err := marshalJSON(storeMemoToJSON(comment))
	if err != nil {
		return nil, err
	}
	return mcp.NewToolResultText(out), nil
}
