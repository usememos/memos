package postgres

import (
	"context"
	"time"

	"github.com/Masterminds/squirrel"

	"github.com/usememos/memos/store"
)

func (d *DB) FindMigrationHistoryList(ctx context.Context, _ *store.FindMigrationHistory) ([]*store.MigrationHistory, error) {
	qb := squirrel.Select("version", "created_ts").
		From("migration_history").
		OrderBy("created_ts DESC")

	query, args, err := qb.PlaceholderFormat(squirrel.Dollar).ToSql()
	if err != nil {
		return nil, err
	}

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]*store.MigrationHistory, 0)
	for rows.Next() {
		var migrationHistory store.MigrationHistory
		var createdTs time.Time
		if err := rows.Scan(&migrationHistory.Version, &createdTs); err != nil {
			return nil, err
		}
		migrationHistory.CreatedTs = createdTs.UnixNano()
		list = append(list, &migrationHistory)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (d *DB) UpsertMigrationHistory(ctx context.Context, upsert *store.UpsertMigrationHistory) (*store.MigrationHistory, error) {
	qb := squirrel.Insert("migration_history").
		Columns("version").
		Values(upsert.Version).
		Suffix("ON CONFLICT (version) DO UPDATE SET version = ?", upsert.Version)

	query, args, err := qb.PlaceholderFormat(squirrel.Dollar).ToSql()
	if err != nil {
		return nil, err
	}

	_, err = d.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}

	var migrationHistory store.MigrationHistory
	var createdTs time.Time
	query, args, err = squirrel.Select("version", "created_ts").
		From("migration_history").
		Where(squirrel.Eq{"version": upsert.Version}).
		PlaceholderFormat(squirrel.Dollar).
		ToSql()
	if err != nil {
		return nil, err
	}

	if err := d.db.QueryRowContext(ctx, query, args...).Scan(&migrationHistory.Version, &createdTs); err != nil {
		return nil, err
	}
	migrationHistory.CreatedTs = createdTs.UnixNano()

	return &migrationHistory, nil
}
