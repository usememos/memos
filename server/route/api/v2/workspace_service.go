package v2

import (
	"context"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	"github.com/usememos/memos/store"
)

var ownerCache *apiv2pb.User

func (s *APIV2Service) GetWorkspaceProfile(ctx context.Context, _ *apiv2pb.GetWorkspaceProfileRequest) (*apiv2pb.GetWorkspaceProfileResponse, error) {
	workspaceProfile := &apiv2pb.WorkspaceProfile{
		Version: s.Profile.Version,
		Mode:    s.Profile.Mode,
	}
	owner, err := s.GetInstanceOwner(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get instance owner: %v", err)
	}
	if owner != nil {
		workspaceProfile.Owner = owner.Name
	}
	return &apiv2pb.GetWorkspaceProfileResponse{
		WorkspaceProfile: workspaceProfile,
	}, nil
}

func (s *APIV2Service) GetInstanceOwner(ctx context.Context) (*apiv2pb.User, error) {
	if ownerCache != nil {
		return ownerCache, nil
	}

	hostUserType := store.RoleHost
	user, err := s.Store.GetUser(ctx, &store.FindUser{
		Role: &hostUserType,
	})
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find owner")
	}
	if user == nil {
		return nil, nil
	}

	ownerCache = convertUserFromStore(user)
	return ownerCache, nil
}
