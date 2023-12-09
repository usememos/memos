package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/Masterminds/squirrel"
	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateMemo(ctx context.Context, create *store.Memo) (*store.Memo, error) {
	// Initialize a Squirrel statement builder for PostgreSQL
	builder := squirrel.Insert("memo").
		PlaceholderFormat(squirrel.Dollar).
		Columns("creator_id", "content", "visibility")

	// Add initial values for the columns
	values := []any{create.CreatorID, create.Content, create.Visibility}

	// Conditionally add other fields and values
	if create.ID != 0 {
		builder = builder.Columns("id")
		values = append(values, create.ID)
	}

	if create.CreatedTs != 0 {
		builder = builder.Columns("created_ts")
		values = append(values, create.CreatedTs)
	}

	if create.UpdatedTs != 0 {
		builder = builder.Columns("updated_ts")
		values = append(values, create.UpdatedTs)
	}

	if create.RowStatus != "" {
		builder = builder.Columns("row_status")
		values = append(values, create.RowStatus)
	}

	// Add all the values at once
	builder = builder.Values(values...)

	// Add the RETURNING clause to get the ID of the inserted row
	builder = builder.Suffix("RETURNING id")

	// Prepare and execute the query
	query, args, err := builder.ToSql()
	if err != nil {
		return nil, err
	}

	var id int32
	err = d.db.QueryRowContext(ctx, query, args...).Scan(&id)
	if err != nil {
		return nil, err
	}

	// Retrieve the newly created memo
	memo, err := d.GetMemo(ctx, &store.FindMemo{ID: &id})
	if err != nil {
		return nil, err
	}
	if memo == nil {
		return nil, errors.Errorf("failed to create memo")
	}

	return memo, nil
}

func (d *DB) ListMemos(ctx context.Context, find *store.FindMemo) ([]*store.Memo, error) {
	// Start building the SELECT statement
	builder := squirrel.Select(
		"memo.id AS id",
		"memo.creator_id AS creator_id",
		"memo.created_ts AS created_ts",
		"memo.updated_ts AS updated_ts",
		"memo.row_status AS row_status",
		"memo.content AS content",
		"memo.visibility AS visibility",
		"MAX(CASE WHEN memo_organizer.pinned = 1 THEN 1 ELSE 0 END) AS pinned").
		From("memo").
		LeftJoin("memo_organizer ON memo.id = memo_organizer.memo_id").
		LeftJoin("resource ON memo.id = resource.memo_id").
		GroupBy("memo.id").
		PlaceholderFormat(squirrel.Dollar)

	// Add conditional where clauses
	if v := find.ID; v != nil {
		builder = builder.Where("memo.id = ?", *v)
	}
	if v := find.CreatorID; v != nil {
		builder = builder.Where("memo.creator_id = ?", *v)
	}
	if v := find.RowStatus; v != nil {
		builder = builder.Where("memo.row_status = ?", *v)
	}
	if v := find.CreatedTsBefore; v != nil {
		builder = builder.Where("memo.created_ts < ?", *v)
	}
	if v := find.CreatedTsAfter; v != nil {
		builder = builder.Where("memo.created_ts > ?", *v)
	}
	if v := find.Pinned; v != nil {
		builder = builder.Where("memo_organizer.pinned = 1")
	}
	if v := find.ContentSearch; len(v) != 0 {
		for _, s := range v {
			builder = builder.Where("memo.content LIKE ?", "%"+s+"%")
		}
	}

	if v := find.VisibilityList; len(v) != 0 {
		placeholders := make([]string, len(v))
		args := make([]any, len(v))
		for i, visibility := range v {
			placeholders[i] = "?"
			args[i] = visibility // Assuming visibility can be directly used as an argument
		}
		inClause := strings.Join(placeholders, ",")
		builder = builder.Where("memo.visibility IN ("+inClause+")", args...)
	}
	// Add order by clauses
	if find.OrderByPinned {
		builder = builder.OrderBy("pinned DESC")
	}
	if find.OrderByUpdatedTs {
		builder = builder.OrderBy("updated_ts DESC")
	} else {
		builder = builder.OrderBy("created_ts DESC")
	}
	builder = builder.OrderBy("id DESC")

	// Handle pagination
	if find.Limit != nil {
		builder = builder.Limit(uint64(*find.Limit))
		if find.Offset != nil {
			builder = builder.Offset(uint64(*find.Offset))
		}
	}

	// Prepare and execute the query
	query, args, err := builder.ToSql()
	if err != nil {
		return nil, err
	}

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// Process the result set
	list := make([]*store.Memo, 0)
	for rows.Next() {
		var memo store.Memo
		if err := rows.Scan(
			&memo.ID,
			&memo.CreatorID,
			&memo.CreatedTs,
			&memo.UpdatedTs,
			&memo.RowStatus,
			&memo.Content,
			&memo.Visibility,
			&memo.Pinned,
		); err != nil {
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
	// Start building the update statement
	builder := squirrel.Update("memo").
		PlaceholderFormat(squirrel.Dollar).
		Where("id = ?", update.ID)

	// Conditionally add set clauses
	if v := update.CreatedTs; v != nil {
		builder = builder.Set("created_ts", *v)
	}
	if v := update.UpdatedTs; v != nil {
		builder = builder.Set("updated_ts", *v)
	}
	if v := update.RowStatus; v != nil {
		builder = builder.Set("row_status", *v)
	}
	if v := update.Content; v != nil {
		builder = builder.Set("content", *v)
	}
	if v := update.Visibility; v != nil {
		builder = builder.Set("visibility", *v)
	}

	// Prepare and execute the query
	query, args, err := builder.ToSql()
	if err != nil {
		return err
	}

	if _, err := d.db.ExecContext(ctx, query, args...); err != nil {
		return err
	}

	return nil
}

func (d *DB) DeleteMemo(ctx context.Context, delete *store.DeleteMemo) error {
	// Start building the DELETE statement
	builder := squirrel.Delete("memo").
		PlaceholderFormat(squirrel.Dollar).
		Where(squirrel.Eq{"id": delete.ID})

	// Prepare the final query
	query, args, err := builder.ToSql()
	if err != nil {
		return err
	}

	// Execute the query with the context
	result, err := d.db.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}

	if _, err := result.RowsAffected(); err != nil {
		return err
	}

	// Perform any additional cleanup or operations such as vacuuming
	// irving: wait, why do we need to vacuum here?
	// I don't know why delete memo needs to vacuum. so I commented out.
	// REVIEWERS LOOK AT ME: please check this.

	return d.Vacuum(ctx)
}

func (d *DB) FindMemosVisibilityList(ctx context.Context, memoIDs []int32) ([]store.Visibility, error) {
	// Start building the SELECT statement
	builder := squirrel.Select("DISTINCT(visibility)").From("memo").
		PlaceholderFormat(squirrel.Dollar).
		Where(squirrel.Eq{"id": memoIDs})

	// Prepare the final query
	query, args, err := builder.ToSql()
	if err != nil {
		return nil, err
	}

	// Execute the query with the context
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	visibilityList := make([]store.Visibility, 0)
	for rows.Next() {
		var visibility store.Visibility
		if err := rows.Scan(&visibility); err != nil {
			return nil, err
		}
		visibilityList = append(visibilityList, visibility)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return visibilityList, nil
}

func vacuumMemo(ctx context.Context, tx *sql.Tx) error {
	// First, build the subquery
	subQuery, subArgs, err := squirrel.Select("id").From("user").PlaceholderFormat(squirrel.Dollar).ToSql()
	if err != nil {
		return err
	}

	// Now, build the main delete query using the subquery
	query, args, err := squirrel.Delete("memo").
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
