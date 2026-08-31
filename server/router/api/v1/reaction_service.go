package v1

import (
	"context"
	stderrors "errors"
	"log/slog"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) ListMemoReactions(ctx context.Context, request *v1pb.ListMemoReactionsRequest) (*v1pb.ListMemoReactionsResponse, error) {
	// Extract memo UID and check visibility.
	memoUID, err := ExtractMemoUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
	}
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get memo: %v", err)
	}
	if memo == nil {
		return nil, status.Errorf(codes.NotFound, "memo not found")
	}

	if err := s.checkMemoReadAccess(ctx, memo); err != nil {
		return nil, err
	}

	reactions, err := s.Store.ListReactions(ctx, &store.FindReaction{
		MemoID: &memo.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list reactions")
	}

	response := &v1pb.ListMemoReactionsResponse{
		Reactions: []*v1pb.Reaction{},
	}
	response.Reactions, err = s.convertReactionsFromStoreWithCreators(ctx, reactions, nil, buildMemoName(memo.UID))
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to convert reactions")
	}
	return response, nil
}

func (s *APIV1Service) UpsertMemoReaction(ctx context.Context, request *v1pb.UpsertMemoReactionRequest) (*v1pb.Reaction, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if request.GetReaction() == nil {
		return nil, status.Error(codes.InvalidArgument, "reaction is required")
	}

	// Extract memo UID and check visibility before allowing reaction.
	memoUID, err := ExtractMemoUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
	}
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get memo: %v", err)
	}
	if memo == nil {
		return nil, status.Errorf(codes.NotFound, "memo not found")
	}

	if err := s.checkMemoReadAccess(ctx, memo); err != nil {
		return nil, err
	}
	reaction, err := s.Store.UpsertReaction(ctx, &store.Reaction{
		CreatorID:    user.ID,
		MemoID:       memo.ID,
		ReactionType: request.Reaction.ReactionType,
		Policy:       reactionWritePolicy(user.ID),
	})
	if err != nil {
		return nil, mapReactionMutationError(err, "failed to upsert reaction")
	}

	memoName := buildMemoName(memo.UID)
	reactionMessage, err := s.convertReactionFromStore(ctx, reaction, memoName)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to convert reaction")
	}

	s.SSEHub.publishMemoChanged()

	return reactionMessage, nil
}

func (s *APIV1Service) DeleteMemoReaction(ctx context.Context, request *v1pb.DeleteMemoReactionRequest) (*emptypb.Empty, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	memoUID, reactionID, err := ExtractMemoReactionIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid reaction name: %v", err)
	}

	// Get reaction and check ownership.
	reaction, err := s.Store.GetReaction(ctx, &store.FindReaction{
		ID: &reactionID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get reaction")
	}
	if reaction == nil {
		// Return permission denied to avoid revealing if reaction exists.
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	if reaction.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{ID: &reaction.MemoID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get memo")
	}
	if memo == nil || memo.UID != memoUID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	if err := s.Store.DeleteReaction(ctx, &store.DeleteReaction{
		ID:          &reactionID,
		MemoID:      &reaction.MemoID,
		ActorUserID: &user.ID,
		Policy:      reactionWritePolicy(user.ID),
	}); err != nil {
		return nil, mapReactionMutationError(err, "failed to delete reaction")
	}

	s.SSEHub.publishMemoChanged()

	return &emptypb.Empty{}, nil
}

func reactionWritePolicy(actorUserID int32) *store.ReactionWritePolicy {
	return &store.ReactionWritePolicy{ActorUserID: actorUserID}
}

func mapReactionMutationError(err error, operation string) error {
	switch {
	case stderrors.Is(err, store.ErrReactionMemoNotFound):
		return status.Error(codes.NotFound, "memo not found")
	case stderrors.Is(err, store.ErrReactionPermissionDenied):
		return status.Error(codes.PermissionDenied, "permission denied")
	default:
		return mapMemoWriteError(err, operation)
	}
}

func (s *APIV1Service) convertReactionFromStore(ctx context.Context, reaction *store.Reaction, memoName string) (*v1pb.Reaction, error) {
	creatorsByID, err := s.listUsersByIDWithExisting(ctx, []int32{reaction.CreatorID}, nil)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get reaction creator")
	}
	reactionMessage, err := convertReactionFromStoreWithCreators(reaction, creatorsByID, memoName)
	if err != nil {
		slog.Warn("Failed to convert reaction with missing creator",
			slog.Int64("reaction_id", int64(reaction.ID)),
			slog.Int64("creator_id", int64(reaction.CreatorID)),
			slog.Int64("memo_id", int64(reaction.MemoID)),
		)
		return nil, status.Errorf(codes.NotFound, "reaction creator not found")
	}
	return reactionMessage, nil
}
