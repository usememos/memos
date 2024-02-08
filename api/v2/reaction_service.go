package v2

import (
	"context"
	"fmt"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (s *APIV2Service) ListMemoReactions(ctx context.Context, request *apiv2pb.ListMemoReactionsRequest) (*apiv2pb.ListMemoReactionsResponse, error) {
	contentID := fmt.Sprintf("memos/%d", request.Id)
	reactions, err := s.Store.ListReactions(ctx, &store.FindReaction{
		ContentID: &contentID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list reactions")
	}

	response := &apiv2pb.ListMemoReactionsResponse{
		Reactions: []*apiv2pb.Reaction{},
	}
	for _, reaction := range reactions {
		reactionMessage, err := s.convertReactionFromStore(ctx, reaction)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to convert reaction")
		}
		response.Reactions = append(response.Reactions, reactionMessage)
	}
	return response, nil
}

func (s *APIV2Service) UpsertMemoReaction(ctx context.Context, request *apiv2pb.UpsertMemoReactionRequest) (*apiv2pb.UpsertMemoReactionResponse, error) {
	user, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	reaction, err := s.Store.UpsertReaction(ctx, &storepb.Reaction{
		CreatorId:    user.ID,
		ContentId:    request.Reaction.ContentId,
		ReactionType: storepb.Reaction_Type(request.Reaction.ReactionType),
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to upsert reaction")
	}

	reactionMessage, err := s.convertReactionFromStore(ctx, reaction)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to convert reaction")
	}
	return &apiv2pb.UpsertMemoReactionResponse{
		Reaction: reactionMessage,
	}, nil
}

func (s *APIV2Service) DeleteMemoReaction(ctx context.Context, request *apiv2pb.DeleteMemoReactionRequest) (*apiv2pb.DeleteMemoReactionResponse, error) {
	if err := s.Store.DeleteReaction(ctx, &store.DeleteReaction{
		ID: request.Id,
	}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete reaction")
	}

	return &apiv2pb.DeleteMemoReactionResponse{}, nil
}

func (s *APIV2Service) convertReactionFromStore(ctx context.Context, reaction *storepb.Reaction) (*apiv2pb.Reaction, error) {
	creator, err := s.Store.GetUser(ctx, &store.FindUser{
		ID: &reaction.CreatorId,
	})
	if err != nil {
		return nil, err
	}
	return &apiv2pb.Reaction{
		Id:           reaction.Id,
		Creator:      fmt.Sprintf("%s%s", UserNamePrefix, creator.Username),
		ContentId:    reaction.ContentId,
		ReactionType: apiv2pb.Reaction_Type(reaction.ReactionType),
	}, nil
}
