package mcp

import (
	"context"
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"

	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

type reactionJSON struct {
	ID           int32  `json:"id"`
	Creator      string `json:"creator"`
	ReactionType string `json:"reaction_type"`
	CreateTime   int64  `json:"create_time"`
}

func (s *MCPService) registerReactionTools(mcpSrv *mcpserver.MCPServer) {
	mcpSrv.AddTool(mcp.NewTool("list_reactions",
		mcp.WithDescription("List all reactions on a memo. Returns reaction type and creator for each reaction."),
		mcp.WithString("name", mcp.Required(), mcp.Description(`Memo resource name, e.g. "memos/abc123"`)),
	), s.handleListReactions)

	mcpSrv.AddTool(mcp.NewTool("upsert_reaction",
		mcp.WithDescription("Add a reaction (emoji) to a memo. If the same reaction already exists from the same user, this is a no-op. Requires authentication."),
		mcp.WithString("name", mcp.Required(), mcp.Description(`Memo resource name, e.g. "memos/abc123"`)),
		mcp.WithString("reaction_type", mcp.Required(), mcp.Description(`Reaction emoji, e.g. "👍", "❤️", "🎉"`)),
	), s.handleUpsertReaction)

	mcpSrv.AddTool(mcp.NewTool("delete_reaction",
		mcp.WithDescription("Remove a reaction by its ID. Requires authentication and ownership of the reaction."),
		mcp.WithNumber("id", mcp.Required(), mcp.Description("Reaction ID to delete")),
	), s.handleDeleteReaction)
}

func (s *MCPService) handleListReactions(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
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

	contentID := "memos/" + uid
	reactions, err := s.store.ListReactions(ctx, &store.FindReaction{ContentID: &contentID})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to list reactions: %v", err)), nil
	}

	results := make([]reactionJSON, len(reactions))
	for i, r := range reactions {
		results[i] = reactionJSON{
			ID:           r.ID,
			Creator:      fmt.Sprintf("users/%d", r.CreatorID),
			ReactionType: r.ReactionType,
			CreateTime:   r.CreatedTs,
		}
	}

	out, err := marshalJSON(results)
	if err != nil {
		return nil, err
	}
	return mcp.NewToolResultText(out), nil
}

func (s *MCPService) handleUpsertReaction(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, err := extractUserID(ctx)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	uid, err := parseMemoUID(req.GetString("name", ""))
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	reactionType := req.GetString("reaction_type", "")
	if reactionType == "" {
		return mcp.NewToolResultError("reaction_type is required"), nil
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

	// Validate reaction type against allowed reactions.
	memoRelatedSetting, err := s.store.GetInstanceMemoRelatedSetting(ctx)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to get reaction settings: %v", err)), nil
	}
	allowed := false
	for _, r := range memoRelatedSetting.Reactions {
		if r == reactionType {
			allowed = true
			break
		}
	}
	if !allowed {
		return mcp.NewToolResultError(fmt.Sprintf("reaction %q is not in the allowed reaction list", reactionType)), nil
	}

	contentID := "memos/" + uid
	reaction, err := s.store.UpsertReaction(ctx, &store.Reaction{
		CreatorID:    userID,
		ContentID:    contentID,
		ReactionType: reactionType,
	})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to upsert reaction: %v", err)), nil
	}

	out, err := marshalJSON(reactionJSON{
		ID:           reaction.ID,
		Creator:      fmt.Sprintf("users/%d", reaction.CreatorID),
		ReactionType: reaction.ReactionType,
		CreateTime:   reaction.CreatedTs,
	})
	if err != nil {
		return nil, err
	}
	return mcp.NewToolResultText(out), nil
}

func (s *MCPService) handleDeleteReaction(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, err := extractUserID(ctx)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	reactionID := int32(req.GetInt("id", 0))
	if reactionID == 0 {
		return mcp.NewToolResultError("id is required"), nil
	}

	reaction, err := s.store.GetReaction(ctx, &store.FindReaction{ID: &reactionID})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to get reaction: %v", err)), nil
	}
	if reaction == nil {
		return mcp.NewToolResultError("reaction not found"), nil
	}
	if reaction.CreatorID != userID {
		return mcp.NewToolResultError("permission denied: can only delete your own reactions"), nil
	}

	if err := s.store.DeleteReaction(ctx, &store.DeleteReaction{ID: reactionID}); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to delete reaction: %v", err)), nil
	}
	return mcp.NewToolResultText(`{"deleted":true}`), nil
}
