package d1

import (
	"context"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

// CreateInstanceSettingIfNotExists atomically creates the setting when its name is absent and reports whether it inserted the row.
func (d *DB) CreateInstanceSettingIfNotExists(ctx context.Context, create *store.InstanceSetting) (bool, error) {
	result, err := d.execOne(ctx, `INSERT INTO system_setting (name, value, description) VALUES (?, ?, ?) ON CONFLICT(name) DO NOTHING`,
		create.Name, create.Value, create.Description)
	if err != nil {
		return false, errors.Wrap(err, "failed to conditionally create instance setting")
	}
	return result.Changes == 1, nil
}

// UpsertInstanceSetting inserts or replaces an instance setting.
func (d *DB) UpsertInstanceSetting(ctx context.Context, upsert *store.InstanceSetting) (*store.InstanceSetting, error) {
	if _, err := d.execOne(ctx, settingUpsertStatement, upsert.Name, upsert.Value, upsert.Description); err != nil {
		return nil, err
	}
	return upsert, nil
}

// settingUpsertStatement inserts or replaces one system_setting row.
const settingUpsertStatement = `INSERT INTO system_setting (name, value, description) VALUES (?, ?, ?)
	ON CONFLICT(name) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description`

// ListInstanceSettings returns the instance settings matching find.
func (d *DB) ListInstanceSettings(ctx context.Context, find *store.FindInstanceSetting) ([]*store.InstanceSetting, error) {
	where, args := []string{"1 = 1"}, []any{}
	if find.Name != "" {
		where, args = append(where, "name = ?"), append(args, find.Name)
	}

	rows, err := d.db.QueryContext(ctx, "SELECT name, value, description FROM system_setting WHERE "+strings.Join(where, " AND "), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []*store.InstanceSetting{}
	for rows.Next() {
		setting := &store.InstanceSetting{}
		if err := rows.Scan(&setting.Name, &setting.Value, &setting.Description); err != nil {
			return nil, err
		}
		list = append(list, setting)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

// DeleteInstanceSetting removes an instance setting.
func (d *DB) DeleteInstanceSetting(ctx context.Context, delete *store.DeleteInstanceSetting) error {
	_, err := d.execOne(ctx, "DELETE FROM system_setting WHERE name = ?", delete.Name)
	return err
}
