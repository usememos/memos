package mcp

import (
	"context"
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
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
		readOnlyToolOptions("List reactions", "List all reactions on a memo. Returns reaction type and creator for each reaction.",
			mcp.WithString("name", mcp.Required(), mcp.Description(`Memo resource name, e.g. "memos/abc123"`)),
		)...,
	), s.handleListReactions)

	mcpSrv.AddTool(mcp.NewTool("upsert_reaction",
		createToolOptions("Upsert reaction", "Add a reaction (emoji) to a memo. If the same reaction already exists from the same user, this is a no-op. Requires authentication.", true,
			mcp.WithString("name", mcp.Required(), mcp.Description(`Memo resource name, e.g. "memos/abc123"`)),
			mcp.WithString("reaction_type", mcp.Required(), mcp.Description(`Reaction emoji, e.g. "👍", "❤️", "🎉"`)),
			mcp.WithOutputSchema[reactionJSON](),
		)...,
	), s.handleUpsertReaction)

	mcpSrv.AddTool(mcp.NewTool("delete_reaction",
		updateToolOptions("Delete reaction", "Remove a reaction by its ID. Requires authentication and ownership of the reaction.",
			mcp.WithNumber("id", mcp.Required(), mcp.Description("Reaction ID to delete")),
			mcp.WithOutputSchema[deletedJSON](),
		)...,
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
	creatorIDs := make([]int32, 0, len(reactions))
	for _, reaction := range reactions {
		creatorIDs = append(creatorIDs, reaction.CreatorID)
	}
	usernamesByID, err := preloadUsernames(ctx, s.store, creatorIDs)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to preload reaction creators: %v", err)), nil
	}

	results := make([]reactionJSON, len(reactions))
	for i, r := range reactions {
		creator, err := lookupUsernameFromCache(usernamesByID, r.CreatorID)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to resolve reaction creator: %v", err)), nil
		}
		results[i] = reactionJSON{
			ID:           r.ID,
			Creator:      creator,
			ReactionType: r.ReactionType,
			CreateTime:   r.CreatedTs,
		}
	}

	return newToolResultJSON(results)
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
	reaction, err := s.apiV1Service.UpsertMemoReaction(ctx, &v1pb.UpsertMemoReactionRequest{
		Name: contentID,
		Reaction: &v1pb.Reaction{
			ContentId:    contentID,
			ReactionType: reactionType,
		},
	})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to upsert reaction: %v", err)), nil
	}

	result, err := s.loadReactionJSONByName(ctx, reaction.Name)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return newToolResultJSON(result)
}

func (s *MCPService) handleDeleteReaction(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	if _, err := extractUserID(ctx); err != nil {
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

	if _, err := s.apiV1Service.DeleteMemoReaction(ctx, &v1pb.DeleteMemoReactionRequest{
		Name: fmt.Sprintf("%s/reactions/%d", reaction.ContentID, reactionID),
	}); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to delete reaction: %v", err)), nil
	}
	return newDeletedToolResult()
}
