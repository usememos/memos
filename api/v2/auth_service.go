package v2

import (
	"context"

	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
)

func (s *APIV2Service) GetAuthStatus(ctx context.Context, _ *apiv2pb.GetAuthStatusRequest) (*apiv2pb.GetAuthStatusResponse, error) {
	ok := true
	user, err := getCurrentUser(ctx, s.Store)
	if err != nil || user == nil {
		ok = false
	}
	return &apiv2pb.GetAuthStatusResponse{
		Ok: ok,
	}, nil
}
