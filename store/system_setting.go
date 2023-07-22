package store

import (
	"context"
	"strings"
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
	stmt := `
		INSERT INTO system_setting (
			name, value, description
		)
		VALUES (?, ?, ?)
		ON CONFLICT(name) DO UPDATE 
		SET
			value = EXCLUDED.value,
			description = EXCLUDED.description
	`
	if _, err := s.db.ExecContext(ctx, stmt, upsert.Name, upsert.Value, upsert.Description); err != nil {
		return nil, err
	}

	systemSetting := upsert
	return systemSetting, nil
}

func (s *Store) ListSystemSettings(ctx context.Context, find *FindSystemSetting) ([]*SystemSetting, error) {
	where, args := []string{"1 = 1"}, []any{}
	if find.Name != "" {
		where, args = append(where, "name = ?"), append(args, find.Name)
	}

	query := `
		SELECT
			name,
			value,
			description
		FROM system_setting
		WHERE ` + strings.Join(where, " AND ")

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []*SystemSetting{}
	for rows.Next() {
		systemSettingMessage := &SystemSetting{}
		if err := rows.Scan(
			&systemSettingMessage.Name,
			&systemSettingMessage.Value,
			&systemSettingMessage.Description,
		); err != nil {
			return nil, err
		}
		list = append(list, systemSettingMessage)
	}

	if err := rows.Err(); err != nil {
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

func (s *Store) GetSystemSettingValueWithDefault(ctx *context.Context, settingName string, defaultValue string) string {
	if setting, err := s.GetSystemSetting(*ctx, &FindSystemSetting{
		Name: settingName,
	}); err == nil && setting != nil {
		return setting.Value
	}
	return defaultValue
}
