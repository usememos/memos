package db

import (
	"database/sql"
)

type MigrationHistory struct {
	CreatedTs int64
	Version   string
}

func upsertMigrationHistory(db *sql.DB, version string) (*MigrationHistory, error) {
	row, err := db.Query(`
		INSERT INTO migration_history (
			version
		)
		VALUES (?)
		ON CONFLICT(version) DO UPDATE
		SET
			version=EXCLUDED.version
		RETURNING version, created_ts
	`,
		version,
	)
	if err != nil {
		return nil, err
	}
	defer row.Close()

	row.Next()
	migrationHistory := MigrationHistory{}
	if err := row.Scan(
		&migrationHistory.Version,
		&migrationHistory.CreatedTs,
	); err != nil {
		return nil, err
	}

	return &migrationHistory, nil
}
