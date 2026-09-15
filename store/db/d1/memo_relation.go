package d1

import (
	"context"
	"fmt"
	"strings"

	"github.com/usememos/memos/filter"
	"github.com/usememos/memos/store"
)

// UpsertMemoRelation inserts or refreshes a relation between two memos.
func (d *DB) UpsertMemoRelation(ctx context.Context, create *store.MemoRelation) (*store.MemoRelation, error) {
	// One statement is already atomic on D1, so RETURNING can be read directly.
	stmt := `
		INSERT INTO memo_relation (memo_id, related_memo_id, type)
		VALUES (?, ?, ?)
		ON CONFLICT(memo_id, related_memo_id, type) DO UPDATE SET type = excluded.type
		RETURNING memo_id, related_memo_id, type
	`
	memoRelation := &store.MemoRelation{}
	if err := d.db.QueryRowContext(ctx, stmt, create.MemoID, create.RelatedMemoID, create.Type).Scan(
		&memoRelation.MemoID,
		&memoRelation.RelatedMemoID,
		&memoRelation.Type,
	); err != nil {
		return nil, err
	}
	return memoRelation, nil
}

// ListMemoRelations returns the relations matching find.
func (d *DB) ListMemoRelations(ctx context.Context, find *store.FindMemoRelation) ([]*store.MemoRelation, error) {
	where, args, err := memoRelationConditions(ctx, find)
	if err != nil {
		return nil, err
	}
	query := `
		SELECT memo_id, related_memo_id, type
		FROM memo_relation
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY memo_id DESC`
	query = appendLimit(query, find.Limit, find.Offset)

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []*store.MemoRelation{}
	for rows.Next() {
		memoRelation := &store.MemoRelation{}
		if err := rows.Scan(&memoRelation.MemoID, &memoRelation.RelatedMemoID, &memoRelation.Type); err != nil {
			return nil, err
		}
		list = append(list, memoRelation)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

// memoRelationConditions renders the WHERE clauses for find. Id lists are
// inlined as literals so they never count against the bind limit.
func memoRelationConditions(ctx context.Context, find *store.FindMemoRelation) ([]string, []any, error) {
	where, args := []string{"1 = 1"}, []any{}
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
		list := intList(find.MemoIDList)
		where = append(where, fmt.Sprintf("(memo_id IN %s OR related_memo_id IN %s)", list, list))
	}
	if len(find.SourceMemoIDList) > 0 {
		where = append(where, "memo_id IN "+intList(find.SourceMemoIDList))
	}
	if len(find.RelatedMemoIDList) > 0 {
		where = append(where, "related_memo_id IN "+intList(find.RelatedMemoIDList))
	}
	if find.SourceMemoRowStatus != nil {
		where, args = append(where, "memo_id IN (SELECT id FROM memo WHERE row_status = ?)"), append(args, *find.SourceMemoRowStatus)
	}
	if find.MemoFilter != nil {
		engine, err := filter.DefaultEngine()
		if err != nil {
			return nil, nil, err
		}
		stmt, err := engine.CompileToStatement(ctx, *find.MemoFilter, filter.RenderOptions{Dialect: filter.DialectD1})
		if err != nil {
			return nil, nil, err
		}
		if stmt.SQL != "" {
			where = append(where, fmt.Sprintf("memo_id IN (SELECT id FROM memo WHERE %s)", stmt.SQL))
			where = append(where, fmt.Sprintf("related_memo_id IN (SELECT id FROM memo WHERE %s)", stmt.SQL))
			args = append(args, stmt.Args...)
			args = append(args, stmt.Args...)
		}
	}
	return where, args, nil
}

// DeleteMemoRelation removes the relations matching delete.
func (d *DB) DeleteMemoRelation(ctx context.Context, delete *store.DeleteMemoRelation) error {
	if err := store.ValidateMemoRelationDelete(delete); err != nil {
		return err
	}
	where, args := []string{"1 = 1"}, []any{}
	if delete.MemoID != nil {
		where, args = append(where, "memo_id = ?"), append(args, *delete.MemoID)
	}
	if delete.RelatedMemoID != nil {
		where, args = append(where, "related_memo_id = ?"), append(args, *delete.RelatedMemoID)
	}
	where, args = append(where, "type = ?"), append(args, *delete.Type)
	_, err := d.execOne(ctx, "DELETE FROM memo_relation WHERE "+strings.Join(where, " AND "), args...)
	return err
}
