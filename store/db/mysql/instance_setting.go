package mysql

import (
	"context"
	"database/sql"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

// CreateInstanceSettingIfNotExists atomically creates the setting when its name is absent and reports whether it inserted the row.
func (d *DB) CreateInstanceSettingIfNotExists(ctx context.Context, create *store.InstanceSetting) (bool, error) {
	stmt := "INSERT IGNORE INTO `system_setting` (`name`, `value`, `description`) VALUES (?, ?, ?)"
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

// UpdateInstanceSettingIfUnchanged replaces the setting value only when the
// stored value still equals oldValue, and reports whether it did.
func (d *DB) UpdateInstanceSettingIfUnchanged(ctx context.Context, name, oldValue, newValue string) (bool, error) {
	// MySQL reports zero affected rows when the new value equals the stored
	// one, which would read as a conflict. An unchanged write is a no-op.
	if oldValue == newValue {
		return d.instanceSettingHasValue(ctx, name, oldValue)
	}
	// A binary comparison is exact; the column collation may ignore case
	// and trailing spaces.
	result, err := d.db.ExecContext(ctx, "UPDATE `system_setting` SET `value` = ? WHERE `name` = ? AND `value` = CAST(? AS BINARY)", newValue, name, oldValue)
	if err != nil {
		return false, errors.Wrap(err, "failed to conditionally update instance setting")
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return false, errors.Wrap(err, "failed to inspect conditional instance setting update")
	}
	return rowsAffected == 1, nil
}

func (d *DB) instanceSettingHasValue(ctx context.Context, name, value string) (bool, error) {
	var count int
	if err := d.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM `system_setting` WHERE `name` = ? AND `value` = CAST(? AS BINARY)", name, value).Scan(&count); err != nil {
		return false, errors.Wrap(err, "failed to read instance setting")
	}
	return count == 1, nil
}

func (d *DB) UpsertInstanceSetting(ctx context.Context, upsert *store.InstanceSetting) (*store.InstanceSetting, error) {
	if err := upsertInstanceSetting(ctx, d.db, upsert); err != nil {
		return nil, err
	}

	return upsert, nil
}

func (*DB) UpsertInstanceSettingTx(ctx context.Context, tx *sql.Tx, upsert *store.InstanceSetting) error {
	return upsertInstanceSetting(ctx, tx, upsert)
}

type instanceSettingExecer interface {
	ExecContext(context.Context, string, ...any) (sql.Result, error)
}

func upsertInstanceSetting(ctx context.Context, executor instanceSettingExecer, upsert *store.InstanceSetting) error {
	stmt := "INSERT INTO `system_setting` (`name`, `value`, `description`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `value` = ?, `description` = ?"
	_, err := executor.ExecContext(
		ctx,
		stmt,
		upsert.Name,
		upsert.Value,
		upsert.Description,
		upsert.Value,
		upsert.Description,
	)
	return err
}

func (d *DB) ListInstanceSettings(ctx context.Context, find *store.FindInstanceSetting) ([]*store.InstanceSetting, error) {
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
	stmt := "DELETE FROM `system_setting` WHERE `name` = ?"
	_, err := d.db.ExecContext(ctx, stmt, delete.Name)
	return err
}
