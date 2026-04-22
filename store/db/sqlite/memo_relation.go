package sqlite

import (
	"context"
	"fmt"
	"strings"

	"github.com/usememos/memos/internal/filter"
	"github.com/usememos/memos/store"
)

func (d *DB) UpsertMemoRelation(ctx context.Context, create *store.MemoRelation) (*store.MemoRelation, error) {
	stmt := `
		INSERT INTO memo_relation (
			memo_id,
			related_memo_id,
			type
		)
		VALUES (?, ?, ?)
		ON CONFLICT(memo_id, related_memo_id, type) DO UPDATE SET type = excluded.type
		RETURNING memo_id, related_memo_id, type
	`
	memoRelation := &store.MemoRelation{}
	if err := d.db.QueryRowContext(
		ctx,
		stmt,
		create.MemoID,
		create.RelatedMemoID,
		create.Type,
	).Scan(
		&memoRelation.MemoID,
		&memoRelation.RelatedMemoID,
		&memoRelation.Type,
	); err != nil {
		return nil, err
	}

	return memoRelation, nil
}

func (d *DB) ListMemoRelations(ctx context.Context, find *store.FindMemoRelation) ([]*store.MemoRelation, error) {
	where, args := []string{"TRUE"}, []any{}
	if find.MemoID != nil {
		where, args = append(where, "memo_id = ?"), append(args, *find.MemoID)
	}
	if find.RelatedMemoID != nil {
		where, args = append(where, "related_memo_id = ?"), append(args, *find.RelatedMemoID)
	}
	if find.Type != nil {
		where, args = append(where, "type = ?"), append(args, *find.Type)
	}
	if len(find.MemoIDList) > 0 {
		placeholders := make([]string, len(find.MemoIDList))
		for i, id := range find.MemoIDList {
			placeholders[i] = "?"
			args = append(args, id)
		}
		inClause := strings.Join(placeholders, ", ")
		for _, id := range find.MemoIDList {
			args = append(args, id)
		}
		where = append(where, fmt.Sprintf("(memo_id IN (%s) OR related_memo_id IN (%s))", inClause, inClause))
	}
	if len(find.SourceMemoIDList) > 0 {
		placeholders := make([]string, len(find.SourceMemoIDList))
		for i, id := range find.SourceMemoIDList {
			placeholders[i] = "?"
			args = append(args, id)
		}
		where = append(where, fmt.Sprintf("memo_id IN (%s)", strings.Join(placeholders, ", ")))
	}
	if len(find.RelatedMemoIDList) > 0 {
		placeholders := make([]string, len(find.RelatedMemoIDList))
		for i, id := range find.RelatedMemoIDList {
			placeholders[i] = "?"
			args = append(args, id)
		}
		where = append(where, fmt.Sprintf("related_memo_id IN (%s)", strings.Join(placeholders, ", ")))
	}
	if find.MemoFilter != nil {
		engine, err := filter.DefaultEngine()
		if err != nil {
			return nil, err
		}
		stmt, err := engine.CompileToStatement(ctx, *find.MemoFilter, filter.RenderOptions{Dialect: filter.DialectSQLite})
		if err != nil {
			return nil, err
		}
		if stmt.SQL != "" {
			where = append(where, fmt.Sprintf("memo_id IN (SELECT id FROM memo WHERE %s)", stmt.SQL))
			where = append(where, fmt.Sprintf("related_memo_id IN (SELECT id FROM memo WHERE %s)", stmt.SQL))
			args = append(args, append(stmt.Args, stmt.Args...)...)
		}
	}

	query := `
		SELECT
			memo_id,
			related_memo_id,
			type
		FROM memo_relation
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY memo_id DESC`
	if find.Limit != nil {
		query = fmt.Sprintf("%s LIMIT %d", query, *find.Limit)
		if find.Offset != nil {
			query = fmt.Sprintf("%s OFFSET %d", query, *find.Offset)
		}
	}

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []*store.MemoRelation{}
	for rows.Next() {
		memoRelation := &store.MemoRelation{}
		if err := rows.Scan(
			&memoRelation.MemoID,
			&memoRelation.RelatedMemoID,
			&memoRelation.Type,
		); err != nil {
			return nil, err
		}
		list = append(list, memoRelation)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (d *DB) DeleteMemoRelation(ctx context.Context, delete *store.DeleteMemoRelation) error {
	where, args := []string{"TRUE"}, []any{}
	if delete.MemoID != nil {
		where, args = append(where, "memo_id = ?"), append(args, *delete.MemoID)
	}
	if delete.RelatedMemoID != nil {
		where, args = append(where, "related_memo_id = ?"), append(args, *delete.RelatedMemoID)
	}
	if delete.Type != nil {
		where, args = append(where, "type = ?"), append(args, *delete.Type)
	}
	stmt := `
		DELETE FROM memo_relation
		WHERE ` + strings.Join(where, " AND ")
	result, err := d.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return err
	}
	if _, err = result.RowsAffected(); err != nil {
		return err
	}
	return nil
}
