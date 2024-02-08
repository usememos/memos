package v2

import (
	"context"
	"strconv"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	"github.com/pkg/errors"

	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (s *APIV2Service) GetWorkspaceProfile(_ context.Context, _ *apiv2pb.GetWorkspaceProfileRequest) (*apiv2pb.GetWorkspaceProfileResponse, error) {
	workspaceProfile := &apiv2pb.WorkspaceProfile{
		Version: s.Profile.Version,
		Mode:    s.Profile.Mode,
	}
	response := &apiv2pb.GetWorkspaceProfileResponse{
		WorkspaceProfile: workspaceProfile,
	}
	return response, nil
}

func (s *APIV2Service) UpdateWorkspaceProfile(ctx context.Context, request *apiv2pb.UpdateWorkspaceProfileRequest) (*apiv2pb.UpdateWorkspaceProfileResponse, error) {
	user, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if user.Role != store.RoleHost {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is required")
	}

	// Update system settings.
	for _, field := range request.UpdateMask.Paths {
		if field == "allow_registration" {
			_, err := s.Store.UpsertWorkspaceSetting(ctx, &store.WorkspaceSetting{
				Name:  "allow-signup",
				Value: strconv.FormatBool(request.WorkspaceProfile.AllowRegistration),
			})
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to update allow_registration system setting: %v", err)
			}
		} else if field == "disable_password_login" {
			if s.Profile.Mode == "demo" {
				return nil, status.Errorf(codes.PermissionDenied, "disabling password login is not allowed in demo mode")
			}
			_, err := s.Store.UpsertWorkspaceSetting(ctx, &store.WorkspaceSetting{
				Name:  "disable-password-login",
				Value: strconv.FormatBool(request.WorkspaceProfile.DisablePasswordLogin),
			})
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to update disable_password_login system setting: %v", err)
			}
		} else if field == "additional_script" {
			if s.Profile.Mode == "demo" {
				return nil, status.Errorf(codes.PermissionDenied, "additional script is not allowed in demo mode")
			}
			_, err := s.Store.UpsertWorkspaceSetting(ctx, &store.WorkspaceSetting{
				Name:  "additional-script",
				Value: request.WorkspaceProfile.AdditionalScript,
			})
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to update additional_script system setting: %v", err)
			}
		} else if field == "additional_style" {
			if s.Profile.Mode == "demo" {
				return nil, status.Errorf(codes.PermissionDenied, "additional style is not allowed in demo mode")
			}
			_, err := s.Store.UpsertWorkspaceSetting(ctx, &store.WorkspaceSetting{
				Name:  "additional-style",
				Value: request.WorkspaceProfile.AdditionalStyle,
			})
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to update additional_style system setting: %v", err)
			}
		}
	}

	workspaceProfileMessage, err := s.GetWorkspaceProfile(ctx, &apiv2pb.GetWorkspaceProfileRequest{})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get system info: %v", err)
	}
	return &apiv2pb.UpdateWorkspaceProfileResponse{
		WorkspaceProfile: workspaceProfileMessage.WorkspaceProfile,
	}, nil
}

func (s *APIV2Service) GetWorkspaceGeneralSetting(ctx context.Context) (*storepb.WorkspaceGeneralSetting, error) {
	workspaceSetting, err := s.Store.GetWorkspaceSetting(ctx, &store.FindWorkspaceSetting{
		Name: storepb.WorkspaceSettingKey_WORKSPACE_SETTING_GENERAL.String(),
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get workspace setting")
	}
	workspaceGeneralSetting := &storepb.WorkspaceGeneralSetting{}
	if workspaceSetting != nil {
		if err := proto.Unmarshal([]byte(workspaceSetting.Value), workspaceGeneralSetting); err != nil {
			return nil, errors.Wrap(err, "failed to unmarshal workspace setting")
		}
	}
	return workspaceGeneralSetting, nil
}
