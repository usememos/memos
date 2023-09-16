package store

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

type Resource struct {
	ID int32

	// Standard fields
	CreatorID int32
	CreatedTs int64
	UpdatedTs int64

	// Domain specific fields
	Filename     string
	Blob         []byte
	InternalPath string
	ExternalLink string
	Type         string
	Size         int64

	// Related fields
	RelatedMemoID *int32
}

type FindResource struct {
	GetBlob        bool
	ID             *int32
	CreatorID      *int32
	Filename       *string
	MemoID         *int32
	HasRelatedMemo bool
	Limit          *int
	Offset         *int
}

type UpdateResource struct {
	ID           int32
	UpdatedTs    *int64
	Filename     *string
	InternalPath *string
	Blob         []byte
}

type DeleteResource struct {
	ID int32
}

func (s *Store) CreateResource(ctx context.Context, create *Resource) (*Resource, error) {
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
	if err := s.db.QueryRowContext(
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

	resource := create
	return resource, nil
}

func (s *Store) ListResources(ctx context.Context, find *FindResource) ([]*Resource, error) {
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
			GROUP_CONCAT(memo_resource.memo_id) as related_memo_id,
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

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]*Resource, 0)
	for rows.Next() {
		resource := Resource{}
		dests := []any{
			&resource.RelatedMemoID,
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
		list = append(list, &resource)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (s *Store) GetResource(ctx context.Context, find *FindResource) (*Resource, error) {
	resources, err := s.ListResources(ctx, find)
	if err != nil {
		return nil, err
	}

	if len(resources) == 0 {
		return nil, nil
	}

	return resources[0], nil
}

func (s *Store) UpdateResource(ctx context.Context, update *UpdateResource) (*Resource, error) {
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
	resource := Resource{}
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
	if err := s.db.QueryRowContext(ctx, stmt, args...).Scan(dests...); err != nil {
		return nil, err
	}

	return &resource, nil
}

func (s *Store) DeleteResource(ctx context.Context, delete *DeleteResource) error {
	stmt := `
		DELETE FROM resource
		WHERE id = ?
	`
	result, err := s.db.ExecContext(ctx, stmt, delete.ID)
	if err != nil {
		return err
	}
	if _, err := result.RowsAffected(); err != nil {
		return err
	}
	if err := s.Vacuum(ctx); err != nil {
		// Prevent linter warning.
		return err
	}
	return nil
}

func vacuumResource(ctx context.Context, tx *sql.Tx) error {
	stmt := `
	DELETE FROM 
		resource 
	WHERE 
		creator_id NOT IN (
			SELECT 
				id 
			FROM 
				user
		)`
	_, err := tx.ExecContext(ctx, stmt)
	if err != nil {
		return err
	}

	return nil
}
