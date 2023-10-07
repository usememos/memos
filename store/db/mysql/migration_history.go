package mysql

import (
	"context"
	"strings"
)

type MigrationHistory struct {
	Version   string
	CreatedTs int64
}

type MigrationHistoryUpsert struct {
	Version string
}

type MigrationHistoryFind struct {
	Version *string
}

func (d *DB) FindMigrationHistoryList(ctx context.Context, find *MigrationHistoryFind) ([]*MigrationHistory, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.Version; v != nil {
		where, args = append(where, "`version` = ?"), append(args, *v)
	}

	query := "SELECT `version`, UNIX_TIMESTAMP(`created_ts`) FROM `migration_history` WHERE " + strings.Join(where, " AND ") + " ORDER BY `created_ts` DESC"
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]*MigrationHistory, 0)
	for rows.Next() {
		var migrationHistory MigrationHistory
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

func (d *DB) UpsertMigrationHistory(ctx context.Context, upsert *MigrationHistoryUpsert) (*MigrationHistory, error) {
	stmt := "INSERT INTO `migration_history` (`version`) VALUES (?) ON DUPLICATE KEY UPDATE `version` = ?"
	_, err := d.db.ExecContext(ctx, stmt, upsert.Version, upsert.Version)
	if err != nil {
		return nil, err
	}

	var migrationHistory MigrationHistory
	stmt = "SELECT `version`, UNIX_TIMESTAMP(`created_ts`) FROM `migration_history` WHERE `version` = ?"
	if err := d.db.QueryRowContext(ctx, stmt, upsert.Version).Scan(
		&migrationHistory.Version,
		&migrationHistory.CreatedTs,
	); err != nil {
		return nil, err
	}

	return &migrationHistory, nil
}
