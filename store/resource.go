package store

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

type Resource struct {
	ID int

	// Standard fields
	CreatorID int
	CreatedTs int64
	UpdatedTs int64

	// Domain specific fields
	Filename         string
	Blob             []byte
	InternalPath     string
	ExternalLink     string
	Type             string
	Size             int64
	PublicID         string
	LinkedMemoAmount int
}

type FindResource struct {
	GetBlob   bool
	ID        *int
	CreatorID *int
	Filename  *string
	MemoID    *int
	PublicID  *string
	Limit     *int
	Offset    *int
}

type UpdateResource struct {
	ID        int
	UpdatedTs *int64
	Filename  *string
	PublicID  *string
}

type DeleteResource struct {
	ID int
}

func (s *Store) CreateResource(ctx context.Context, create *Resource) (*Resource, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if err := tx.QueryRowContext(ctx, `
		INSERT INTO resource (
			filename,
			blob,
			external_link,
			type,
			size,
			creator_id,
			internal_path,
			public_id
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		RETURNING id, created_ts, updated_ts
	`,
		create.Filename, create.Blob, create.ExternalLink, create.Type, create.Size, create.CreatorID, create.InternalPath, create.PublicID,
	).Scan(&create.ID, &create.CreatedTs, &create.UpdatedTs); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	resource := create
	return resource, nil
}

func (s *Store) ListResources(ctx context.Context, find *FindResource) ([]*Resource, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	resources, err := listResources(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return resources, nil
}

func (s *Store) GetResource(ctx context.Context, find *FindResource) (*Resource, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	resources, err := listResources(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	if len(resources) == 0 {
		return nil, nil
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return resources[0], nil
}

func (s *Store) UpdateResource(ctx context.Context, update *UpdateResource) (*Resource, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	set, args := []string{}, []any{}

	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "updated_ts = ?"), append(args, *v)
	}
	if v := update.Filename; v != nil {
		set, args = append(set, "filename = ?"), append(args, *v)
	}
	if v := update.PublicID; v != nil {
		set, args = append(set, "public_id = ?"), append(args, *v)
	}

	args = append(args, update.ID)
	fields := []string{"id", "filename", "external_link", "type", "size", "creator_id", "created_ts", "updated_ts", "internal_path", "public_id"}
	query := `
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
		&resource.PublicID,
	}
	if err := tx.QueryRowContext(ctx, query, args...).Scan(dests...); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &resource, nil
}

func (s *Store) DeleteResource(ctx context.Context, delete *DeleteResource) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `
		DELETE FROM resource
		WHERE id = ?
	`, delete.ID); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		// Prevent linter warning.
		return err
	}

	return nil
}

func listResources(ctx context.Context, tx *sql.Tx, find *FindResource) ([]*Resource, error) {
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
	if v := find.PublicID; v != nil {
		where, args = append(where, "resource.public_id = ?"), append(args, *v)
	}

	fields := []string{"resource.id", "resource.filename", "resource.external_link", "resource.type", "resource.size", "resource.creator_id", "resource.created_ts", "resource.updated_ts", "internal_path", "public_id"}
	if find.GetBlob {
		fields = append(fields, "resource.blob")
	}

	query := fmt.Sprintf(`
		SELECT
		  COUNT(DISTINCT memo_resource.memo_id) AS linked_memo_amount,
			%s
		FROM resource
		LEFT JOIN memo_resource ON resource.id = memo_resource.resource_id
		WHERE %s
		GROUP BY resource.id
		ORDER BY resource.id DESC
	`, strings.Join(fields, ", "), strings.Join(where, " AND "))
	if find.Limit != nil {
		query = fmt.Sprintf("%s LIMIT %d", query, *find.Limit)
		if find.Offset != nil {
			query = fmt.Sprintf("%s OFFSET %d", query, *find.Offset)
		}
	}

	rows, err := tx.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]*Resource, 0)
	for rows.Next() {
		resource := Resource{}
		dests := []any{
			&resource.LinkedMemoAmount,
			&resource.ID,
			&resource.Filename,
			&resource.ExternalLink,
			&resource.Type,
			&resource.Size,
			&resource.CreatorID,
			&resource.CreatedTs,
			&resource.UpdatedTs,
			&resource.InternalPath,
			&resource.PublicID,
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
