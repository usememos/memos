package postgres

import (
	"context"
	"strings"

	"github.com/usememos/memos/store"
)

func (d *DB) UpsertWorkspaceSetting(ctx context.Context, upsert *store.WorkspaceSetting) (*store.WorkspaceSetting, error) {
	stmt := `
		INSERT INTO system_setting (
			name, value, description
		)
		VALUES ($1, $2, $3)
		ON CONFLICT(name) DO UPDATE 
		SET
			value = EXCLUDED.value,
			description = EXCLUDED.description
	`
	if _, err := d.db.ExecContext(ctx, stmt, upsert.Name, upsert.Value, upsert.Description); err != nil {
		return nil, err
	}

	return upsert, nil
}

func (d *DB) ListWorkspaceSettings(ctx context.Context, find *store.FindWorkspaceSetting) ([]*store.WorkspaceSetting, error) {
	where, args := []string{"1 = 1"}, []any{}
	if find.Name != "" {
		where, args = append(where, "name = "+placeholder(len(args)+1)), append(args, find.Name)
	}

	query := `
		SELECT
			name,
			value,
			description
		FROM system_setting
		WHERE ` + strings.Join(where, " AND ")

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
	stmt := `DELETE FROM system_setting WHERE name = $1`
	_, err := d.db.ExecContext(ctx, stmt, delete.Name)
	return err
}
