package v2

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
)

func (s *APIV2Service) GetAuthStatus(ctx context.Context, _ *apiv2pb.GetAuthStatusRequest) (*apiv2pb.GetAuthStatusResponse, error) {
	user, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Unauthenticated, "failed to get current user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not found")
	}
	return &apiv2pb.GetAuthStatusResponse{
		User: convertUserFromStore(user),
	}, nil
}
