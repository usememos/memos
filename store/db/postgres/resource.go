package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/Masterminds/squirrel"
	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateResource(ctx context.Context, create *store.Resource) (*store.Resource, error) {
	qb := squirrel.Insert("resource").Columns("filename", "blob", "external_link", "type", "size", "creator_id", "internal_path", "memo_id")
	values := []any{create.Filename, create.Blob, create.ExternalLink, create.Type, create.Size, create.CreatorID, create.InternalPath, create.MemoID}

	qb = qb.Values(values...).Suffix("RETURNING id")
	query, args, err := qb.PlaceholderFormat(squirrel.Dollar).ToSql()
	if err != nil {
		return nil, err
	}

	var id int32
	err = d.db.QueryRowContext(ctx, query, args...).Scan(&id)
	if err != nil {
		return nil, err
	}

	list, err := d.ListResources(ctx, &store.FindResource{ID: &id})
	if err != nil {
		return nil, err
	}
	if len(list) != 1 {
		return nil, errors.Wrapf(nil, "unexpected resource count: %d", len(list))
	}

	return list[0], nil
}

func (d *DB) ListResources(ctx context.Context, find *store.FindResource) ([]*store.Resource, error) {
	qb := squirrel.Select("id", "filename", "external_link", "type", "size", "creator_id", "created_ts", "updated_ts", "internal_path", "memo_id").From("resource")

	if v := find.ID; v != nil {
		qb = qb.Where(squirrel.Eq{"id": *v})
	}
	if v := find.CreatorID; v != nil {
		qb = qb.Where(squirrel.Eq{"creator_id": *v})
	}
	if v := find.Filename; v != nil {
		qb = qb.Where(squirrel.Eq{"filename": *v})
	}
	if v := find.MemoID; v != nil {
		qb = qb.Where(squirrel.Eq{"memo_id": *v})
	}
	if find.HasRelatedMemo {
		qb = qb.Where("memo_id IS NOT NULL")
	}
	if find.GetBlob {
		qb = qb.Columns("blob")
	}

	qb = qb.GroupBy("id").OrderBy("created_ts DESC")

	if find.Limit != nil {
		qb = qb.Limit(uint64(*find.Limit))
		if find.Offset != nil {
			qb = qb.Offset(uint64(*find.Offset))
		}
	}

	query, args, err := qb.PlaceholderFormat(squirrel.Dollar).ToSql()
	if err != nil {
		return nil, err
	}

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]*store.Resource, 0)
	for rows.Next() {
		resource := store.Resource{}
		var memoID sql.NullInt32
		dests := []any{
			&resource.ID,
			&resource.Filename,
			&resource.ExternalLink,
			&resource.Type,
			&resource.Size,
			&resource.CreatorID,
			&resource.CreatedTs,
			&resource.UpdatedTs,
			&resource.InternalPath,
			&memoID,
		}
		if find.GetBlob {
			dests = append(dests, &resource.Blob)
		}
		if err := rows.Scan(dests...); err != nil {
			return nil, err
		}

		if memoID.Valid {
			resource.MemoID = &memoID.Int32
		}
		list = append(list, &resource)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (d *DB) UpdateResource(ctx context.Context, update *store.UpdateResource) (*store.Resource, error) {
	qb := squirrel.Update("resource")

	if v := update.UpdatedTs; v != nil {
		qb = qb.Set("updated_ts", time.Unix(0, *v))
	}
	if v := update.Filename; v != nil {
		qb = qb.Set("filename", *v)
	}
	if v := update.InternalPath; v != nil {
		qb = qb.Set("internal_path", *v)
	}
	if v := update.MemoID; v != nil {
		qb = qb.Set("memo_id", *v)
	}
	if v := update.Blob; v != nil {
		qb = qb.Set("blob", v)
	}

	qb = qb.Where(squirrel.Eq{"id": update.ID})

	query, args, err := qb.PlaceholderFormat(squirrel.Dollar).ToSql()
	if err != nil {
		return nil, err
	}

	if _, err := d.db.ExecContext(ctx, query, args...); err != nil {
		return nil, err
	}

	list, err := d.ListResources(ctx, &store.FindResource{ID: &update.ID})
	if err != nil {
		return nil, err
	}
	if len(list) != 1 {
		return nil, errors.Wrapf(nil, "unexpected resource count: %d", len(list))
	}

	return list[0], nil
}

func (d *DB) DeleteResource(ctx context.Context, delete *store.DeleteResource) error {
	qb := squirrel.Delete("resource").Where(squirrel.Eq{"id": delete.ID})

	query, args, err := qb.PlaceholderFormat(squirrel.Dollar).ToSql()
	if err != nil {
		return err
	}

	result, err := d.db.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}

	if _, err := result.RowsAffected(); err != nil {
		return err
	}

	if err := d.Vacuum(ctx); err != nil {
		// Prevent linter warning.
		return err
	}

	return nil
}

func vacuumResource(ctx context.Context, tx *sql.Tx) error {
	// First, build the subquery
	subQuery, subArgs, err := squirrel.Select("id").From(`"user"`).PlaceholderFormat(squirrel.Dollar).ToSql()
	if err != nil {
		return err
	}

	// Now, build the main delete query using the subquery
	query, args, err := squirrel.Delete("resource").
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
