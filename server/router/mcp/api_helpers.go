package mcp

import (
	"context"

	"github.com/pkg/errors"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	apiv1 "github.com/usememos/memos/server/router/api/v1"
	"github.com/usememos/memos/store"
)

func visibilityToProto(visibility store.Visibility) v1pb.Visibility {
	switch visibility {
	case store.Protected:
		return v1pb.Visibility_PROTECTED
	case store.Public:
		return v1pb.Visibility_PUBLIC
	default:
		return v1pb.Visibility_PRIVATE
	}
}

func rowStatusToProto(rowStatus store.RowStatus) v1pb.State {
	switch rowStatus {
	case store.Archived:
		return v1pb.State_ARCHIVED
	default:
		return v1pb.State_NORMAL
	}
}

func (s *MCPService) loadMemoJSONByName(ctx context.Context, name string) (memoJSON, error) {
	uid, err := parseMemoUID(name)
	if err != nil {
		return memoJSON{}, err
	}
	memo, err := s.store.GetMemo(ctx, &store.FindMemo{UID: &uid})
	if err != nil {
		return memoJSON{}, errors.Wrap(err, "failed to get memo")
	}
	if memo == nil {
		return memoJSON{}, errors.New("memo not found")
	}
	return storeMemoToJSONWithStore(ctx, s.store, memo)
}

func (s *MCPService) loadReactionJSONByID(ctx context.Context, reactionID int32) (reactionJSON, error) {
	reaction, err := s.store.GetReaction(ctx, &store.FindReaction{ID: &reactionID})
	if err != nil {
		return reactionJSON{}, errors.Wrap(err, "failed to get reaction")
	}
	if reaction == nil {
		return reactionJSON{}, errors.New("reaction not found")
	}
	creator, err := lookupUsername(ctx, s.store, reaction.CreatorID)
	if err != nil {
		return reactionJSON{}, errors.Wrap(err, "failed to resolve reaction creator")
	}
	return reactionJSON{
		ID:           reaction.ID,
		Creator:      creator,
		ReactionType: reaction.ReactionType,
		CreateTime:   reaction.CreatedTs,
	}, nil
}

func (s *MCPService) loadReactionJSONByName(ctx context.Context, name string) (reactionJSON, error) {
	_, reactionID, err := apiv1.ExtractMemoReactionIDFromName(name)
	if err != nil {
		return reactionJSON{}, err
	}
	return s.loadReactionJSONByID(ctx, reactionID)
}
