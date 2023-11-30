package postgres

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/Masterminds/squirrel"
	"github.com/usememos/memos/store"
)

func (d *DB) UpsertTag(ctx context.Context, upsert *store.Tag) (*store.Tag, error) {
	return nil, nil
}

func (d *DB) ListTags(ctx context.Context, find *store.FindTag) ([]*store.Tag, error) {
	return nil, nil
}

func (d *DB) DeleteTag(ctx context.Context, delete *store.DeleteTag) error {
	return nil
}

func vacuumTag(ctx context.Context, tx *sql.Tx) error {
	// First, build the subquery for creator_id
	subQuery, subArgs, err := squirrel.Select("id").From("\"user\"").PlaceholderFormat(squirrel.Dollar).ToSql()
	if err != nil {
		return err
	}

	// Now, build the main delete query using the subquery
	query, args, err := squirrel.Delete("tag").
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
