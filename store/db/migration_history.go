package db

import (
	"fmt"
)

type MigrationHistory struct {
	CreatedTs int64
	Version   string
}

func findMigrationHistoryList(db *DB) ([]*MigrationHistory, error) {
	rows, err := db.Db.Query(`
		SELECT 
			version,
			created_ts
		FROM
			migration_history
		ORDER BY created_ts DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	migrationHistoryList := make([]*MigrationHistory, 0)
	for rows.Next() {
		var migrationHistory MigrationHistory
		if err := rows.Scan(
			&migrationHistory.Version,
			&migrationHistory.CreatedTs,
		); err != nil {
			return nil, err
		}

		migrationHistoryList = append(migrationHistoryList, &migrationHistory)
	}

	return migrationHistoryList, nil
}

func createMigrationHistory(db *DB, version string) error {
	result, err := db.Db.Exec(`
		INSERT INTO migration_history (
			version
		)
		VALUES (?)
	`,
		version,
	)
	if err != nil {
		return err
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("failed to create migration history with %s", version)
	}

	return nil
}
