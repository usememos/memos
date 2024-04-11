package store

import (
	"context"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"

	storepb "github.com/usememos/memos/proto/gen/store"
)

type WorkspaceSetting struct {
	Name        string
	Value       string
	Description string
}

type FindWorkspaceSetting struct {
	Name string
}

type DeleteWorkspaceSetting struct {
	Name string
}

func (s *Store) UpsertWorkspaceSetting(ctx context.Context, upsert *WorkspaceSetting) (*WorkspaceSetting, error) {
	return s.driver.UpsertWorkspaceSetting(ctx, upsert)
}

func (s *Store) ListWorkspaceSettings(ctx context.Context, find *FindWorkspaceSetting) ([]*WorkspaceSetting, error) {
	list, err := s.driver.ListWorkspaceSettings(ctx, find)
	if err != nil {
		return nil, err
	}

	for _, systemSettingMessage := range list {
		s.workspaceSettingCache.Store(systemSettingMessage.Name, systemSettingMessage)
	}
	return list, nil
}

func (s *Store) GetWorkspaceSetting(ctx context.Context, find *FindWorkspaceSetting) (*WorkspaceSetting, error) {
	if find.Name != "" {
		if cache, ok := s.workspaceSettingCache.Load(find.Name); ok {
			return cache.(*WorkspaceSetting), nil
		}
	}

	list, err := s.ListWorkspaceSettings(ctx, find)
	if err != nil {
		return nil, err
	}

	if len(list) == 0 {
		return nil, nil
	}

	systemSettingMessage := list[0]
	s.workspaceSettingCache.Store(systemSettingMessage.Name, systemSettingMessage)
	return systemSettingMessage, nil
}

func (s *Store) DeleteWorkspaceSetting(ctx context.Context, delete *DeleteWorkspaceSetting) error {
	err := s.driver.DeleteWorkspaceSetting(ctx, delete)
	if err != nil {
		return errors.Wrap(err, "Failed to delete workspace setting")
	}
	s.workspaceSettingCache.Delete(delete.Name)
	return nil
}

func (s *Store) UpsertWorkspaceSettingV1(ctx context.Context, upsert *storepb.WorkspaceSetting) (*storepb.WorkspaceSetting, error) {
	workspaceSettingRaw := &WorkspaceSetting{
		Name: upsert.Key.String(),
	}
	var valueBytes []byte
	var err error
	if upsert.Key == storepb.WorkspaceSettingKey_WORKSPACE_SETTING_BASIC {
		valueBytes, err = protojson.Marshal(upsert.GetBasicSetting())
	} else if upsert.Key == storepb.WorkspaceSettingKey_WORKSPACE_SETTING_GENERAL {
		valueBytes, err = protojson.Marshal(upsert.GetGeneralSetting())
	} else if upsert.Key == storepb.WorkspaceSettingKey_WORKSPACE_SETTING_STORAGE {
		valueBytes, err = protojson.Marshal(upsert.GetStorageSetting())
	} else if upsert.Key == storepb.WorkspaceSettingKey_WORKSPACE_SETTING_MEMO_RELATED {
		valueBytes, err = protojson.Marshal(upsert.GetMemoRelatedSetting())
	} else if upsert.Key == storepb.WorkspaceSettingKey_WORKSPACE_SETTING_TELEGRAM_INTEGRATION {
		valueBytes, err = protojson.Marshal(upsert.GetTelegramIntegrationSetting())
	} else {
		return nil, errors.Errorf("unsupported workspace setting key: %v", upsert.Key)
	}
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal workspace setting value")
	}
	valueString := string(valueBytes)
	workspaceSettingRaw.Value = valueString
	workspaceSettingRaw, err = s.driver.UpsertWorkspaceSetting(ctx, workspaceSettingRaw)
	if err != nil {
		return nil, errors.Wrap(err, "Failed to upsert workspace setting")
	}
	workspaceSetting, err := convertWorkspaceSettingFromRaw(workspaceSettingRaw)
	if err != nil {
		return nil, errors.Wrap(err, "Failed to convert workspace setting")
	}
	s.workspaceSettingV1Cache.Store(workspaceSetting.Key.String(), workspaceSetting)
	return workspaceSetting, nil
}

func (s *Store) ListWorkspaceSettingsV1(ctx context.Context, find *FindWorkspaceSetting) ([]*storepb.WorkspaceSetting, error) {
	list, err := s.driver.ListWorkspaceSettings(ctx, find)
	if err != nil {
		return nil, err
	}

	workspaceSettings := []*storepb.WorkspaceSetting{}
	for _, workspaceSettingRaw := range list {
		workspaceSetting, err := convertWorkspaceSettingFromRaw(workspaceSettingRaw)
		if err != nil {
			return nil, errors.Wrap(err, "Failed to convert workspace setting")
		}
		s.workspaceSettingV1Cache.Store(workspaceSetting.Key.String(), workspaceSetting)
		workspaceSettings = append(workspaceSettings, workspaceSetting)
	}
	return workspaceSettings, nil
}

func (s *Store) GetWorkspaceSettingV1(ctx context.Context, find *FindWorkspaceSetting) (*storepb.WorkspaceSetting, error) {
	if cache, ok := s.workspaceSettingV1Cache.Load(find.Name); ok {
		return cache.(*storepb.WorkspaceSetting), nil
	}

	list, err := s.ListWorkspaceSettingsV1(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}
	if len(list) > 1 {
		return nil, errors.Errorf("Found multiple workspace settings with key %s", find.Name)
	}
	return list[0], nil
}

func (s *Store) GetWorkspaceBasicSetting(ctx context.Context) (*storepb.WorkspaceBasicSetting, error) {
	workspaceSetting, err := s.GetWorkspaceSettingV1(ctx, &FindWorkspaceSetting{
		Name: storepb.WorkspaceSettingKey_WORKSPACE_SETTING_BASIC.String(),
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get workspace basic setting")
	}

	workspaceBasicSetting := &storepb.WorkspaceBasicSetting{}
	if workspaceSetting != nil {
		workspaceBasicSetting = workspaceSetting.GetBasicSetting()
	}
	return workspaceBasicSetting, nil
}

func (s *Store) GetWorkspaceGeneralSetting(ctx context.Context) (*storepb.WorkspaceGeneralSetting, error) {
	workspaceSetting, err := s.GetWorkspaceSettingV1(ctx, &FindWorkspaceSetting{
		Name: storepb.WorkspaceSettingKey_WORKSPACE_SETTING_GENERAL.String(),
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get workspace general setting")
	}

	workspaceGeneralSetting := &storepb.WorkspaceGeneralSetting{}
	if workspaceSetting != nil {
		workspaceGeneralSetting = workspaceSetting.GetGeneralSetting()
	}
	return workspaceGeneralSetting, nil
}

func (s *Store) GetWorkspaceMemoRelatedSetting(ctx context.Context) (*storepb.WorkspaceMemoRelatedSetting, error) {
	workspaceSetting, err := s.GetWorkspaceSettingV1(ctx, &FindWorkspaceSetting{
		Name: storepb.WorkspaceSettingKey_WORKSPACE_SETTING_MEMO_RELATED.String(),
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get workspace general setting")
	}

	workspaceMemoRelatedSetting := &storepb.WorkspaceMemoRelatedSetting{}
	if workspaceSetting != nil {
		workspaceMemoRelatedSetting = workspaceSetting.GetMemoRelatedSetting()
	}
	return workspaceMemoRelatedSetting, nil
}

func (s *Store) GetWorkspaceStorageSetting(ctx context.Context) (*storepb.WorkspaceStorageSetting, error) {
	workspaceSetting, err := s.GetWorkspaceSettingV1(ctx, &FindWorkspaceSetting{
		Name: storepb.WorkspaceSettingKey_WORKSPACE_SETTING_STORAGE.String(),
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get workspace storage setting")
	}

	workspaceStorageSetting := &storepb.WorkspaceStorageSetting{}
	if workspaceSetting != nil {
		workspaceStorageSetting = workspaceSetting.GetStorageSetting()
	}
	return workspaceStorageSetting, nil
}

func convertWorkspaceSettingFromRaw(workspaceSettingRaw *WorkspaceSetting) (*storepb.WorkspaceSetting, error) {
	workspaceSetting := &storepb.WorkspaceSetting{
		Key: storepb.WorkspaceSettingKey(storepb.WorkspaceSettingKey_value[workspaceSettingRaw.Name]),
	}
	switch workspaceSettingRaw.Name {
	case storepb.WorkspaceSettingKey_WORKSPACE_SETTING_BASIC.String():
		basicSetting := &storepb.WorkspaceBasicSetting{}
		if err := protojson.Unmarshal([]byte(workspaceSettingRaw.Value), basicSetting); err != nil {
			return nil, err
		}
		workspaceSetting.Value = &storepb.WorkspaceSetting_BasicSetting{BasicSetting: basicSetting}
	case storepb.WorkspaceSettingKey_WORKSPACE_SETTING_GENERAL.String():
		generalSetting := &storepb.WorkspaceGeneralSetting{}
		if err := protojson.Unmarshal([]byte(workspaceSettingRaw.Value), generalSetting); err != nil {
			return nil, err
		}
		workspaceSetting.Value = &storepb.WorkspaceSetting_GeneralSetting{GeneralSetting: generalSetting}
	case storepb.WorkspaceSettingKey_WORKSPACE_SETTING_STORAGE.String():
		storageSetting := &storepb.WorkspaceStorageSetting{}
		if err := protojson.Unmarshal([]byte(workspaceSettingRaw.Value), storageSetting); err != nil {
			return nil, err
		}
		workspaceSetting.Value = &storepb.WorkspaceSetting_StorageSetting{StorageSetting: storageSetting}
	case storepb.WorkspaceSettingKey_WORKSPACE_SETTING_MEMO_RELATED.String():
		memoRelatedSetting := &storepb.WorkspaceMemoRelatedSetting{}
		if err := protojson.Unmarshal([]byte(workspaceSettingRaw.Value), memoRelatedSetting); err != nil {
			return nil, err
		}
		workspaceSetting.Value = &storepb.WorkspaceSetting_MemoRelatedSetting{MemoRelatedSetting: memoRelatedSetting}
	case storepb.WorkspaceSettingKey_WORKSPACE_SETTING_TELEGRAM_INTEGRATION.String():
		telegramIntegrationSetting := &storepb.WorkspaceTelegramIntegrationSetting{}
		if err := protojson.Unmarshal([]byte(workspaceSettingRaw.Value), telegramIntegrationSetting); err != nil {
			return nil, err
		}
		workspaceSetting.Value = &storepb.WorkspaceSetting_TelegramIntegrationSetting{TelegramIntegrationSetting: telegramIntegrationSetting}
	default:
		return nil, errors.Errorf("unsupported workspace setting key: %v", workspaceSettingRaw.Name)
	}
	return workspaceSetting, nil
}
