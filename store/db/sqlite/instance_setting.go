package sqlite

import (
	"context"
	"database/sql"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

// CreateInstanceSettingIfNotExists atomically creates the setting when its name is absent and reports whether it inserted the row.
func (d *DB) CreateInstanceSettingIfNotExists(ctx context.Context, create *store.InstanceSetting) (bool, error) {
	return createInstanceSettingIfNotExists(ctx, d.db, create)
}

// CreateInstanceSettingIfNotExistsTx is CreateInstanceSettingIfNotExists within tx.
func (*DB) CreateInstanceSettingIfNotExistsTx(ctx context.Context, tx *sql.Tx, create *store.InstanceSetting) (bool, error) {
	return createInstanceSettingIfNotExists(ctx, tx, create)
}

func createInstanceSettingIfNotExists(ctx context.Context, executor dbExecutor, create *store.InstanceSetting) (bool, error) {
	stmt := `
		INSERT INTO system_setting (
			name, value, description
		)
		VALUES (?, ?, ?)
		ON CONFLICT(name) DO NOTHING
	`
	result, err := executor.ExecContext(ctx, stmt, create.Name, create.Value, create.Description)
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
	return updateInstanceSettingIfUnchanged(ctx, d.db, name, oldValue, newValue)
}

// UpdateInstanceSettingIfUnchangedTx is UpdateInstanceSettingIfUnchanged within tx.
func (*DB) UpdateInstanceSettingIfUnchangedTx(ctx context.Context, tx *sql.Tx, name, oldValue, newValue string) (bool, error) {
	return updateInstanceSettingIfUnchanged(ctx, tx, name, oldValue, newValue)
}

func updateInstanceSettingIfUnchanged(ctx context.Context, executor dbExecutor, name, oldValue, newValue string) (bool, error) {
	result, err := executor.ExecContext(ctx, "UPDATE system_setting SET value = ? WHERE name = ? AND value = ?", newValue, name, oldValue)
	if err != nil {
		return false, errors.Wrap(err, "failed to conditionally update instance setting")
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return false, errors.Wrap(err, "failed to inspect conditional instance setting update")
	}
	return rowsAffected == 1, nil
}

// GetInstanceSettingTx reads one setting within tx, or returns nil when it is
// absent. The immediate transaction already holds the database write lock.
func (*DB) GetInstanceSettingTx(ctx context.Context, tx *sql.Tx, name string) (*store.InstanceSetting, error) {
	setting := &store.InstanceSetting{}
	err := tx.QueryRowContext(ctx, "SELECT name, value, description FROM system_setting WHERE name = ?", name).Scan(
		&setting.Name, &setting.Value, &setting.Description,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, errors.Wrap(err, "failed to read instance setting")
	}
	return setting, nil
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

func upsertInstanceSetting(ctx context.Context, executor dbExecutor, upsert *store.InstanceSetting) error {
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
	_, err := executor.ExecContext(ctx, stmt, upsert.Name, upsert.Value, upsert.Description)
	return err
}

func (d *DB) ListInstanceSettings(ctx context.Context, find *store.FindInstanceSetting) ([]*store.InstanceSetting, error) {
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
	return deleteInstanceSetting(ctx, d.db, delete)
}

// DeleteInstanceSettingTx is DeleteInstanceSetting within tx.
func (*DB) DeleteInstanceSettingTx(ctx context.Context, tx *sql.Tx, delete *store.DeleteInstanceSetting) error {
	return deleteInstanceSetting(ctx, tx, delete)
}

func deleteInstanceSetting(ctx context.Context, q dbExecutor, delete *store.DeleteInstanceSetting) error {
	stmt := "DELETE FROM system_setting WHERE name = ?"
	_, err := q.ExecContext(ctx, stmt, delete.Name)
	return err
}
