package store

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
)

type SystemSettingMessage struct {
	Name        string
	Value       string
	Description string
}

type FindSystemSettingMessage struct {
	Name string
}

func (s *Store) ListSystemSettings(ctx context.Context, find *FindSystemSettingMessage) ([]*SystemSettingMessage, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	list, err := listSystemSettings(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	for _, systemSettingMessage := range list {
		s.systemSettingCache.Store(systemSettingMessage.Name, systemSettingMessage)
	}
	return list, nil
}

func (s *Store) GetSystemSetting(ctx context.Context, find *FindSystemSettingMessage) (*SystemSettingMessage, error) {
	if find.Name != "" {
		if cache, ok := s.systemSettingCache.Load(find.Name); ok {
			return cache.(*SystemSettingMessage), nil
		}
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	list, err := listSystemSettings(ctx, tx, find)
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

func listSystemSettings(ctx context.Context, tx *sql.Tx, find *FindSystemSettingMessage) ([]*SystemSettingMessage, error) {
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

	rows, err := tx.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, FormatError(err)
	}
	defer rows.Close()

	list := []*SystemSettingMessage{}
	for rows.Next() {
		systemSettingMessage := &SystemSettingMessage{}
		if err := rows.Scan(
			&systemSettingMessage.Name,
			&systemSettingMessage.Value,
			&systemSettingMessage.Description,
		); err != nil {
			return nil, FormatError(err)
		}
		list = append(list, systemSettingMessage)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

type systemSettingRaw struct {
	Name        api.SystemSettingName
	Value       string
	Description string
}

func (raw *systemSettingRaw) toSystemSetting() *api.SystemSetting {
	return &api.SystemSetting{
		Name:        raw.Name,
		Value:       raw.Value,
		Description: raw.Description,
	}
}

func (s *Store) UpsertSystemSetting(ctx context.Context, upsert *api.SystemSettingUpsert) (*api.SystemSetting, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	systemSettingRaw, err := upsertSystemSetting(ctx, tx, upsert)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	systemSetting := systemSettingRaw.toSystemSetting()
	s.systemSettingCache.Store(systemSettingRaw.Name, systemSettingRaw)
	return systemSetting, nil
}

func (s *Store) FindSystemSettingList(ctx context.Context, find *api.SystemSettingFind) ([]*api.SystemSetting, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	systemSettingRawList, err := findSystemSettingList(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	list := []*api.SystemSetting{}
	for _, raw := range systemSettingRawList {
		s.systemSettingCache.Store(raw.Name, raw)
		list = append(list, raw.toSystemSetting())
	}
	return list, nil
}

func (s *Store) FindSystemSetting(ctx context.Context, find *api.SystemSettingFind) (*api.SystemSetting, error) {
	if systemSetting, ok := s.systemSettingCache.Load(find.Name); ok {
		systemSettingRaw := systemSetting.(*systemSettingRaw)
		return systemSettingRaw.toSystemSetting(), nil
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	systemSettingRawList, err := findSystemSettingList(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	if len(systemSettingRawList) == 0 {
		return nil, &common.Error{Code: common.NotFound, Err: fmt.Errorf("not found")}
	}

	systemSettingRaw := systemSettingRawList[0]
	s.systemSettingCache.Store(systemSettingRaw.Name, systemSettingRaw)
	return systemSettingRaw.toSystemSetting(), nil
}

func (s *Store) GetSystemSettingValueOrDefault(ctx *context.Context, find api.SystemSettingName, defaultValue string) string {
	if setting, err := s.FindSystemSetting(*ctx, &api.SystemSettingFind{
		Name: find,
	}); err == nil {
		return setting.Value
	}
	return defaultValue
}

func upsertSystemSetting(ctx context.Context, tx *sql.Tx, upsert *api.SystemSettingUpsert) (*systemSettingRaw, error) {
	query := `
		INSERT INTO system_setting (
			name, value, description
		)
		VALUES (?, ?, ?)
		ON CONFLICT(name) DO UPDATE 
		SET
			value = EXCLUDED.value,
			description = EXCLUDED.description
		RETURNING name, value, description
	`
	var systemSettingRaw systemSettingRaw
	if err := tx.QueryRowContext(ctx, query, upsert.Name, upsert.Value, upsert.Description).Scan(
		&systemSettingRaw.Name,
		&systemSettingRaw.Value,
		&systemSettingRaw.Description,
	); err != nil {
		return nil, FormatError(err)
	}

	return &systemSettingRaw, nil
}

func findSystemSettingList(ctx context.Context, tx *sql.Tx, find *api.SystemSettingFind) ([]*systemSettingRaw, error) {
	where, args := []string{"1 = 1"}, []any{}
	if find.Name.String() != "" {
		where, args = append(where, "name = ?"), append(args, find.Name.String())
	}

	query := `
		SELECT
			name,
			value,
			description
		FROM system_setting
		WHERE ` + strings.Join(where, " AND ")
	rows, err := tx.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, FormatError(err)
	}
	defer rows.Close()

	systemSettingRawList := make([]*systemSettingRaw, 0)
	for rows.Next() {
		var systemSettingRaw systemSettingRaw
		if err := rows.Scan(
			&systemSettingRaw.Name,
			&systemSettingRaw.Value,
			&systemSettingRaw.Description,
		); err != nil {
			return nil, FormatError(err)
		}

		systemSettingRawList = append(systemSettingRawList, &systemSettingRaw)
	}

	if err := rows.Err(); err != nil {
		return nil, FormatError(err)
	}

	return systemSettingRawList, nil
}
