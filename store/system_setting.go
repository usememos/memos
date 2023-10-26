package store

import (
	"context"
)

type SystemSetting struct {
	Name        string
	Value       string
	Description string
}

type FindSystemSetting struct {
	Name string
}

func (s *Store) UpsertSystemSetting(ctx context.Context, upsert *SystemSetting) (*SystemSetting, error) {
	return s.driver.UpsertSystemSetting(ctx, upsert)
}

func (s *Store) ListSystemSettings(ctx context.Context, find *FindSystemSetting) ([]*SystemSetting, error) {
	list, err := s.driver.ListSystemSettings(ctx, find)
	if err != nil {
		return nil, err
	}

	for _, systemSettingMessage := range list {
		s.systemSettingCache.Store(systemSettingMessage.Name, systemSettingMessage)
	}
	return list, nil
}

func (s *Store) GetSystemSetting(ctx context.Context, find *FindSystemSetting) (*SystemSetting, error) {
	if find.Name != "" {
		if cache, ok := s.systemSettingCache.Load(find.Name); ok {
			return cache.(*SystemSetting), nil
		}
	}

	list, err := s.ListSystemSettings(ctx, find)
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

func (s *Store) GetSystemSettingValueWithDefault(ctx context.Context, settingName string, defaultValue string) string {
	if setting, err := s.GetSystemSetting(ctx, &FindSystemSetting{
		Name: settingName,
	}); err == nil && setting != nil {
		return setting.Value
	}
	return defaultValue
}
