package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateResource(ctx context.Context, create *store.Resource) (*store.Resource, error) {
	fields := []string{"filename", "blob", "external_link", "type", "size", "creator_id", "internal_path", "memo_id"}
	args := []any{create.Filename, create.Blob, create.ExternalLink, create.Type, create.Size, create.CreatorID, create.InternalPath, create.MemoID}

	stmt := "INSERT INTO resource (" + strings.Join(fields, ", ") + ") VALUES (" + placeholders(len(args)) + ") RETURNING id, created_ts, updated_ts"
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(&create.ID, &create.CreatedTs, &create.UpdatedTs); err != nil {
		return nil, err
	}
	return create, nil
}

func (d *DB) ListResources(ctx context.Context, find *store.FindResource) ([]*store.Resource, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.ID; v != nil {
		where, args = append(where, "id = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.CreatorID; v != nil {
		where, args = append(where, "creator_id = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.Filename; v != nil {
		where, args = append(where, "filename = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.MemoID; v != nil {
		where, args = append(where, "memo_id = "+placeholder(len(args)+1)), append(args, *v)
	}
	if find.HasRelatedMemo {
		where = append(where, "memo_id IS NOT NULL")
	}

	fields := []string{"id", "filename", "external_link", "type", "size", "creator_id", "created_ts", "updated_ts", "internal_path", "memo_id"}
	if find.GetBlob {
		fields = append(fields, "blob")
	}

	query := fmt.Sprintf(`
		SELECT
			%s
		FROM resource
		WHERE %s
		ORDER BY updated_ts DESC, created_ts DESC
	`, strings.Join(fields, ", "), strings.Join(where, " AND "))
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
	set, args := []string{}, []any{}

	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "updated_ts = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.Filename; v != nil {
		set, args = append(set, "filename = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.InternalPath; v != nil {
		set, args = append(set, "internal_path = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.MemoID; v != nil {
		set, args = append(set, "memo_id = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.Blob; v != nil {
		set, args = append(set, "blob = "+placeholder(len(args)+1)), append(args, v)
	}

	fields := []string{"id", "filename", "external_link", "type", "size", "creator_id", "created_ts", "updated_ts", "internal_path"}
	stmt := `
	UPDATE resource
	SET ` + strings.Join(set, ", ") + `
	WHERE id = ` + placeholder(len(args)+1) + `
	RETURNING ` + strings.Join(fields, ", ")
	args = append(args, update.ID)
	resource := store.Resource{}
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
	}
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(dests...); err != nil {
		return nil, err
	}

	return &resource, nil
}

func (d *DB) DeleteResource(ctx context.Context, delete *store.DeleteResource) error {
	stmt := `DELETE FROM resource WHERE id = $1`
	result, err := d.db.ExecContext(ctx, stmt, delete.ID)
	if err != nil {
		return err
	}
	if _, err := result.RowsAffected(); err != nil {
		return err
	}
	return nil
}

func vacuumResource(ctx context.Context, tx *sql.Tx) error {
	stmt := `
	DELETE FROM 
		resource 
	WHERE 
		creator_id NOT IN (SELECT id FROM "user")`
	_, err := tx.ExecContext(ctx, stmt)
	if err != nil {
		return err
	}

	return nil
}
