package postgres

import (
	"context"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

// CreateInstanceSettingIfNotExists atomically creates the setting when its name is absent and reports whether it inserted the row.
func (d *DB) CreateInstanceSettingIfNotExists(ctx context.Context, create *store.InstanceSetting) (bool, error) {
	stmt := `
		INSERT INTO system_setting (
			name, value, description
		)
		VALUES ($1, $2, $3)
		ON CONFLICT(name) DO NOTHING
	`
	result, err := d.db.ExecContext(ctx, stmt, create.Name, create.Value, create.Description)
	if err != nil {
		return false, errors.Wrap(err, "failed to conditionally create instance setting")
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return false, errors.Wrap(err, "failed to inspect conditional instance setting insert")
	}
	return rowsAffected == 1, nil
}

func (d *DB) UpsertInstanceSetting(ctx context.Context, upsert *store.InstanceSetting) (*store.InstanceSetting, error) {
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

func (d *DB) ListInstanceSettings(ctx context.Context, find *store.FindInstanceSetting) ([]*store.InstanceSetting, error) {
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

	list := []*store.InstanceSetting{}
	for rows.Next() {
		systemSettingMessage := &store.InstanceSetting{}
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

func (d *DB) DeleteInstanceSetting(ctx context.Context, delete *store.DeleteInstanceSetting) error {
	stmt := `DELETE FROM system_setting WHERE name = $1`
	_, err := d.db.ExecContext(ctx, stmt, delete.Name)
	return err
}
