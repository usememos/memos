package mcp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/lithammer/shortuuid/v4"
	"github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"

	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

func extractUserID(ctx context.Context) (int32, error) {
	id := auth.GetUserID(ctx)
	if id == 0 {
		return 0, errors.New("unauthenticated")
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
	listTool := mcp.NewTool("list_memos",
		mcp.WithDescription("List the authenticated user's memos"),
		mcp.WithNumber("page_size", mcp.Description("Max memos to return, default 20")),
		mcp.WithString("filter", mcp.Description(`CEL filter expression, e.g. content.contains("keyword")`)),
	)
	mcpSrv.AddTool(listTool, s.handleListMemos)

	getTool := mcp.NewTool("get_memo",
		mcp.WithDescription("Get a single memo by resource name"),
		mcp.WithString("name", mcp.Required(), mcp.Description(`Memo resource name, e.g. "memos/abc123"`)),
	)
	mcpSrv.AddTool(getTool, s.handleGetMemo)

	createTool := mcp.NewTool("create_memo",
		mcp.WithDescription("Create a new memo"),
		mcp.WithString("content", mcp.Required(), mcp.Description("Memo content")),
		mcp.WithString("visibility",
			mcp.Enum("PRIVATE", "PROTECTED", "PUBLIC"),
			mcp.Description("Visibility: PRIVATE (default), PROTECTED, or PUBLIC"),
		),
	)
	mcpSrv.AddTool(createTool, s.handleCreateMemo)

	updateTool := mcp.NewTool("update_memo",
		mcp.WithDescription("Update a memo's content or visibility"),
		mcp.WithString("name", mcp.Required(), mcp.Description(`Memo resource name, e.g. "memos/abc123"`)),
		mcp.WithString("content", mcp.Description("New content (omit to leave unchanged)")),
		mcp.WithString("visibility",
			mcp.Enum("PRIVATE", "PROTECTED", "PUBLIC"),
			mcp.Description("New visibility (omit to leave unchanged)"),
		),
	)
	mcpSrv.AddTool(updateTool, s.handleUpdateMemo)

	deleteTool := mcp.NewTool("delete_memo",
		mcp.WithDescription("Delete a memo"),
		mcp.WithString("name", mcp.Required(), mcp.Description(`Memo resource name, e.g. "memos/abc123"`)),
	)
	mcpSrv.AddTool(deleteTool, s.handleDeleteMemo)

	searchTool := mcp.NewTool("search_memos",
		mcp.WithDescription("Search memo content using a text query"),
		mcp.WithString("query", mcp.Required(), mcp.Description("Text to search in memo content")),
	)
	mcpSrv.AddTool(searchTool, s.handleSearchMemos)
}

func (s *MCPService) handleListMemos(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, err := extractUserID(ctx)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	pageSize := req.GetInt("page_size", 20)
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	filterExpr := req.GetString("filter", "")

	rowStatus := store.Normal
	limitPlusOne := pageSize + 1
	zero := 0
	find := &store.FindMemo{
		CreatorID:       &userID,
		ExcludeComments: true,
		RowStatus:       &rowStatus,
		Limit:           &limitPlusOne,
		Offset:          &zero,
	}
	if filterExpr != "" {
		find.Filters = append(find.Filters, filterExpr)
	}

	memos, err := s.store.ListMemos(ctx, find)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to list memos: %v", err)), nil
	}
	if len(memos) == limitPlusOne {
		memos = memos[:pageSize]
	}

	out, err := marshalJSON(memos)
	if err != nil {
		return nil, err
	}
	return mcp.NewToolResultText(out), nil
}

func (s *MCPService) handleGetMemo(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, err := extractUserID(ctx)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	name := req.GetString("name", "")
	if name == "" {
		return mcp.NewToolResultError("name is required"), nil
	}
	uid, found := strings.CutPrefix(name, "memos/")
	if !found || uid == "" {
		return mcp.NewToolResultError(`name must be in the format "memos/<uid>"`), nil
	}

	memo, err := s.store.GetMemo(ctx, &store.FindMemo{UID: &uid})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to get memo: %v", err)), nil
	}
	if memo == nil {
		return mcp.NewToolResultError("memo not found"), nil
	}
	if memo.Visibility == store.Private && memo.CreatorID != userID {
		return mcp.NewToolResultError("permission denied"), nil
	}

	out, err := marshalJSON(memo)
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

	visibility := req.GetString("visibility", "PRIVATE")
	switch visibility {
	case "PRIVATE", "PROTECTED", "PUBLIC":
	default:
		return mcp.NewToolResultError("visibility must be PRIVATE, PROTECTED, or PUBLIC"), nil
	}

	create := &store.Memo{
		UID:        shortuuid.New(),
		CreatorID:  userID,
		Content:    content,
		Visibility: store.Visibility(visibility),
	}
	memo, err := s.store.CreateMemo(ctx, create)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to create memo: %v", err)), nil
	}

	out, err := marshalJSON(memo)
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

	name := req.GetString("name", "")
	if name == "" {
		return mcp.NewToolResultError("name is required"), nil
	}
	uid, found := strings.CutPrefix(name, "memos/")
	if !found || uid == "" {
		return mcp.NewToolResultError(`name must be in the format "memos/<uid>"`), nil
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
	if content := req.GetString("content", ""); content != "" {
		update.Content = &content
	}
	if vis := req.GetString("visibility", ""); vis != "" {
		switch vis {
		case "PRIVATE", "PROTECTED", "PUBLIC":
		default:
			return mcp.NewToolResultError("visibility must be PRIVATE, PROTECTED, or PUBLIC"), nil
		}
		v := store.Visibility(vis)
		update.Visibility = &v
	}

	if err := s.store.UpdateMemo(ctx, update); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to update memo: %v", err)), nil
	}

	updated, err := s.store.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to fetch updated memo: %v", err)), nil
	}

	out, err := marshalJSON(updated)
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

	name := req.GetString("name", "")
	if name == "" {
		return mcp.NewToolResultError("name is required"), nil
	}
	uid, found := strings.CutPrefix(name, "memos/")
	if !found || uid == "" {
		return mcp.NewToolResultError(`name must be in the format "memos/<uid>"`), nil
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
	return mcp.NewToolResultText("memo deleted"), nil
}

func (s *MCPService) handleSearchMemos(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, err := extractUserID(ctx)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	query := req.GetString("query", "")
	if query == "" {
		return mcp.NewToolResultError("query is required"), nil
	}

	rowStatus := store.Normal
	limit := 50
	zero := 0
	find := &store.FindMemo{
		ExcludeComments: true,
		RowStatus:       &rowStatus,
		Limit:           &limit,
		Offset:          &zero,
		Filters: []string{
			fmt.Sprintf("creator_id == %d", userID),
			fmt.Sprintf(`content.contains(%q)`, query),
		},
	}

	memos, err := s.store.ListMemos(ctx, find)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to search memos: %v", err)), nil
	}

	out, err := marshalJSON(memos)
	if err != nil {
		return nil, err
	}
	return mcp.NewToolResultText(out), nil
}
