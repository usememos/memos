package v2

import (
	"context"

	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
)

func (s *APIV2Service) GetWorkspaceProfile(_ context.Context, _ *apiv2pb.GetWorkspaceProfileRequest) (*apiv2pb.GetWorkspaceProfileResponse, error) {
	workspaceProfile := &apiv2pb.WorkspaceProfile{
		Version: s.Profile.Version,
		Mode:    s.Profile.Mode,
	}
	return &apiv2pb.GetWorkspaceProfileResponse{
		WorkspaceProfile: workspaceProfile,
	}, nil
}
