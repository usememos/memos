package postgres

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/Masterminds/squirrel"
	"github.com/usememos/memos/store"
)

func (d *DB) UpsertMemoOrganizer(ctx context.Context, upsert *store.MemoOrganizer) (*store.MemoOrganizer, error) {
	return nil, nil
}

func (d *DB) ListMemoOrganizer(ctx context.Context, find *store.FindMemoOrganizer) ([]*store.MemoOrganizer, error) {
	return nil, nil
}

func (d *DB) DeleteMemoOrganizer(ctx context.Context, delete *store.DeleteMemoOrganizer) error {
	return nil
}

func vacuumMemoOrganizer(ctx context.Context, tx *sql.Tx) error {
	// First, build the subquery for memo_id
	subQueryMemo, subArgsMemo, err := squirrel.Select("id").From("memo").PlaceholderFormat(squirrel.Dollar).ToSql()
	if err != nil {
		return err
	}

	// Build the subquery for user_id
	subQueryUser, subArgsUser, err := squirrel.Select("id").From("\"user\"").PlaceholderFormat(squirrel.Dollar).ToSql()
	if err != nil {
		return err
	}

	// Now, build the main delete query using the subqueries
	query, args, err := squirrel.Delete("memo_organizer").
		Where(fmt.Sprintf("memo_id NOT IN (%s)", subQueryMemo), subArgsMemo...).
		Where(fmt.Sprintf("user_id NOT IN (%s)", subQueryUser), subArgsUser...).
		PlaceholderFormat(squirrel.Dollar).
		ToSql()
	if err != nil {
		return err
	}

	// Combine the arguments from both subqueries
	combinedArgs := append(args, subArgsUser...)

	// Execute the query
	_, err = tx.ExecContext(ctx, query, combinedArgs...)
	return err
}
