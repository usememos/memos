package postgres

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/Masterminds/squirrel"

	"github.com/usememos/memos/store"
)

func (d *DB) UpsertMemoOrganizer(ctx context.Context, upsert *store.MemoOrganizer) (*store.MemoOrganizer, error) {
	pinned := 0
	if upsert.Pinned {
		pinned = 1
	}
	stmt := "INSERT INTO memo_organizer (memo_id, user_id, pinned) VALUES ($1, $2, $3) ON CONFLICT (memo_id, user_id) DO UPDATE SET pinned = $4"
	if _, err := d.db.ExecContext(ctx, stmt, upsert.MemoID, upsert.UserID, pinned, pinned); err != nil {
		return nil, err
	}
	return upsert, nil
}

func (d *DB) ListMemoOrganizer(ctx context.Context, find *store.FindMemoOrganizer) ([]*store.MemoOrganizer, error) {
	qb := squirrel.Select("memo_id", "user_id", "pinned").
		From("memo_organizer").
		Where("1 = 1").
		PlaceholderFormat(squirrel.Dollar)

	if find.MemoID != 0 {
		qb = qb.Where(squirrel.Eq{"memo_id": find.MemoID})
	}
	if find.UserID != 0 {
		qb = qb.Where(squirrel.Eq{"user_id": find.UserID})
	}

	query, args, err := qb.ToSql()
	if err != nil {
		return nil, err
	}

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*store.MemoOrganizer
	for rows.Next() {
		memoOrganizer := &store.MemoOrganizer{}
		if err := rows.Scan(&memoOrganizer.MemoID, &memoOrganizer.UserID, &memoOrganizer.Pinned); err != nil {
			return nil, err
		}
		list = append(list, memoOrganizer)
	}

	return list, rows.Err()
}

func (d *DB) DeleteMemoOrganizer(ctx context.Context, delete *store.DeleteMemoOrganizer) error {
	qb := squirrel.Delete("memo_organizer").
		PlaceholderFormat(squirrel.Dollar)

	if v := delete.MemoID; v != nil {
		qb = qb.Where(squirrel.Eq{"memo_id": *v})
	}
	if v := delete.UserID; v != nil {
		qb = qb.Where(squirrel.Eq{"user_id": *v})
	}

	stmt, args, err := qb.ToSql()
	if err != nil {
		return err
	}

	if _, err = d.db.ExecContext(ctx, stmt, args...); err != nil {
		return err
	}

	return nil
}

func vacuumMemoOrganizer(ctx context.Context, tx *sql.Tx) error {
	// First, build the subquery for memo_id
	subQueryMemo, subArgsMemo, err := squirrel.Select("id").From("memo").PlaceholderFormat(squirrel.Dollar).ToSql()
	if err != nil {
		return err
	}

	// Build the subquery for user_id
	subQueryUser, subArgsUser, err := squirrel.Select("id").From(`"user"`).PlaceholderFormat(squirrel.Dollar).ToSql()
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
	args = append(args, subArgsUser...)

	// Execute the query
	_, err = tx.ExecContext(ctx, query, args...)
	return err
}
