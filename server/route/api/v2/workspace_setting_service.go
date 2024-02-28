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

func (s *APIV2Service) GetWorkspaceSetting(ctx context.Context, request *apiv2pb.GetWorkspaceSettingRequest) (*apiv2pb.GetWorkspaceSettingResponse, error) {
	settingKeyString, err := ExtractWorkspaceSettingKeyFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid workspace setting name: %v", err)
	}
	settingKey := storepb.WorkspaceSettingKey(storepb.WorkspaceSettingKey_value[settingKeyString])
	workspaceSetting, err := s.Store.GetWorkspaceSettingV1(ctx, &store.FindWorkspaceSettingV1{
		Key: settingKey,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get workspace setting: %v", err)
	}
	if workspaceSetting == nil {
		return nil, status.Errorf(codes.NotFound, "workspace setting not found")
	}

	return &apiv2pb.GetWorkspaceSettingResponse{
		Setting: convertWorkspaceSettingFromStore(workspaceSetting),
	}, nil
}

func (s *APIV2Service) SetWorkspaceSetting(ctx context.Context, request *apiv2pb.SetWorkspaceSettingRequest) (*apiv2pb.SetWorkspaceSettingResponse, error) {
	user, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if user.Role != store.RoleHost {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	if _, err := s.Store.UpsertWorkspaceSettingV1(ctx, convertWorkspaceSettingToStore(request.Setting)); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to upsert workspace setting: %v", err)
	}

	return &apiv2pb.SetWorkspaceSettingResponse{}, nil
}

func convertWorkspaceSettingFromStore(setting *storepb.WorkspaceSetting) *apiv2pb.WorkspaceSetting {
	return &apiv2pb.WorkspaceSetting{
		Name: fmt.Sprintf("%s%s", WorkspaceSettingNamePrefix, setting.Key.String()),
		Value: &apiv2pb.WorkspaceSetting_GeneralSetting{
			GeneralSetting: convertWorkspaceGeneralSettingFromStore(setting.GetGeneral()),
		},
	}
}

func convertWorkspaceSettingToStore(setting *apiv2pb.WorkspaceSetting) *storepb.WorkspaceSetting {
	settingKeyString, _ := ExtractWorkspaceSettingKeyFromName(setting.Name)
	return &storepb.WorkspaceSetting{
		Key: storepb.WorkspaceSettingKey(storepb.WorkspaceSettingKey_value[settingKeyString]),
		Value: &storepb.WorkspaceSetting_General{
			General: convertWorkspaceGeneralSettingToStore(setting.GetGeneralSetting()),
		},
	}
}

func convertWorkspaceGeneralSettingFromStore(setting *storepb.WorkspaceGeneralSetting) *apiv2pb.WorkspaceGeneralSetting {
	if setting == nil {
		return nil
	}
	return &apiv2pb.WorkspaceGeneralSetting{
		InstanceUrl:           setting.InstanceUrl,
		DisallowSignup:        setting.DisallowSignup,
		DisallowPasswordLogin: setting.DisallowPasswordLogin,
		AdditionalScript:      setting.AdditionalScript,
		AdditionalStyle:       setting.AdditionalStyle,
	}
}

func convertWorkspaceGeneralSettingToStore(setting *apiv2pb.WorkspaceGeneralSetting) *storepb.WorkspaceGeneralSetting {
	if setting == nil {
		return nil
	}
	return &storepb.WorkspaceGeneralSetting{
		InstanceUrl:           setting.InstanceUrl,
		DisallowSignup:        setting.DisallowSignup,
		DisallowPasswordLogin: setting.DisallowPasswordLogin,
		AdditionalScript:      setting.AdditionalScript,
		AdditionalStyle:       setting.AdditionalStyle,
	}
}
