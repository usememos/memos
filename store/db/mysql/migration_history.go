package mysql

import (
	"context"

	"github.com/usememos/memos/store"
)

// FindMigrationHistoryList retrieves all migration history records.
// NOTE: This method is deprecated along with the migration_history table.
func (d *DB) FindMigrationHistoryList(ctx context.Context, _ *store.FindMigrationHistory) ([]*store.MigrationHistory, error) {
	query := "SELECT `version`, UNIX_TIMESTAMP(`created_ts`) FROM `migration_history` ORDER BY `created_ts` DESC"
	rows, err := d.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]*store.MigrationHistory, 0)
	for rows.Next() {
		var migrationHistory store.MigrationHistory
		if err := rows.Scan(
			&migrationHistory.Version,
			&migrationHistory.CreatedTs,
		); err != nil {
			return nil, err
		}

		list = append(list, &migrationHistory)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

// UpsertMigrationHistory inserts or updates a migration history record.
// NOTE: This method is deprecated along with the migration_history table.
// This uses separate INSERT and SELECT queries instead of INSERT...RETURNING because
// MySQL doesn't support RETURNING clause in the same way as PostgreSQL/SQLite.
// This could have race conditions but is acceptable for deprecated transition code.
func (d *DB) UpsertMigrationHistory(ctx context.Context, upsert *store.UpsertMigrationHistory) (*store.MigrationHistory, error) {
	stmt := "INSERT INTO `migration_history` (`version`) VALUES (?) ON DUPLICATE KEY UPDATE `version` = ?"
	_, err := d.db.ExecContext(ctx, stmt, upsert.Version, upsert.Version)
	if err != nil {
		return nil, err
	}

	var migrationHistory store.MigrationHistory
	stmt = "SELECT `version`, UNIX_TIMESTAMP(`created_ts`) FROM `migration_history` WHERE `version` = ?"
	if err := d.db.QueryRowContext(ctx, stmt, upsert.Version).Scan(
		&migrationHistory.Version,
		&migrationHistory.CreatedTs,
	); err != nil {
		return nil, err
	}
	return &migrationHistory, nil
}
