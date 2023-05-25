package store

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
)

// resourceRaw is the store model for an Resource.
// Fields have exactly the same meanings as Resource.
type resourceRaw struct {
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

func (raw *resourceRaw) toResource() *api.Resource {
	return &api.Resource{
		ID: raw.ID,

		// Standard fields
		CreatorID: raw.CreatorID,
		CreatedTs: raw.CreatedTs,
		UpdatedTs: raw.UpdatedTs,

		// Domain specific fields
		Filename:         raw.Filename,
		Blob:             raw.Blob,
		InternalPath:     raw.InternalPath,
		ExternalLink:     raw.ExternalLink,
		Type:             raw.Type,
		Size:             raw.Size,
		PublicID:         raw.PublicID,
		LinkedMemoAmount: raw.LinkedMemoAmount,
	}
}

func (s *Store) CreateResource(ctx context.Context, create *api.ResourceCreate) (*api.Resource, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	resourceRaw, err := createResourceImpl(ctx, tx, create)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, FormatError(err)
	}

	resource := resourceRaw.toResource()

	return resource, nil
}

func (s *Store) FindResourceList(ctx context.Context, find *api.ResourceFind) ([]*api.Resource, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	resourceRawList, err := findResourceListImpl(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	resourceList := []*api.Resource{}
	for _, raw := range resourceRawList {
		resourceList = append(resourceList, raw.toResource())
	}

	return resourceList, nil
}

func (s *Store) FindResource(ctx context.Context, find *api.ResourceFind) (*api.Resource, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	list, err := findResourceListImpl(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	if len(list) == 0 {
		return nil, &common.Error{Code: common.NotFound, Err: fmt.Errorf("not found")}
	}

	resourceRaw := list[0]
	resource := resourceRaw.toResource()

	return resource, nil
}

func (s *Store) DeleteResource(ctx context.Context, delete *api.ResourceDelete) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return FormatError(err)
	}
	defer tx.Rollback()

	if err := deleteResource(ctx, tx, delete); err != nil {
		return err
	}
	if err := s.vacuumImpl(ctx, tx); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return FormatError(err)
	}

	return nil
}

func (s *Store) PatchResource(ctx context.Context, patch *api.ResourcePatch) (*api.Resource, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	resourceRaw, err := patchResourceImpl(ctx, tx, patch)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, FormatError(err)
	}

	resource := resourceRaw.toResource()

	return resource, nil
}

func createResourceImpl(ctx context.Context, tx *sql.Tx, create *api.ResourceCreate) (*resourceRaw, error) {
	fields := []string{"filename", "blob", "external_link", "type", "size", "creator_id", "internal_path", "public_id"}
	values := []any{create.Filename, create.Blob, create.ExternalLink, create.Type, create.Size, create.CreatorID, create.InternalPath, create.PublicID}
	placeholders := []string{"?", "?", "?", "?", "?", "?", "?", "?"}
	query := `
		INSERT INTO resource (
			` + strings.Join(fields, ",") + `
		)
		VALUES (` + strings.Join(placeholders, ",") + `)
		RETURNING id, ` + strings.Join(fields, ",") + `, created_ts, updated_ts
	`
	var resourceRaw resourceRaw
	dests := []any{
		&resourceRaw.ID,
		&resourceRaw.Filename,
		&resourceRaw.Blob,
		&resourceRaw.ExternalLink,
		&resourceRaw.Type,
		&resourceRaw.Size,
		&resourceRaw.CreatorID,
		&resourceRaw.InternalPath,
		&resourceRaw.PublicID,
	}
	dests = append(dests, []any{&resourceRaw.CreatedTs, &resourceRaw.UpdatedTs}...)
	if err := tx.QueryRowContext(ctx, query, values...).Scan(dests...); err != nil {
		return nil, FormatError(err)
	}

	return &resourceRaw, nil
}

func patchResourceImpl(ctx context.Context, tx *sql.Tx, patch *api.ResourcePatch) (*resourceRaw, error) {
	set, args := []string{}, []any{}

	if v := patch.UpdatedTs; v != nil {
		set, args = append(set, "updated_ts = ?"), append(args, *v)
	}
	if v := patch.Filename; v != nil {
		set, args = append(set, "filename = ?"), append(args, *v)
	}
	if v := patch.PublicID; v != nil {
		set, args = append(set, "public_id = ?"), append(args, *v)
	}

	args = append(args, patch.ID)
	fields := []string{"id", "filename", "external_link", "type", "size", "creator_id", "created_ts", "updated_ts", "internal_path", "public_id"}
	query := `
		UPDATE resource
		SET ` + strings.Join(set, ", ") + `
		WHERE id = ?
		RETURNING ` + strings.Join(fields, ", ")
	var resourceRaw resourceRaw
	dests := []any{
		&resourceRaw.ID,
		&resourceRaw.Filename,
		&resourceRaw.ExternalLink,
		&resourceRaw.Type,
		&resourceRaw.Size,
		&resourceRaw.CreatorID,
		&resourceRaw.CreatedTs,
		&resourceRaw.UpdatedTs,
		&resourceRaw.InternalPath,
		&resourceRaw.PublicID,
	}
	if err := tx.QueryRowContext(ctx, query, args...).Scan(dests...); err != nil {
		return nil, FormatError(err)
	}

	return &resourceRaw, nil
}

func findResourceListImpl(ctx context.Context, tx *sql.Tx, find *api.ResourceFind) ([]*resourceRaw, error) {
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
		return nil, FormatError(err)
	}
	defer rows.Close()

	resourceRawList := make([]*resourceRaw, 0)
	for rows.Next() {
		var resourceRaw resourceRaw
		dests := []any{
			&resourceRaw.LinkedMemoAmount,
			&resourceRaw.ID,
			&resourceRaw.Filename,
			&resourceRaw.ExternalLink,
			&resourceRaw.Type,
			&resourceRaw.Size,
			&resourceRaw.CreatorID,
			&resourceRaw.CreatedTs,
			&resourceRaw.UpdatedTs,
			&resourceRaw.InternalPath,
			&resourceRaw.PublicID,
		}
		if find.GetBlob {
			dests = append(dests, &resourceRaw.Blob)
		}
		if err := rows.Scan(dests...); err != nil {
			return nil, FormatError(err)
		}
		resourceRawList = append(resourceRawList, &resourceRaw)
	}

	if err := rows.Err(); err != nil {
		return nil, FormatError(err)
	}

	return resourceRawList, nil
}

func deleteResource(ctx context.Context, tx *sql.Tx, delete *api.ResourceDelete) error {
	where, args := []string{"id = ?"}, []any{delete.ID}

	stmt := `DELETE FROM resource WHERE ` + strings.Join(where, " AND ")
	result, err := tx.ExecContext(ctx, stmt, args...)
	if err != nil {
		return FormatError(err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return &common.Error{Code: common.NotFound, Err: fmt.Errorf("resource not found")}
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
		return FormatError(err)
	}

	return nil
}
