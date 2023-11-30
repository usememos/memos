package postgres

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/Masterminds/squirrel"
	"github.com/usememos/memos/store"
)

func (d *DB) CreateResource(ctx context.Context, create *store.Resource) (*store.Resource, error) {
	return nil, nil
}

func (d *DB) ListResources(ctx context.Context, find *store.FindResource) ([]*store.Resource, error) {
	return nil, nil
}

func (d *DB) UpdateResource(ctx context.Context, update *store.UpdateResource) (*store.Resource, error) {
	return nil, nil
}

func (d *DB) DeleteResource(ctx context.Context, delete *store.DeleteResource) error {
	return nil
}

func vacuumResource(ctx context.Context, tx *sql.Tx) error {
	// First, build the subquery
	subQuery, subArgs, err := squirrel.Select("id").From("user").PlaceholderFormat(squirrel.Dollar).ToSql()
	if err != nil {
		return err
	}

	// Now, build the main delete query using the subquery
	query, args, err := squirrel.Delete("resource").
		Where(fmt.Sprintf("creator_id NOT IN (%s)", subQuery), subArgs...).
		PlaceholderFormat(squirrel.Dollar).
		ToSql()
	if err != nil {
		return err
	}

	// Execute the query
	_, err = tx.ExecContext(ctx, query, args...)
	return err
}
