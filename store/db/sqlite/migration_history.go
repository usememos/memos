package sqlite

import (
	"context"
)

type MigrationHistory struct {
	Version   string
	CreatedTs int64
}

type MigrationHistoryUpsert struct {
	Version string
}

type MigrationHistoryFind struct {
}

func (d *DB) FindMigrationHistoryList(ctx context.Context, _ *MigrationHistoryFind) ([]*MigrationHistory, error) {
	query := "SELECT `version`, `created_ts` FROM `migration_history` ORDER BY `created_ts` DESC"
	rows, err := d.db.QueryContext(ctx, query)
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
	stmt := `
		INSERT INTO migration_history (
			version
		)
		VALUES (?)
		ON CONFLICT(version) DO UPDATE
		SET
			version=EXCLUDED.version
		RETURNING version, created_ts
	`
	var migrationHistory MigrationHistory
	if err := d.db.QueryRowContext(ctx, stmt, upsert.Version).Scan(
		&migrationHistory.Version,
		&migrationHistory.CreatedTs,
	); err != nil {
		return nil, err
	}

	return &migrationHistory, nil
}
