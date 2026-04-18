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

type relationJSON struct {
	Memo        string `json:"memo"`
	RelatedMemo string `json:"related_memo"`
	Type        string `json:"type"`
}

func (s *MCPService) registerRelationTools(mcpSrv *mcpserver.MCPServer) {
	mcpSrv.AddTool(mcp.NewTool("list_memo_relations",
		readOnlyToolOptions("List memo relations", "List all relations (references and comments) for a memo. Requires read access to the memo.",
			mcp.WithString("name", mcp.Required(), mcp.Description(`Memo resource name, e.g. "memos/abc123"`)),
			mcp.WithString("type",
				mcp.Enum("REFERENCE", "COMMENT"),
				mcp.Description("Filter by relation type (optional)"),
			),
		)...,
	), s.handleListMemoRelations)

	mcpSrv.AddTool(mcp.NewTool("create_memo_relation",
		createToolOptions("Create memo relation", "Create a reference relation between two memos. Requires authentication. For comments, use create_memo_comment instead.", true,
			mcp.WithString("name", mcp.Required(), mcp.Description(`Source memo resource name, e.g. "memos/abc123"`)),
			mcp.WithString("related_memo", mcp.Required(), mcp.Description(`Target memo resource name, e.g. "memos/def456"`)),
			mcp.WithOutputSchema[relationJSON](),
		)...,
	), s.handleCreateMemoRelation)

	mcpSrv.AddTool(mcp.NewTool("delete_memo_relation",
		updateToolOptions("Delete memo relation", "Delete a reference relation between two memos. Requires authentication and ownership of the source memo.",
			mcp.WithString("name", mcp.Required(), mcp.Description(`Source memo resource name, e.g. "memos/abc123"`)),
			mcp.WithString("related_memo", mcp.Required(), mcp.Description(`Target memo resource name, e.g. "memos/def456"`)),
			mcp.WithOutputSchema[deletedJSON](),
		)...,
	), s.handleDeleteMemoRelation)
}

func (s *MCPService) handleListMemoRelations(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
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

	find := &store.FindMemoRelation{
		MemoIDList: []int32{memo.ID},
	}
	if typeStr := req.GetString("type", ""); typeStr != "" {
		switch store.MemoRelationType(typeStr) {
		case store.MemoRelationReference, store.MemoRelationComment:
			t := store.MemoRelationType(typeStr)
			find.Type = &t
		default:
			return mcp.NewToolResultError(fmt.Sprintf("type must be REFERENCE or COMMENT, got %q", typeStr)), nil
		}
	}

	relations, err := s.store.ListMemoRelations(ctx, find)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to list relations: %v", err)), nil
	}

	// Resolve memo IDs to UIDs.
	idSet := make(map[int32]struct{})
	for _, r := range relations {
		idSet[r.MemoID] = struct{}{}
		idSet[r.RelatedMemoID] = struct{}{}
	}
	ids := make([]int32, 0, len(idSet))
	for id := range idSet {
		ids = append(ids, id)
	}
	memos, err := s.store.ListMemos(ctx, &store.FindMemo{IDList: ids, ExcludeContent: true})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to resolve memos: %v", err)), nil
	}
	memoByID := make(map[int32]*store.Memo, len(memos))
	for _, m := range memos {
		memoByID[m.ID] = m
	}

	results := make([]relationJSON, 0, len(relations))
	for _, r := range relations {
		srcMemo, ok1 := memoByID[r.MemoID]
		relatedMemo, ok2 := memoByID[r.RelatedMemoID]
		if !ok1 || !ok2 {
			continue
		}
		if checkMemoAccess(srcMemo, userID) != nil || checkMemoAccess(relatedMemo, userID) != nil {
			continue
		}
		results = append(results, relationJSON{
			Memo:        "memos/" + srcMemo.UID,
			RelatedMemo: "memos/" + relatedMemo.UID,
			Type:        string(r.Type),
		})
	}

	return newToolResultJSON(results)
}

func (s *MCPService) handleCreateMemoRelation(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, err := extractUserID(ctx)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	srcUID, err := parseMemoUID(req.GetString("name", ""))
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	dstUID, err := parseMemoUID(req.GetString("related_memo", ""))
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	if srcUID == dstUID {
		return mcp.NewToolResultError("cannot create a relation from a memo to itself"), nil
	}

	srcMemo, err := s.store.GetMemo(ctx, &store.FindMemo{UID: &srcUID})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to get source memo: %v", err)), nil
	}
	if srcMemo == nil {
		return mcp.NewToolResultError("source memo not found"), nil
	}
	if !hasMemoOwnership(srcMemo, userID) {
		return mcp.NewToolResultError("permission denied: must own the source memo"), nil
	}

	dstMemo, err := s.store.GetMemo(ctx, &store.FindMemo{UID: &dstUID})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to get related memo: %v", err)), nil
	}
	if dstMemo == nil {
		return mcp.NewToolResultError("related memo not found"), nil
	}
	if err := checkMemoAccess(dstMemo, userID); err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	relations, changed, err := s.buildReferenceRelationSet(ctx, srcMemo, &dstMemo.UID, nil)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to build relation set: %v", err)), nil
	}
	if changed {
		if _, err := s.apiV1Service.SetMemoRelations(ctx, &v1pb.SetMemoRelationsRequest{
			Name:      "memos/" + srcUID,
			Relations: relations,
		}); err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to create relation: %v", err)), nil
		}
	}

	return newToolResultJSON(relationJSON{
		Memo:        "memos/" + srcUID,
		RelatedMemo: "memos/" + dstUID,
		Type:        string(store.MemoRelationReference),
	})
}

func (s *MCPService) handleDeleteMemoRelation(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID, err := extractUserID(ctx)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	srcUID, err := parseMemoUID(req.GetString("name", ""))
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	dstUID, err := parseMemoUID(req.GetString("related_memo", ""))
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	srcMemo, err := s.store.GetMemo(ctx, &store.FindMemo{UID: &srcUID})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to get source memo: %v", err)), nil
	}
	if srcMemo == nil {
		return mcp.NewToolResultError("source memo not found"), nil
	}
	if !hasMemoOwnership(srcMemo, userID) {
		return mcp.NewToolResultError("permission denied: must own the source memo"), nil
	}

	dstMemo, err := s.store.GetMemo(ctx, &store.FindMemo{UID: &dstUID})
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to get related memo: %v", err)), nil
	}
	if dstMemo == nil {
		return mcp.NewToolResultError("related memo not found"), nil
	}
	if err := checkMemoAccess(dstMemo, userID); err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	relations, changed, err := s.buildReferenceRelationSet(ctx, srcMemo, nil, &dstMemo.UID)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to build relation set: %v", err)), nil
	}
	if changed {
		if _, err := s.apiV1Service.SetMemoRelations(ctx, &v1pb.SetMemoRelationsRequest{
			Name:      "memos/" + srcUID,
			Relations: relations,
		}); err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to delete relation: %v", err)), nil
		}
	}
	return newDeletedToolResult()
}

func (s *MCPService) buildReferenceRelationSet(ctx context.Context, source *store.Memo, includeUID *string, excludeUID *string) ([]*v1pb.MemoRelation, bool, error) {
	referenceType := store.MemoRelationReference
	relations, err := s.store.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoIDList: []int32{source.ID},
		Type:       &referenceType,
	})
	if err != nil {
		return nil, false, err
	}

	idSet := make(map[int32]struct{}, len(relations))
	for _, relation := range relations {
		idSet[relation.RelatedMemoID] = struct{}{}
	}
	ids := make([]int32, 0, len(idSet))
	for id := range idSet {
		ids = append(ids, id)
	}

	memosByID := map[int32]*store.Memo{}
	if len(ids) > 0 {
		memos, err := s.store.ListMemos(ctx, &store.FindMemo{IDList: ids, ExcludeContent: true})
		if err != nil {
			return nil, false, err
		}
		for _, memo := range memos {
			memosByID[memo.ID] = memo
		}
	}

	result := make([]*v1pb.MemoRelation, 0, len(relations)+1)
	seenUIDs := map[string]struct{}{}
	changed := false
	for _, relation := range relations {
		relatedMemo := memosByID[relation.RelatedMemoID]
		if relatedMemo == nil {
			continue
		}
		if excludeUID != nil && relatedMemo.UID == *excludeUID {
			changed = true
			continue
		}
		result = append(result, newReferenceRelation(source.UID, relatedMemo.UID))
		seenUIDs[relatedMemo.UID] = struct{}{}
	}
	if includeUID != nil {
		if _, seen := seenUIDs[*includeUID]; !seen && source.UID != *includeUID {
			result = append(result, newReferenceRelation(source.UID, *includeUID))
			changed = true
		}
	}
	return result, changed, nil
}

func newReferenceRelation(sourceUID string, relatedUID string) *v1pb.MemoRelation {
	return &v1pb.MemoRelation{
		Memo:        &v1pb.MemoRelation_Memo{Name: "memos/" + sourceUID},
		RelatedMemo: &v1pb.MemoRelation_Memo{Name: "memos/" + relatedUID},
		Type:        v1pb.MemoRelation_REFERENCE,
	}
}
