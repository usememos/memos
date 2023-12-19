package v2

import (
	"context"
	"fmt"

	"github.com/pkg/errors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"github.com/usememos/memos/api/auth"
	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
)

func (s *APIV2Service) GetAuthStatus(ctx context.Context, _ *apiv2pb.GetAuthStatusRequest) (*apiv2pb.GetAuthStatusResponse, error) {
	user, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Unauthenticated, "failed to get current user: %v", err)
	}
	if user == nil {
		// Set the cookie header to expire access token.
		if err := clearAccessTokenCookie(ctx); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to set grpc header")
		}
		return nil, status.Errorf(codes.Unauthenticated, "user not found")
	}
	return &apiv2pb.GetAuthStatusResponse{
		User: convertUserFromStore(user),
	}, nil
}

func clearAccessTokenCookie(ctx context.Context) error {
	if err := grpc.SetHeader(ctx, metadata.New(map[string]string{
		"Set-Cookie": fmt.Sprintf("%s=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict", auth.AccessTokenCookieName),
	})); err != nil {
		return errors.Wrap(err, "failed to set grpc header")
	}
	return nil
}
