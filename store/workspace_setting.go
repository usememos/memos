package store

import (
	"context"

	"github.com/pkg/errors"

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

type FindWorkspaceSettingV1 struct {
	Key storepb.WorkspaceSettingKey
}

func (s *Store) UpsertWorkspaceSettingV1(ctx context.Context, upsert *storepb.WorkspaceSetting) (*storepb.WorkspaceSetting, error) {
	workspaceSetting, err := s.driver.UpsertWorkspaceSettingV1(ctx, upsert)
	if err != nil {
		return nil, errors.Wrap(err, "Failed to upsert workspace setting")
	}
	s.workspaceSettingV1Cache.Store(workspaceSetting.Key.String(), workspaceSetting)
	return workspaceSetting, nil
}

func (s *Store) ListWorkspaceSettingsV1(ctx context.Context, find *FindWorkspaceSettingV1) ([]*storepb.WorkspaceSetting, error) {
	list, err := s.driver.ListWorkspaceSettingsV1(ctx, find)
	if err != nil {
		return nil, err
	}

	for _, workspaceSetting := range list {
		s.workspaceSettingV1Cache.Store(workspaceSetting.Key.String(), workspaceSetting)
	}
	return list, nil
}

func (s *Store) GetWorkspaceSettingV1(ctx context.Context, find *FindWorkspaceSettingV1) (*storepb.WorkspaceSetting, error) {
	if find.Key != storepb.WorkspaceSettingKey_WORKSPACE_SETTING_KEY_UNSPECIFIED {
		if cache, ok := s.workspaceSettingV1Cache.Load(find.Key.String()); ok {
			return cache.(*storepb.WorkspaceSetting), nil
		}
	}

	list, err := s.ListWorkspaceSettingsV1(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}

	workspaceSetting := list[0]
	s.workspaceSettingV1Cache.Store(workspaceSetting.Key.String(), workspaceSetting)
	return workspaceSetting, nil
}

func (s *Store) GetWorkspaceGeneralSetting(ctx context.Context) (*storepb.WorkspaceGeneralSetting, error) {
	workspaceSetting, err := s.GetWorkspaceSettingV1(ctx, &FindWorkspaceSettingV1{
		Key: storepb.WorkspaceSettingKey_WORKSPACE_SETTING_GENERAL,
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get workspace setting")
	}

	workspaceGeneralSetting := &storepb.WorkspaceGeneralSetting{}
	if workspaceSetting != nil {
		workspaceGeneralSetting = workspaceSetting.GetGeneral()
	}
	return workspaceGeneralSetting, nil
}
