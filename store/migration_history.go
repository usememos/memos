package store

import (
	"context"
)

type MigrationHistory struct {
	Version   string
	CreatedTs int64
}

type UpsertMigrationHistory struct {
	Version string
}

type FindMigrationHistory struct {
}

func (s *Store) FindMigrationHistoryList(ctx context.Context, find *FindMigrationHistory) ([]*MigrationHistory, error) {
	return s.driver.FindMigrationHistoryList(ctx, find)
}

func (s *Store) UpsertMigrationHistory(ctx context.Context, upsert *UpsertMigrationHistory) (*MigrationHistory, error) {
	return s.driver.UpsertMigrationHistory(ctx, upsert)
}
