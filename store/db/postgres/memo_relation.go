package postgres

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/Masterminds/squirrel"

	"github.com/usememos/memos/store"
)

func (d *DB) UpsertMemoRelation(ctx context.Context, create *store.MemoRelation) (*store.MemoRelation, error) {
	qb := squirrel.Insert("memo_relation").
		Columns("memo_id", "related_memo_id", "type").
		Values(create.MemoID, create.RelatedMemoID, create.Type).
		Suffix("ON CONFLICT (version) DO NOTHING").
		PlaceholderFormat(squirrel.Dollar)

	stmt, args, err := qb.ToSql()
	if err != nil {
		return nil, err
	}

	_, err = d.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return nil, err
	}

	return &store.MemoRelation{
		MemoID:        create.MemoID,
		RelatedMemoID: create.RelatedMemoID,
		Type:          create.Type,
	}, nil
}

func (d *DB) ListMemoRelations(ctx context.Context, find *store.FindMemoRelation) ([]*store.MemoRelation, error) {
	qb := squirrel.Select("memo_id", "related_memo_id", "type").
		From("memo_relation").
		Where("TRUE").
		PlaceholderFormat(squirrel.Dollar)

	if find.MemoID != nil {
		qb = qb.Where(squirrel.Eq{"memo_id": *find.MemoID})
	}
	if find.RelatedMemoID != nil {
		qb = qb.Where(squirrel.Eq{"related_memo_id": *find.RelatedMemoID})
	}
	if find.Type != nil {
		qb = qb.Where(squirrel.Eq{"type": *find.Type})
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

	var list []*store.MemoRelation
	for rows.Next() {
		memoRelation := &store.MemoRelation{}
		if err := rows.Scan(&memoRelation.MemoID, &memoRelation.RelatedMemoID, &memoRelation.Type); err != nil {
			return nil, err
		}
		list = append(list, memoRelation)
	}

	return list, rows.Err()
}

func (d *DB) DeleteMemoRelation(ctx context.Context, delete *store.DeleteMemoRelation) error {
	qb := squirrel.Delete("memo_relation").
		PlaceholderFormat(squirrel.Dollar)

	if delete.MemoID != nil {
		qb = qb.Where(squirrel.Eq{"memo_id": *delete.MemoID})
	}
	if delete.RelatedMemoID != nil {
		qb = qb.Where(squirrel.Eq{"related_memo_id": *delete.RelatedMemoID})
	}
	if delete.Type != nil {
		qb = qb.Where(squirrel.Eq{"type": *delete.Type})
	}

	stmt, args, err := qb.ToSql()
	if err != nil {
		return err
	}

	result, err := d.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return err
	}

	_, err = result.RowsAffected()
	return err
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
	args = append(args, subArgsMemo...)

	// Execute the query
	_, err = tx.ExecContext(ctx, query, args...)
	return err
}
