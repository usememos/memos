package postgres

import (
	"context"
)

const (
	latestSchemaFileName = "LATEST__SCHEMA.sql"
)

func (d *DB) Migrate(ctx context.Context) error {
	// todo
	return nil
}
