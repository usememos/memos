package mcp

import (
	"context"
	"fmt"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"
	"github.com/pkg/errors"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

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

type memoListJSON struct {
	Memos   []memoJSON `json:"memos"`
	HasMore bool       `json:"has_more"`
}

func storeMemoToJSON(m *store.Memo) memoJSON {
	j := memoJSON{
		Name:       "memos/" + m.UID,
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

func lookupUsername(ctx context.Context, stores *store.Store, userID int32) (string, error) {
	user, err := stores.GetUser(ctx, &store.FindUser{ID: &userID})
	if err != nil {
		return "", errors.Wrapf(err, "failed to get creator user %d", userID)
	}
	if user == nil {
		return "", errors.Errorf("creator user %d not found", userID)
	}
	return "users/" + user.Username, nil
}

func preloadUsernames(ctx context.Context, stores *store.Store, userIDs []int32) (map[int32]string, error) {
	if len(userIDs) == 0 {
		return map[int32]string{}, nil
	}

	uniqueUserIDs := make([]int32, 0, len(userIDs))
	seenUserIDs := make(map[int32]struct{}, len(userIDs))
	for _, userID := range userIDs {
		if _, seen := seenUserIDs[userID]; seen {
			continue
		}
		seenUserIDs[userID] = struct{}{}
		uniqueUserIDs = append(uniqueUserIDs, userID)
	}

	users, err := stores.ListUsers(ctx, &store.FindUser{IDList: uniqueUserIDs})
	if err != nil {
		return nil, errors.Wrap(err, "failed to list creator users")
	}

	usernamesByID := make(map[int32]string, len(users))
	for _, user := range users {
		usernamesByID[user.ID] = "users/" + user.Username
	}
	return usernamesByID, nil
}

func lookupUsernameFromCache(usernamesByID map[int32]string, userID int32) (string, error) {
	username, ok := usernamesByID[userID]
	if !ok {
		return "", errors.Errorf("creator user %d not found", userID)
	}
	return username, nil
}

func storeMemoToJSONWithStore(ctx context.Context, stores *store.Store, m *store.Memo) (memoJSON, error) {
	j := storeMemoToJSON(m)
	creator, err := lookupUsername(ctx, stores, m.CreatorID)
	if err != nil {
		return memoJSON{}, err
	}
	j.Creator = creator
	return j, nil
}

func storeMemoToJSONWithUsernames(m *store.Memo, usernamesByID map[int32]string) (memoJSON, error) {
	j := storeMemoToJSON(m)
	creator, err := lookupUsernameFromCache(usernamesByID, m.CreatorID)
	if err != nil {
		return memoJSON{}, err
	}
	j.Creator = creator
	return j, nil
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

func (s *MCPService) registerMemoTools(mcpSrv *mcpserver.MCPServer) {
	mcpSrv.AddTool(mcp.NewTool("list_memos",
		readOnlyToolOptions("List memos", "List memos visible to the caller. Authenticated users see their own memos plus public and protected memos; unauthenticated callers see only public memos.",
			mcp.WithNumber("page_size", mcp.Description("Maximum memos to return (1–100, default 20)")),
			mcp.WithNumber("page", mcp.Description("Zero-based page index for pagination (default 0)")),
			mcp.WithString("state",
				mcp.Enum("NORMAL", "ARCHIVED"),
				mcp.Description("Filter by state: NORMAL (default) or ARCHIVED"),
			),
			mcp.WithBoolean("order_by_pinned", mcp.Description("When true, pinned memos appear first (default false)")),
			mcp.WithString("filter", mcp.Description(`Optional CEL filter (supported subset of standard CEL syntax), e.g. content.contains("keyword") or tags.exists(t, t == "work")`)),
			mcp.WithOutputSchema[memoListJSON](),
		)...,
	), s.handleListMemos)

	mcpSrv.AddTool(mcp.NewTool("get_memo",
		readOnlyToolOptions("Get memo", "Get a single memo by resource name. Public memos are accessible without authentication.",
			mcp.WithString("name", mcp.Required(), mcp.Description(`Memo resource name, e.g. "memos/abc123"`)),
			mcp.WithOutputSchema[memoJSON](),
		)...,
	), s.handleGetMemo)

	mcpSrv.AddTool(mcp.NewTool("create_memo",
		createToolOptions("Create memo", "Create a new memo. Requires authentication.", false,
			mcp.WithString("content", mcp.Required(), mcp.Description("Memo content in Markdown. Use #tag syntax for tagging.")),
			mcp.WithString("visibility",
				mcp.Enum("PRIVATE", "PROTECTED", "PUBLIC"),
				mcp.Description("Visibility (default: PRIVATE)"),
			),
			mcp.WithOutputSchema[memoJSON](),
		)...,
	), s.handleCreateMemo)

	mcpSrv.AddTool(mcp.NewTool("update_memo",
		updateToolOptions("Update memo", "Update a memo's content, visibility, pin state, or archive state. Requires authentication and ownership. Omit any field to leave it unchanged.",
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
			mcp.WithOutputSchema[memoJSON](),
		)...,
	), s.handleUpdateMemo)

	mcpSrv.AddTool(mcp.NewTool("delete_memo",
		updateToolOptions("Delete memo", "Permanently delete a memo. Requires authentication and ownership.",
			mcp.WithString("name", mcp.Required(), mcp.Description(`Memo resource name, e.g. "memos/abc123"`)),
			mcp.WithOutputSchema[deletedJSON](),
		)...,
	), s.handleDeleteMemo)

	mcpSrv.AddTool(mcp.NewTool("search_memos",
		readOnlyToolOptions("Search memos", "Search memo content. Authenticated users search their own and visible memos; unauthenticated callers search public memos only.",
			mcp.WithString("query", mcp.Required(), mcp.Description("Text to search for in memo content")),
		)...,
	), s.handleSearchMemos)

	mcpSrv.AddTool(mcp.NewTool("list_memo_comments",
		readOnlyToolOptions("List memo comments", "List comments on a memo. Visibility rules for comments match those of the parent memo.",
			mcp.WithString("name", mcp.Required(), mcp.Description(`Memo resource name, e.g. "memos/abc123"`)),
		)...,
	), s.handleListMemoComments)

	mcpSrv.AddTool(mcp.NewTool("create_memo_comment",
		createToolOptions("Create memo comment", "Add a comment to a memo. The comment inherits the parent memo's visibility. Requires authentication.", false,
			mcp.WithString("name", mcp.Required(), mcp.Description(`Memo resource name to comment on, e.g. "memos/abc123"`)),
			mcp.WithString("content", mcp.Required(), mcp.Description("Comment content in Markdown")),
			mcp.WithOutputSchema[memoJSON](),
		)...,
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
	applyVisibilityFilter(find, userID, rowStatus)
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
	creatorIDs := make([]int32, 0, len(memos))
	for _, memo := range memos {
		creatorIDs = append(creatorIDs, memo.CreatorID)
	}
	usernamesByID, err := preloadUsernames(ctx, s.store, creatorIDs)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to preload memo creators: %v", err)), nil
	}

	results := make([]memoJSON, len(memos))
	for i, m := range memos {
		result, err := storeMemoToJSONWithUsernames(m, usernamesByID)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to resolve memo creator: %v", err)), nil
		}
		results[i] = result
	}

	return newToolResultJSON(memoListJSON{Memos: results, HasMore: hasMore})
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

	result, err := storeMemoToJSONWithStore(ctx, s.store, memo)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to resolve memo creator: %v", err)), nil
	}
	return newToolResultJSON(result)
}

func (s *MCPService) handleCreateMemo(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	if _, err := extractUserID(ctx); err != nil {
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

	created, err := s.apiV1Service.CreateMemo(ctx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{
			Content:    content,
			Visibility: visibilityToProto(visibility),
		},
	})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to create memo: %v", err)), nil
	}

	result, err := s.loadMemoJSONByName(ctx, created.Name)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return newToolResultJSON(result)
}

func (s *MCPService) handleUpdateMemo(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	if _, err := extractUserID(ctx); err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	uid, err := parseMemoUID(req.GetString("name", ""))
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	update := &v1pb.Memo{Name: "memos/" + uid}
	updateMask := &fieldmaskpb.FieldMask{}
	args := req.GetArguments()

	if v := req.GetString("content", ""); v != "" {
		update.Content = v
		updateMask.Paths = append(updateMask.Paths, "content")
	}
	if v := req.GetString("visibility", ""); v != "" {
		vis, err := parseVisibility(v)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		update.Visibility = visibilityToProto(vis)
		updateMask.Paths = append(updateMask.Paths, "visibility")
	}
	if v := req.GetString("state", ""); v != "" {
		rs, err := parseRowStatus(v)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		update.State = rowStatusToProto(rs)
		updateMask.Paths = append(updateMask.Paths, "state")
	}
	if _, ok := args["pinned"]; ok {
		update.Pinned = req.GetBool("pinned", false)
		updateMask.Paths = append(updateMask.Paths, "pinned")
	}

	if len(updateMask.Paths) == 0 {
		return mcp.NewToolResultError("at least one field must be provided to update"), nil
	}

	updated, err := s.apiV1Service.UpdateMemo(ctx, &v1pb.UpdateMemoRequest{
		Memo:       update,
		UpdateMask: updateMask,
	})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to update memo: %v", err)), nil
	}

	result, err := s.loadMemoJSONByName(ctx, updated.Name)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return newToolResultJSON(result)
}

func (s *MCPService) handleDeleteMemo(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	if _, err := extractUserID(ctx); err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	uid, err := parseMemoUID(req.GetString("name", ""))
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	if _, err := s.apiV1Service.DeleteMemo(ctx, &v1pb.DeleteMemoRequest{Name: "memos/" + uid}); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to delete memo: %v", err)), nil
	}
	return newDeletedToolResult()
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
	applyVisibilityFilter(find, userID, find.RowStatus)

	memos, err := s.store.ListMemos(ctx, find)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to search memos: %v", err)), nil
	}
	creatorIDs := make([]int32, 0, len(memos))
	for _, memo := range memos {
		creatorIDs = append(creatorIDs, memo.CreatorID)
	}
	usernamesByID, err := preloadUsernames(ctx, s.store, creatorIDs)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to preload memo creators: %v", err)), nil
	}

	results := make([]memoJSON, len(memos))
	for i, m := range memos {
		result, err := storeMemoToJSONWithUsernames(m, usernamesByID)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to resolve memo creator: %v", err)), nil
		}
		results[i] = result
	}
	return newToolResultJSON(results)
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
		return newToolResultJSON([]memoJSON{})
	}

	commentIDs := make([]int32, len(relations))
	for i, r := range relations {
		commentIDs[i] = r.MemoID
	}

	memos, err := s.store.ListMemos(ctx, &store.FindMemo{IDList: commentIDs})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to list comments: %v", err)), nil
	}
	creatorIDs := make([]int32, 0, len(memos))
	for _, memo := range memos {
		if checkMemoAccess(memo, userID) == nil {
			creatorIDs = append(creatorIDs, memo.CreatorID)
		}
	}
	usernamesByID, err := preloadUsernames(ctx, s.store, creatorIDs)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to preload memo creators: %v", err)), nil
	}

	results := make([]memoJSON, 0, len(memos))
	for _, m := range memos {
		if checkMemoAccess(m, userID) == nil {
			result, err := storeMemoToJSONWithUsernames(m, usernamesByID)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to resolve memo creator: %v", err)), nil
			}
			results = append(results, result)
		}
	}
	return newToolResultJSON(results)
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

	comment, err := s.apiV1Service.CreateMemoComment(ctx, &v1pb.CreateMemoCommentRequest{
		Name: "memos/" + uid,
		Comment: &v1pb.Memo{
			Content:    content,
			Visibility: visibilityToProto(parent.Visibility),
		},
	})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to create comment: %v", err)), nil
	}

	result, err := s.loadMemoJSONByName(ctx, comment.Name)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return newToolResultJSON(result)
}
