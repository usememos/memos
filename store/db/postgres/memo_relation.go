package postgres

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/Masterminds/squirrel"
	"github.com/usememos/memos/store"
)

func (d *DB) UpsertMemoRelation(ctx context.Context, create *store.MemoRelation) (*store.MemoRelation, error) {
	return nil, nil
}

func (d *DB) ListMemoRelations(ctx context.Context, find *store.FindMemoRelation) ([]*store.MemoRelation, error) {
	return nil, nil
}

func (d *DB) DeleteMemoRelation(ctx context.Context, delete *store.DeleteMemoRelation) error {
	return nil
}

func vacuumMemoRelations(ctx context.Context, tx *sql.Tx) error {
	// First, build the subquery for memo_id
	subQueryMemo, subArgsMemo, err := squirrel.Select("id").From("memo").PlaceholderFormat(squirrel.Dollar).ToSql()
	if err != nil {
		return err
	}

	// Note: The same subquery is used for related_memo_id as it's also checking against the "memo" table

	// Now, build the main delete query using the subqueries
	query, args, err := squirrel.Delete("memo_relation").
		Where(fmt.Sprintf("memo_id NOT IN (%s)", subQueryMemo), subArgsMemo...).
		Where(fmt.Sprintf("related_memo_id NOT IN (%s)", subQueryMemo), subArgsMemo...).
		PlaceholderFormat(squirrel.Dollar).
		ToSql()
	if err != nil {
		return err
	}

	// Combine the arguments for both instances of the same subquery
	combinedArgs := append(args, subArgsMemo...)

	// Execute the query
	_, err = tx.ExecContext(ctx, query, combinedArgs...)
	return err
}
