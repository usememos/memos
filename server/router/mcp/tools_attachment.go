package mcp

import (
	"context"
	"fmt"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"
	"github.com/pkg/errors"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

type attachmentJSON struct {
	Name         string `json:"name"`
	Creator      string `json:"creator"`
	CreateTime   int64  `json:"create_time"`
	Filename     string `json:"filename"`
	Type         string `json:"type"`
	Size         int64  `json:"size"`
	StorageType  string `json:"storage_type"`
	ExternalLink string `json:"external_link,omitempty"`
	Memo         string `json:"memo,omitempty"`
}

func storeAttachmentToJSON(a *store.Attachment) attachmentJSON {
	j := attachmentJSON{
		Name:       "attachments/" + a.UID,
		Creator:    fmt.Sprintf("users/%d", a.CreatorID),
		CreateTime: a.CreatedTs,
		Filename:   a.Filename,
		Type:       a.Type,
		Size:       a.Size,
	}
	switch a.StorageType {
	case storepb.AttachmentStorageType_LOCAL:
		j.StorageType = "LOCAL"
	case storepb.AttachmentStorageType_S3:
		j.StorageType = "S3"
		j.ExternalLink = a.Reference
	case storepb.AttachmentStorageType_EXTERNAL:
		j.StorageType = "EXTERNAL"
		j.ExternalLink = a.Reference
	default:
		j.StorageType = "DATABASE"
	}
	if a.MemoUID != nil && *a.MemoUID != "" {
		j.Memo = "memos/" + *a.MemoUID
	}
	return j
}

func parseAttachmentUID(name string) (string, error) {
	uid, ok := strings.CutPrefix(name, "attachments/")
	if !ok || uid == "" {
		return "", errors.Errorf(`attachment name must be "attachments/<uid>", got %q`, name)
	}
	return uid, nil
}

func (s *MCPService) registerAttachmentTools(mcpSrv *mcpserver.MCPServer) {
	mcpSrv.AddTool(mcp.NewTool("list_attachments",
		mcp.WithDescription("List attachments owned by the authenticated user. Supports pagination and optional filtering by linked memo."),
		mcp.WithNumber("page_size", mcp.Description("Maximum attachments to return (1–100, default 20)")),
		mcp.WithNumber("page", mcp.Description("Zero-based page index (default 0)")),
		mcp.WithString("memo", mcp.Description(`Filter by linked memo resource name, e.g. "memos/abc123"`)),
	), s.handleListAttachments)

	mcpSrv.AddTool(mcp.NewTool("get_attachment",
		mcp.WithDescription("Get a single attachment's metadata by resource name. Requires authentication."),
		mcp.WithString("name", mcp.Required(), mcp.Description(`Attachment resource name, e.g. "attachments/abc123"`)),
	), s.handleGetAttachment)

	mcpSrv.AddTool(mcp.NewTool("delete_attachment",
		mcp.WithDescription("Permanently delete an attachment and its stored file. Requires authentication and ownership."),
		mcp.WithString("name", mcp.Required(), mcp.Description(`Attachment resource name, e.g. "attachments/abc123"`)),
	), s.handleDeleteAttachment)

	mcpSrv.AddTool(mcp.NewTool("link_attachment_to_memo",
		mcp.WithDescription("Link an existing attachment to a memo. Requires authentication and ownership of the attachment."),
		mcp.WithString("name", mcp.Required(), mcp.Description(`Attachment resource name, e.g. "attachments/abc123"`)),
		mcp.WithString("memo", mcp.Required(), mcp.Description(`Memo resource name, e.g. "memos/abc123"`)),
	), s.handleLinkAttachmentToMemo)
}

func (s *MCPService) handleListAttachments(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
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
	page := req.GetInt("page", 0)
	if page < 0 {
		page = 0
	}

	limit := pageSize + 1
	offset := page * pageSize
	find := &store.FindAttachment{
		CreatorID: &userID,
		Limit:     &limit,
		Offset:    &offset,
	}

	if memoName := req.GetString("memo", ""); memoName != "" {
		memoUID, err := parseMemoUID(memoName)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		memo, err := s.store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to find memo: %v", err)), nil
		}
		if memo == nil {
			return mcp.NewToolResultError("memo not found"), nil
		}
		find.MemoID = &memo.ID
	}

	attachments, err := s.store.ListAttachments(ctx, find)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to list attachments: %v", err)), nil
	}

	hasMore := len(attachments) > pageSize
	if hasMore {
		attachments = attachments[:pageSize]
	}

	results := make([]attachmentJSON, len(attachments))
	for i, a := range attachments {
		results[i] = storeAttachmentToJSON(a)
	}

	type listResponse struct {
		Attachments []attachmentJSON `json:"attachments"`
		HasMore     bool             `json:"has_more"`
	}
	out, err := marshalJSON(listResponse{Attachments: results, HasMore: hasMore})
	if err != nil {
		return nil, err
	}
	return mcp.NewToolResultText(out), nil
}

func (s *MCPService) handleGetAttachment(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := auth.GetUserID(ctx)

	uid, err := parseAttachmentUID(req.GetString("name", ""))
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	attachment, err := s.store.GetAttachment(ctx, &store.FindAttachment{UID: &uid})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to get attachment: %v", err)), nil
	}
	if attachment == nil {
		return mcp.NewToolResultError("attachment not found"), nil
	}

	// Check access: creator can always access; linked memo visibility applies otherwise.
	if attachment.CreatorID != userID {
		if attachment.MemoID != nil {
			memo, err := s.store.GetMemo(ctx, &store.FindMemo{ID: attachment.MemoID})
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to get linked memo: %v", err)), nil
			}
			if memo != nil {
				if err := checkMemoAccess(memo, userID); err != nil {
					return mcp.NewToolResultError(err.Error()), nil
				}
			}
		} else {
			return mcp.NewToolResultError("permission denied"), nil
		}
	}

	out, err := marshalJSON(storeAttachmentToJSON(attachment))
	if err != nil {
		return nil, err
	}
	return mcp.NewToolResultText(out), nil
}

func (s *MCPService) handleDeleteAttachment(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, err := extractUserID(ctx)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	uid, err := parseAttachmentUID(req.GetString("name", ""))
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	attachment, err := s.store.GetAttachment(ctx, &store.FindAttachment{UID: &uid, CreatorID: &userID})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to find attachment: %v", err)), nil
	}
	if attachment == nil {
		return mcp.NewToolResultError("attachment not found"), nil
	}

	if err := s.store.DeleteAttachment(ctx, &store.DeleteAttachment{ID: attachment.ID}); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to delete attachment: %v", err)), nil
	}
	return mcp.NewToolResultText(`{"deleted":true}`), nil
}

func (s *MCPService) handleLinkAttachmentToMemo(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, err := extractUserID(ctx)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	uid, err := parseAttachmentUID(req.GetString("name", ""))
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	attachment, err := s.store.GetAttachment(ctx, &store.FindAttachment{UID: &uid})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to get attachment: %v", err)), nil
	}
	if attachment == nil {
		return mcp.NewToolResultError("attachment not found"), nil
	}
	if attachment.CreatorID != userID {
		return mcp.NewToolResultError("permission denied"), nil
	}

	memoUID, err := parseMemoUID(req.GetString("memo", ""))
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	memo, err := s.store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to get memo: %v", err)), nil
	}
	if memo == nil {
		return mcp.NewToolResultError("memo not found"), nil
	}

	if err := s.store.UpdateAttachment(ctx, &store.UpdateAttachment{
		ID:     attachment.ID,
		MemoID: &memo.ID,
	}); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to link attachment: %v", err)), nil
	}

	// Re-fetch to get updated memo UID.
	updated, err := s.store.GetAttachment(ctx, &store.FindAttachment{ID: &attachment.ID})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to fetch updated attachment: %v", err)), nil
	}
	out, err := marshalJSON(storeAttachmentToJSON(updated))
	if err != nil {
		return nil, err
	}
	return mcp.NewToolResultText(out), nil
}
