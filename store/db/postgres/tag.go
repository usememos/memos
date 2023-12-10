package postgres

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/Masterminds/squirrel"

	"github.com/usememos/memos/store"
)

func (d *DB) UpsertTag(ctx context.Context, upsert *store.Tag) (*store.Tag, error) {
	stmt := "INSERT INTO tag (name, creator_id) VALUES ($1, $2) ON CONFLICT (name, creator_id) DO UPDATE SET name = $3"
	if _, err := d.db.ExecContext(ctx, stmt, upsert.Name, upsert.CreatorID, upsert.Name); err != nil {
		return nil, err
	}
	return upsert, nil
}

func (d *DB) ListTags(ctx context.Context, find *store.FindTag) ([]*store.Tag, error) {
	builder := squirrel.Select("name", "creator_id").From("tag").
		Where("1 = 1").
		OrderBy("name ASC").
		PlaceholderFormat(squirrel.Dollar)

	if find.CreatorID != 0 {
		builder = builder.Where("creator_id = ?", find.CreatorID)
	}

	query, args, err := builder.ToSql()
	if err != nil {
		return nil, err
	}

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []*store.Tag{}
	for rows.Next() {
		tag := &store.Tag{}
		if err := rows.Scan(
			&tag.Name,
			&tag.CreatorID,
		); err != nil {
			return nil, err
		}

		list = append(list, tag)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (d *DB) DeleteTag(ctx context.Context, delete *store.DeleteTag) error {
	builder := squirrel.Delete("tag").
		Where(squirrel.Eq{"name": delete.Name, "creator_id": delete.CreatorID}).
		PlaceholderFormat(squirrel.Dollar)

	query, args, err := builder.ToSql()
	if err != nil {
		return err
	}

	result, err := d.db.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}

	if _, err = result.RowsAffected(); err != nil {
		return err
	}

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
