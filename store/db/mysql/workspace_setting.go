package mysql

import (
	"context"
	"strings"

	"google.golang.org/protobuf/encoding/protojson"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (d *DB) UpsertWorkspaceSetting(ctx context.Context, upsert *store.WorkspaceSetting) (*store.WorkspaceSetting, error) {
	stmt := "INSERT INTO `system_setting` (`name`, `value`, `description`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `value` = ?, `description` = ?"
	_, err := d.db.ExecContext(
		ctx,
		stmt,
		upsert.Name,
		upsert.Value,
		upsert.Description,
		upsert.Value,
		upsert.Description,
	)
	if err != nil {
		return nil, err
	}

	return upsert, nil
}

func (d *DB) ListWorkspaceSettings(ctx context.Context, find *store.FindWorkspaceSetting) ([]*store.WorkspaceSetting, error) {
	where, args := []string{"1 = 1"}, []any{}
	if find.Name != "" {
		where, args = append(where, "`name` = ?"), append(args, find.Name)
	}

	query := "SELECT `name`, `value`, `description` FROM `system_setting` WHERE " + strings.Join(where, " AND ")
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []*store.WorkspaceSetting{}
	for rows.Next() {
		systemSettingMessage := &store.WorkspaceSetting{}
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

	return list, nil
}

func (d *DB) DeleteWorkspaceSetting(ctx context.Context, delete *store.DeleteWorkspaceSetting) error {
	stmt := "DELETE FROM `system_setting` WHERE `name` = ?"
	_, err := d.db.ExecContext(ctx, stmt, delete.Name)
	return err
}

func (d *DB) UpsertWorkspaceSettingV1(ctx context.Context, upsert *storepb.WorkspaceSetting) (*storepb.WorkspaceSetting, error) {
	stmt := `
		INSERT INTO system_setting (name, value, description)
		VALUES (?, ?, '')
		ON DUPLICATE KEY UPDATE value = ?`
	var valueString string
	if upsert.Key == storepb.WorkspaceSettingKey_WORKSPACE_SETTING_GENERAL {
		valueBytes, err := protojson.Marshal(upsert.GetGeneral())
		if err != nil {
			return nil, err
		}
		valueString = string(valueBytes)
	}
	if _, err := d.db.ExecContext(ctx, stmt, upsert.Key.String(), valueString, valueString); err != nil {
		return nil, err
	}
	return upsert, nil
}

func (d *DB) ListWorkspaceSettingsV1(ctx context.Context, find *store.FindWorkspaceSettingV1) ([]*storepb.WorkspaceSetting, error) {
	where, args := []string{"1 = 1"}, []any{}
	if find.Key != storepb.WorkspaceSettingKey_WORKSPACE_SETTING_KEY_UNSPECIFIED {
		where, args = append(where, "name = ?"), append(args, find.Key.String())
	}

	query := `SELECT name, value FROM system_setting WHERE ` + strings.Join(where, " AND ")

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []*storepb.WorkspaceSetting{}
	for rows.Next() {
		workspaceSetting := &storepb.WorkspaceSetting{}
		var keyString, valueString string
		if err := rows.Scan(
			&keyString,
			&valueString,
		); err != nil {
			return nil, err
		}
		workspaceSetting.Key = storepb.WorkspaceSettingKey(storepb.WorkspaceSettingKey_value[keyString])
		if workspaceSetting.Key == storepb.WorkspaceSettingKey_WORKSPACE_SETTING_GENERAL {
			generalSetting := &storepb.WorkspaceGeneralSetting{}
			if err := protojson.Unmarshal([]byte(valueString), generalSetting); err != nil {
				return nil, err
			}
			workspaceSetting.Value = &storepb.WorkspaceSetting_General{General: generalSetting}
		} else {
			// Skip unknown workspace setting key.
			continue
		}
		list = append(list, workspaceSetting)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}
