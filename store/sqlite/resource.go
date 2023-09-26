package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"

	"github.com/usememos/memos/store"
)

func (d *Driver) CreateResource(ctx context.Context, create *store.Resource) (*store.Resource, error) {
	stmt := `
		INSERT INTO resource (
			filename,
			blob,
			external_link,
			type,
			size,
			creator_id,
			internal_path
		)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		RETURNING id, created_ts, updated_ts
	`
	if err := d.db.QueryRowContext(
		ctx,
		stmt,
		create.Filename,
		create.Blob,
		create.ExternalLink,
		create.Type,
		create.Size,
		create.CreatorID,
		create.InternalPath,
	).Scan(&create.ID, &create.CreatedTs, &create.UpdatedTs); err != nil {
		return nil, err
	}

	return create, nil
}

func (d *Driver) ListResources(ctx context.Context, find *store.FindResource) ([]*store.Resource, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.ID; v != nil {
		where, args = append(where, "resource.id = ?"), append(args, *v)
	}
	if v := find.CreatorID; v != nil {
		where, args = append(where, "resource.creator_id = ?"), append(args, *v)
	}
	if v := find.Filename; v != nil {
		where, args = append(where, "resource.filename = ?"), append(args, *v)
	}
	if v := find.MemoID; v != nil {
		where, args = append(where, "resource.id in (SELECT resource_id FROM memo_resource WHERE memo_id = ?)"), append(args, *v)
	}
	if find.HasRelatedMemo {
		where = append(where, "memo_resource.memo_id IS NOT NULL")
	}

	fields := []string{"resource.id", "resource.filename", "resource.external_link", "resource.type", "resource.size", "resource.creator_id", "resource.created_ts", "resource.updated_ts", "internal_path"}
	if find.GetBlob {
		fields = append(fields, "resource.blob")
	}

	query := fmt.Sprintf(`
		SELECT
			GROUP_CONCAT(memo_resource.memo_id) as related_memo_ids,
			%s
		FROM resource
		LEFT JOIN memo_resource ON resource.id = memo_resource.resource_id
		WHERE %s
		GROUP BY resource.id
		ORDER BY resource.created_ts DESC
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
		var relatedMemoIDs sql.NullString
		dests := []any{
			&relatedMemoIDs,
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
		if find.GetBlob {
			dests = append(dests, &resource.Blob)
		}
		if err := rows.Scan(dests...); err != nil {
			return nil, err
		}
		if relatedMemoIDs.Valid {
			relatedMemoIDList := strings.Split(relatedMemoIDs.String, ",")
			if len(relatedMemoIDList) > 0 {
				// Only take the first related memo ID.
				relatedMemoIDInt, err := strconv.ParseInt(relatedMemoIDList[0], 10, 32)
				if err != nil {
					return nil, err
				}
				relatedMemoID := int32(relatedMemoIDInt)
				resource.RelatedMemoID = &relatedMemoID
			}
		}
		list = append(list, &resource)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (d *Driver) UpdateResource(ctx context.Context, update *store.UpdateResource) (*store.Resource, error) {
	set, args := []string{}, []any{}

	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "updated_ts = ?"), append(args, *v)
	}
	if v := update.Filename; v != nil {
		set, args = append(set, "filename = ?"), append(args, *v)
	}
	if v := update.InternalPath; v != nil {
		set, args = append(set, "internal_path = ?"), append(args, *v)
	}
	if v := update.Blob; v != nil {
		set, args = append(set, "blob = ?"), append(args, v)
	}

	args = append(args, update.ID)
	fields := []string{"id", "filename", "external_link", "type", "size", "creator_id", "created_ts", "updated_ts", "internal_path"}
	stmt := `
		UPDATE resource
		SET ` + strings.Join(set, ", ") + `
		WHERE id = ?
		RETURNING ` + strings.Join(fields, ", ")
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

func (d *Driver) DeleteResource(ctx context.Context, delete *store.DeleteResource) error {
	stmt := `
		DELETE FROM resource
		WHERE id = ?
	`
	result, err := d.db.ExecContext(ctx, stmt, delete.ID)
	if err != nil {
		return err
	}
	if _, err := result.RowsAffected(); err != nil {
		return err
	}

	return nil
}
