package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateMemo(ctx context.Context, create *store.Memo) (*store.Memo, error) {
	fields := []string{"creator_id", "content", "visibility"}
	args := []any{create.CreatorID, create.Content, create.Visibility}

	stmt := "INSERT INTO memo (" + strings.Join(fields, ", ") + ") VALUES (" + placeholders(len(args)) + ") RETURNING id, created_ts, updated_ts, row_status"
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(
		&create.ID,
		&create.CreatedTs,
		&create.UpdatedTs,
		&create.RowStatus,
	); err != nil {
		return nil, err
	}

	return create, nil
}

func (d *DB) ListMemos(ctx context.Context, find *store.FindMemo) ([]*store.Memo, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.ID; v != nil {
		where, args = append(where, "memo.id = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.CreatorID; v != nil {
		where, args = append(where, "memo.creator_id = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.RowStatus; v != nil {
		where, args = append(where, "memo.row_status = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.CreatedTsBefore; v != nil {
		where, args = append(where, "memo.created_ts < "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.CreatedTsAfter; v != nil {
		where, args = append(where, "memo.created_ts > "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.UpdatedTsBefore; v != nil {
		where, args = append(where, "memo.updated_ts < "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.UpdatedTsAfter; v != nil {
		where, args = append(where, "memo.updated_ts > "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.ContentSearch; len(v) != 0 {
		for _, s := range v {
			where, args = append(where, "memo.content LIKE "+placeholder(len(args)+1)), append(args, fmt.Sprintf("%%%s%%", s))
		}
	}
	if v := find.VisibilityList; len(v) != 0 {
		holders := []string{}
		for _, visibility := range v {
			holders = append(holders, placeholder(len(args)+1))
			args = append(args, visibility.String())
		}
		where = append(where, fmt.Sprintf("memo.visibility in (%s)", strings.Join(holders, ", ")))
	}
	if find.ExcludeComments {
		where = append(where, "memo_relation.related_memo_id IS NULL")
	}

	orders := []string{}
	if find.OrderByPinned {
		orders = append(orders, "pinned DESC")
	}
	if find.OrderByUpdatedTs {
		orders = append(orders, "updated_ts DESC")
	} else {
		orders = append(orders, "created_ts DESC")
	}
	orders = append(orders, "id DESC")

	fields := []string{
		`memo.id AS id`,
		`memo.creator_id AS creator_id`,
		`memo.created_ts AS created_ts`,
		`memo.updated_ts AS updated_ts`,
		`memo.row_status AS row_status`,
		`memo.visibility AS visibility`,
		`COALESCE(memo_organizer.pinned, 0) AS pinned`,
		`memo_relation.related_memo_id AS parent_id`,
	}
	if !find.ExcludeContent {
		fields = append(fields, `memo.content AS content`)
	}

	query := `SELECT ` + strings.Join(fields, ", ") + `
		FROM memo
		FULl JOIN memo_organizer ON memo.id = memo_organizer.memo_id AND memo.creator_id = memo_organizer.user_id
		FULL JOIN memo_relation ON memo.id = memo_relation.memo_id AND memo_relation.type = 'COMMENT'
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY ` + strings.Join(orders, ", ")
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

	list := make([]*store.Memo, 0)
	for rows.Next() {
		var memo store.Memo
		dests := []any{
			&memo.ID,
			&memo.CreatorID,
			&memo.CreatedTs,
			&memo.UpdatedTs,
			&memo.RowStatus,
			&memo.Visibility,
			&memo.Pinned,
			&memo.ParentID,
		}
		if !find.ExcludeContent {
			dests = append(dests, &memo.Content)
		}
		if err := rows.Scan(dests...); err != nil {
			return nil, err
		}
		list = append(list, &memo)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (d *DB) GetMemo(ctx context.Context, find *store.FindMemo) (*store.Memo, error) {
	list, err := d.ListMemos(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}

	memo := list[0]
	return memo, nil
}

func (d *DB) UpdateMemo(ctx context.Context, update *store.UpdateMemo) error {
	set, args := []string{}, []any{}
	if v := update.CreatedTs; v != nil {
		set, args = append(set, "created_ts = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "updated_ts = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.RowStatus; v != nil {
		set, args = append(set, "row_status = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.Content; v != nil {
		set, args = append(set, "content = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.Visibility; v != nil {
		set, args = append(set, "visibility = "+placeholder(len(args)+1)), append(args, *v)
	}
	stmt := `UPDATE memo SET ` + strings.Join(set, ", ") + ` WHERE id = ` + placeholder(len(args)+1)
	args = append(args, update.ID)
	if _, err := d.db.ExecContext(ctx, stmt, args...); err != nil {
		return err
	}
	return nil
}

func (d *DB) DeleteMemo(ctx context.Context, delete *store.DeleteMemo) error {
	where, args := []string{"id = " + placeholder(1)}, []any{delete.ID}
	stmt := `DELETE FROM memo WHERE ` + strings.Join(where, " AND ")
	result, err := d.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return errors.Wrap(err, "failed to delete memo")
	}
	if _, err := result.RowsAffected(); err != nil {
		return err
	}
	return nil
}

func vacuumMemo(ctx context.Context, tx *sql.Tx) error {
	stmt := `DELETE FROM memo WHERE creator_id NOT IN (SELECT id FROM "user")`
	_, err := tx.ExecContext(ctx, stmt)
	return err
}
