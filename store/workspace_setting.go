package store

import (
	"context"
)

type WorkspaceSetting struct {
	Name        string
	Value       string
	Description string
}

type FindWorkspaceSetting struct {
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
		s.systemSettingCache.Store(systemSettingMessage.Name, systemSettingMessage)
	}
	return list, nil
}

func (s *Store) GetWorkspaceSetting(ctx context.Context, find *FindWorkspaceSetting) (*WorkspaceSetting, error) {
	if find.Name != "" {
		if cache, ok := s.systemSettingCache.Load(find.Name); ok {
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
	s.systemSettingCache.Store(systemSettingMessage.Name, systemSettingMessage)
	return systemSettingMessage, nil
}

func (s *Store) GetWorkspaceSettingWithDefaultValue(ctx context.Context, settingName string, defaultValue string) string {
	if setting, err := s.GetWorkspaceSetting(ctx, &FindWorkspaceSetting{
		Name: settingName,
	}); err == nil && setting != nil {
		return setting.Value
	}
	return defaultValue
}
