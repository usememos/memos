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

func (s *APIV2Service) ListWorkspaceSettings(ctx context.Context, _ *apiv2pb.ListWorkspaceSettingsRequest) (*apiv2pb.ListWorkspaceSettingsResponse, error) {
	workspaceSettings, err := s.Store.ListWorkspaceSettingsV1(ctx, &store.FindWorkspaceSetting{})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get workspace setting: %v", err)
	}

	response := &apiv2pb.ListWorkspaceSettingsResponse{
		Settings: []*apiv2pb.WorkspaceSetting{},
	}
	for _, workspaceSetting := range workspaceSettings {
		if workspaceSetting.Key == storepb.WorkspaceSettingKey_WORKSPACE_SETTING_BASIC {
			continue
		}
		response.Settings = append(response.Settings, convertWorkspaceSettingFromStore(workspaceSetting))
	}
	return response, nil
}

func (s *APIV2Service) GetWorkspaceSetting(ctx context.Context, request *apiv2pb.GetWorkspaceSettingRequest) (*apiv2pb.GetWorkspaceSettingResponse, error) {
	settingKeyString, err := ExtractWorkspaceSettingKeyFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid workspace setting name: %v", err)
	}
	settingKey := storepb.WorkspaceSettingKey(storepb.WorkspaceSettingKey_value[settingKeyString])
	workspaceSetting, err := s.Store.GetWorkspaceSettingV1(ctx, &store.FindWorkspaceSetting{
		Name: settingKey.String(),
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
	if s.Profile.Mode == "demo" {
		return nil, status.Errorf(codes.InvalidArgument, "setting workspace setting is not allowed in demo mode")
	}

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
	workspaceSetting := &apiv2pb.WorkspaceSetting{
		Name: fmt.Sprintf("%s%s", WorkspaceSettingNamePrefix, setting.Key.String()),
	}
	switch setting.Value.(type) {
	case *storepb.WorkspaceSetting_GeneralSetting:
		workspaceSetting.Value = &apiv2pb.WorkspaceSetting_GeneralSetting{
			GeneralSetting: convertWorkspaceGeneralSettingFromStore(setting.GetGeneralSetting()),
		}
	case *storepb.WorkspaceSetting_StorageSetting:
		workspaceSetting.Value = &apiv2pb.WorkspaceSetting_StorageSetting{
			StorageSetting: convertWorkspaceStorageSettingFromStore(setting.GetStorageSetting()),
		}
	case *storepb.WorkspaceSetting_MemoRelatedSetting:
		workspaceSetting.Value = &apiv2pb.WorkspaceSetting_MemoRelatedSetting{
			MemoRelatedSetting: convertWorkspaceMemoRelatedSettingFromStore(setting.GetMemoRelatedSetting()),
		}
	case *storepb.WorkspaceSetting_TelegramIntegrationSetting:
		workspaceSetting.Value = &apiv2pb.WorkspaceSetting_TelegramIntegrationSetting{
			TelegramIntegrationSetting: convertWorkspaceTelegramIntegrationSettingFromStore(setting.GetTelegramIntegrationSetting()),
		}
	}
	return workspaceSetting
}

func convertWorkspaceSettingToStore(setting *apiv2pb.WorkspaceSetting) *storepb.WorkspaceSetting {
	settingKeyString, _ := ExtractWorkspaceSettingKeyFromName(setting.Name)
	workspaceSetting := &storepb.WorkspaceSetting{
		Key: storepb.WorkspaceSettingKey(storepb.WorkspaceSettingKey_value[settingKeyString]),
		Value: &storepb.WorkspaceSetting_GeneralSetting{
			GeneralSetting: convertWorkspaceGeneralSettingToStore(setting.GetGeneralSetting()),
		},
	}
	switch workspaceSetting.Key {
	case storepb.WorkspaceSettingKey_WORKSPACE_SETTING_GENERAL:
		workspaceSetting.Value = &storepb.WorkspaceSetting_GeneralSetting{
			GeneralSetting: convertWorkspaceGeneralSettingToStore(setting.GetGeneralSetting()),
		}
	case storepb.WorkspaceSettingKey_WORKSPACE_SETTING_STORAGE:
		workspaceSetting.Value = &storepb.WorkspaceSetting_StorageSetting{
			StorageSetting: convertWorkspaceStorageSettingToStore(setting.GetStorageSetting()),
		}
	case storepb.WorkspaceSettingKey_WORKSPACE_SETTING_MEMO_RELATED:
		workspaceSetting.Value = &storepb.WorkspaceSetting_MemoRelatedSetting{
			MemoRelatedSetting: convertWorkspaceMemoRelatedSettingToStore(setting.GetMemoRelatedSetting()),
		}
	case storepb.WorkspaceSettingKey_WORKSPACE_SETTING_TELEGRAM_INTEGRATION:
		workspaceSetting.Value = &storepb.WorkspaceSetting_TelegramIntegrationSetting{
			TelegramIntegrationSetting: convertWorkspaceTelegramIntegrationSettingToStore(setting.GetTelegramIntegrationSetting()),
		}
	}
	return workspaceSetting
}

func convertWorkspaceGeneralSettingFromStore(setting *storepb.WorkspaceGeneralSetting) *apiv2pb.WorkspaceGeneralSetting {
	if setting == nil {
		return nil
	}
	generalSetting := &apiv2pb.WorkspaceGeneralSetting{
		InstanceUrl:           setting.InstanceUrl,
		DisallowSignup:        setting.DisallowSignup,
		DisallowPasswordLogin: setting.DisallowPasswordLogin,
		AdditionalScript:      setting.AdditionalScript,
		AdditionalStyle:       setting.AdditionalStyle,
	}
	if setting.CustomProfile != nil {
		generalSetting.CustomProfile = &apiv2pb.WorkspaceCustomProfile{
			Title:       setting.CustomProfile.Title,
			Description: setting.CustomProfile.Description,
			LogoUrl:     setting.CustomProfile.LogoUrl,
			Locale:      setting.CustomProfile.Locale,
			Appearance:  setting.CustomProfile.Appearance,
		}
	}
	return generalSetting
}

func convertWorkspaceGeneralSettingToStore(setting *apiv2pb.WorkspaceGeneralSetting) *storepb.WorkspaceGeneralSetting {
	if setting == nil {
		return nil
	}
	generalSetting := &storepb.WorkspaceGeneralSetting{
		InstanceUrl:           setting.InstanceUrl,
		DisallowSignup:        setting.DisallowSignup,
		DisallowPasswordLogin: setting.DisallowPasswordLogin,
		AdditionalScript:      setting.AdditionalScript,
		AdditionalStyle:       setting.AdditionalStyle,
	}
	if setting.CustomProfile != nil {
		generalSetting.CustomProfile = &storepb.WorkspaceCustomProfile{
			Title:       setting.CustomProfile.Title,
			Description: setting.CustomProfile.Description,
			LogoUrl:     setting.CustomProfile.LogoUrl,
			Locale:      setting.CustomProfile.Locale,
			Appearance:  setting.CustomProfile.Appearance,
		}
	}
	return generalSetting
}

func convertWorkspaceStorageSettingFromStore(setting *storepb.WorkspaceStorageSetting) *apiv2pb.WorkspaceStorageSetting {
	if setting == nil {
		return nil
	}
	return &apiv2pb.WorkspaceStorageSetting{
		StorageType:       apiv2pb.WorkspaceStorageSetting_StorageType(setting.StorageType),
		LocalStoragePath:  setting.LocalStoragePath,
		UploadSizeLimitMb: setting.UploadSizeLimitMb,
	}
}

func convertWorkspaceStorageSettingToStore(setting *apiv2pb.WorkspaceStorageSetting) *storepb.WorkspaceStorageSetting {
	if setting == nil {
		return nil
	}
	return &storepb.WorkspaceStorageSetting{
		StorageType:       storepb.WorkspaceStorageSetting_StorageType(setting.StorageType),
		LocalStoragePath:  setting.LocalStoragePath,
		UploadSizeLimitMb: setting.UploadSizeLimitMb,
	}
}

func convertWorkspaceMemoRelatedSettingFromStore(setting *storepb.WorkspaceMemoRelatedSetting) *apiv2pb.WorkspaceMemoRelatedSetting {
	if setting == nil {
		return nil
	}
	return &apiv2pb.WorkspaceMemoRelatedSetting{
		DisallowPublicVisible: setting.DisallowPublicVisible,
		DisplayWithUpdateTime: setting.DisplayWithUpdateTime,
	}
}

func convertWorkspaceMemoRelatedSettingToStore(setting *apiv2pb.WorkspaceMemoRelatedSetting) *storepb.WorkspaceMemoRelatedSetting {
	if setting == nil {
		return nil
	}
	return &storepb.WorkspaceMemoRelatedSetting{
		DisallowPublicVisible: setting.DisallowPublicVisible,
		DisplayWithUpdateTime: setting.DisplayWithUpdateTime,
	}
}

func convertWorkspaceTelegramIntegrationSettingFromStore(setting *storepb.WorkspaceTelegramIntegrationSetting) *apiv2pb.WorkspaceTelegramIntegrationSetting {
	if setting == nil {
		return nil
	}
	return &apiv2pb.WorkspaceTelegramIntegrationSetting{
		BotToken: setting.BotToken,
	}
}

func convertWorkspaceTelegramIntegrationSettingToStore(setting *apiv2pb.WorkspaceTelegramIntegrationSetting) *storepb.WorkspaceTelegramIntegrationSetting {
	if setting == nil {
		return nil
	}
	return &storepb.WorkspaceTelegramIntegrationSetting{
		BotToken: setting.BotToken,
	}
}
