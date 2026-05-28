package mcp

import (
	"context"
	"fmt"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"
	"github.com/pkg/errors"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
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

type attachmentListJSON struct {
	Attachments []attachmentJSON `json:"attachments"`
	HasMore     bool             `json:"has_more"`
}

func storeAttachmentToJSON(ctx context.Context, stores *store.Store, a *store.Attachment) (attachmentJSON, error) {
	creator, err := lookupUsername(ctx, stores, a.CreatorID)
	if err != nil {
		return attachmentJSON{}, errors.Wrap(err, "lookup attachment creator username")
	}
	j := attachmentJSON{
		Name:       "attachments/" + a.UID,
		Creator:    creator,
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
	return j, nil
}

func storeAttachmentToJSONWithUsernames(a *store.Attachment, usernamesByID map[int32]string) (attachmentJSON, error) {
	creator, err := lookupUsernameFromCache(usernamesByID, a.CreatorID)
	if err != nil {
		return attachmentJSON{}, errors.Wrap(err, "lookup attachment creator username from cache")
	}
	j := attachmentJSON{
		Name:       "attachments/" + a.UID,
		Creator:    creator,
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
	return j, nil
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
		readOnlyToolOptions("List attachments", "List attachments owned by the authenticated user. Supports pagination and optional filtering by linked memo.",
			mcp.WithNumber("page_size", mcp.Description("Maximum attachments to return (1–100, default 20)")),
			mcp.WithNumber("page", mcp.Description("Zero-based page index (default 0)")),
			mcp.WithString("memo", mcp.Description(`Filter by linked memo resource name, e.g. "memos/abc123"`)),
			mcp.WithOutputSchema[attachmentListJSON](),
		)...,
	), s.handleListAttachments)

	mcpSrv.AddTool(mcp.NewTool("get_attachment",
		readOnlyToolOptions("Get attachment", "Get a single attachment's metadata by resource name. Requires authentication.",
			mcp.WithString("name", mcp.Required(), mcp.Description(`Attachment resource name, e.g. "attachments/abc123"`)),
			mcp.WithOutputSchema[attachmentJSON](),
		)...,
	), s.handleGetAttachment)

	mcpSrv.AddTool(mcp.NewTool("delete_attachment",
		updateToolOptions("Delete attachment", "Permanently delete an attachment and its stored file. Requires authentication and ownership.",
			mcp.WithString("name", mcp.Required(), mcp.Description(`Attachment resource name, e.g. "attachments/abc123"`)),
			mcp.WithOutputSchema[deletedJSON](),
		)...,
	), s.handleDeleteAttachment)

	mcpSrv.AddTool(mcp.NewTool("link_attachment_to_memo",
		createToolOptions("Link attachment to memo", "Link an existing attachment to a memo. Requires authentication and ownership of the attachment.", true,
			mcp.WithString("name", mcp.Required(), mcp.Description(`Attachment resource name, e.g. "attachments/abc123"`)),
			mcp.WithString("memo", mcp.Required(), mcp.Description(`Memo resource name, e.g. "memos/abc123"`)),
			mcp.WithOutputSchema[attachmentJSON](),
		)...,
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
	creatorIDs := make([]int32, 0, len(attachments))
	for _, attachment := range attachments {
		creatorIDs = append(creatorIDs, attachment.CreatorID)
	}
	usernamesByID, err := preloadUsernames(ctx, s.store, creatorIDs)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to preload attachment creators: %v", err)), nil
	}

	results := make([]attachmentJSON, len(attachments))
	for i, a := range attachments {
		result, err := storeAttachmentToJSONWithUsernames(a, usernamesByID)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to resolve attachment creator: %v", err)), nil
		}
		results[i] = result
	}

	return newToolResultJSON(attachmentListJSON{Attachments: results, HasMore: hasMore})
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

	if err := s.checkAttachmentAccess(ctx, attachment, userID); err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	result, err := storeAttachmentToJSON(ctx, s.store, attachment)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to resolve attachment creator: %v", err)), nil
	}
	return newToolResultJSON(result)
}

func (s *MCPService) handleDeleteAttachment(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	if _, err := extractUserID(ctx); err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	uid, err := parseAttachmentUID(req.GetString("name", ""))
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	if _, err := s.apiV1Service.DeleteAttachment(ctx, &v1pb.DeleteAttachmentRequest{Name: "attachments/" + uid}); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to delete attachment: %v", err)), nil
	}
	return newDeletedToolResult()
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
	if err := checkMemoOwnership(memo, userID); err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	currentAttachments, err := s.store.ListAttachments(ctx, &store.FindAttachment{MemoID: &memo.ID})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to list memo attachments: %v", err)), nil
	}
	requestAttachments := make([]*v1pb.Attachment, 0, len(currentAttachments)+1)
	var currentTarget *store.Attachment
	for _, current := range currentAttachments {
		requestAttachments = append(requestAttachments, &v1pb.Attachment{Name: "attachments/" + current.UID})
		if current.ID == attachment.ID {
			currentTarget = current
		}
	}
	if currentTarget != nil {
		result, err := storeAttachmentToJSON(ctx, s.store, currentTarget)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to resolve attachment creator: %v", err)), nil
		}
		return newToolResultJSON(result)
	}
	requestAttachments = append(requestAttachments, &v1pb.Attachment{Name: "attachments/" + uid})

	if _, err := s.apiV1Service.SetMemoAttachments(ctx, &v1pb.SetMemoAttachmentsRequest{
		Name:        "memos/" + memoUID,
		Attachments: requestAttachments,
	}); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to link attachment: %v", err)), nil
	}

	// Re-fetch to get updated memo UID.
	updated, err := s.store.GetAttachment(ctx, &store.FindAttachment{ID: &attachment.ID})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to fetch updated attachment: %v", err)), nil
	}
	result, err := storeAttachmentToJSON(ctx, s.store, updated)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to resolve attachment creator: %v", err)), nil
	}
	return newToolResultJSON(result)
}
