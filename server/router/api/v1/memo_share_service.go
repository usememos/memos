package v1

import (
	"context"
	stderrors "errors"
	"fmt"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/lithammer/shortuuid/v4"
	"github.com/pkg/errors"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

// CreateMemoShare creates an opaque share link for a memo.
// Only the memo's creator or an admin may call this.
func (s *APIV1Service) CreateMemoShare(ctx context.Context, request *v1pb.CreateMemoShareRequest) (*v1pb.MemoShare, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	memoUID, err := ExtractMemoUIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
	}
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get memo")
	}
	if memo == nil {
		return nil, status.Errorf(codes.NotFound, "memo not found")
	}
	if memo.CreatorID != user.ID && !isSuperUser(user) {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	var expiresTs *int64
	if request.MemoShare != nil && request.MemoShare.ExpireTime != nil {
		ts := request.MemoShare.ExpireTime.AsTime().Unix()
		if ts <= time.Now().Unix() {
			return nil, status.Errorf(codes.InvalidArgument, "expire_time must be in the future")
		}
		expiresTs = &ts
	}

	// Generate a URL-safe token using shortuuid (base57-encoded UUID v4, 22 chars, 122-bit entropy).
	ms, err := s.Store.CreateMemoShare(ctx, &store.MemoShare{
		UID:       shortuuid.New(),
		MemoID:    memo.ID,
		CreatorID: user.ID,
		ExpiresTs: expiresTs,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create memo share")
	}

	return convertMemoShareFromStore(ms, memo.UID), nil
}

// ListMemoShares lists all share links for a memo.
// Only the memo's creator or an admin may call this.
func (s *APIV1Service) ListMemoShares(ctx context.Context, request *v1pb.ListMemoSharesRequest) (*v1pb.ListMemoSharesResponse, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	memoUID, err := ExtractMemoUIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
	}
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get memo")
	}
	if memo == nil {
		return nil, status.Errorf(codes.NotFound, "memo not found")
	}
	if memo.CreatorID != user.ID && !isSuperUser(user) {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	shares, err := s.Store.ListMemoShares(ctx, &store.FindMemoShare{MemoID: &memo.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memo shares")
	}

	response := &v1pb.ListMemoSharesResponse{}
	for _, ms := range shares {
		response.MemoShares = append(response.MemoShares, convertMemoShareFromStore(ms, memo.UID))
	}
	return response, nil
}

// DeleteMemoShare revokes a share link.
// Only the memo's creator or an admin may call this.
func (s *APIV1Service) DeleteMemoShare(ctx context.Context, request *v1pb.DeleteMemoShareRequest) (*emptypb.Empty, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	// name format: memos/{memoUID}/shares/{shareToken}
	tokens, err := GetNameParentTokens(request.Name, MemoNamePrefix, MemoShareNamePrefix)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid share name: %v", err)
	}
	memoUID, shareToken := tokens[0], tokens[1]

	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get memo")
	}
	if memo == nil {
		return nil, status.Errorf(codes.NotFound, "memo not found")
	}
	if memo.CreatorID != user.ID && !isSuperUser(user) {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	ms, err := s.Store.GetMemoShare(ctx, &store.FindMemoShare{UID: &shareToken})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get memo share")
	}
	if ms == nil || ms.MemoID != memo.ID {
		return nil, status.Errorf(codes.NotFound, "memo share not found")
	}

	if err := s.Store.DeleteMemoShare(ctx, &store.DeleteMemoShare{UID: &shareToken}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete memo share")
	}
	return &emptypb.Empty{}, nil
}

// GetMemoByShare resolves a share token to its memo. No authentication required.
// Returns NOT_FOUND for invalid or expired tokens (no information leakage).
func (s *APIV1Service) GetMemoByShare(ctx context.Context, request *v1pb.GetMemoByShareRequest) (*v1pb.Memo, error) {
	ms, err := s.getActiveMemoShare(ctx, request.ShareId)
	if err != nil {
		return nil, err
	}

	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{ID: &ms.MemoID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get memo")
	}
	// Treat archived or missing memos the same as an invalid token — no information leakage.
	if memo == nil || memo.RowStatus == store.Archived {
		return nil, status.Errorf(codes.NotFound, "not found")
	}

	reactions, err := s.Store.ListReactions(ctx, &store.FindReaction{
		ContentID: stringPointer(fmt.Sprintf("%s%s", MemoNamePrefix, memo.UID)),
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list reactions")
	}

	attachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{MemoID: &memo.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list attachments")
	}
	relations, err := s.batchConvertMemoRelations(ctx, []*store.Memo{memo}, true)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to load memo relations")
	}

	memoMessage, err := s.convertMemoFromStore(ctx, memo, reactions, attachments, relations[memo.ID])
	if err != nil {
		if stderrors.Is(err, errMemoCreatorNotFound) {
			return nil, status.Errorf(codes.NotFound, "not found")
		}
		return nil, errors.Wrap(err, "failed to convert memo")
	}
	return memoMessage, nil
}

// isMemoShareExpired returns true if the share has a defined expiry that has already passed.
func isMemoShareExpired(ms *store.MemoShare) bool {
	return ms.ExpiresTs != nil && time.Now().Unix() > *ms.ExpiresTs
}

func (s *APIV1Service) getActiveMemoShare(ctx context.Context, shareID string) (*store.MemoShare, error) {
	ms, err := s.Store.GetMemoShare(ctx, &store.FindMemoShare{UID: &shareID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get memo share")
	}
	if ms == nil || isMemoShareExpired(ms) {
		return nil, status.Errorf(codes.NotFound, "not found")
	}
	return ms, nil
}

func stringPointer(s string) *string {
	return &s
}

// convertMemoShareFromStore converts a store MemoShare to the proto MemoShare message.
// name format: memos/{memoUID}/shares/{shareToken}.
func convertMemoShareFromStore(ms *store.MemoShare, memoUID string) *v1pb.MemoShare {
	name := fmt.Sprintf("%s%s/%s%s", MemoNamePrefix, memoUID, MemoShareNamePrefix, ms.UID)
	pb := &v1pb.MemoShare{
		Name:       name,
		CreateTime: timestamppb.New(time.Unix(ms.CreatedTs, 0)),
	}
	if ms.ExpiresTs != nil {
		pb.ExpireTime = timestamppb.New(time.Unix(*ms.ExpiresTs, 0))
	}
	return pb
}
