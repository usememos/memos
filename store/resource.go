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
	Filename string
	Blob     []byte
	Type     string
	Size     int64
}

func (raw *resourceRaw) toResource() *api.Resource {
	return &api.Resource{
		ID: raw.ID,

		// Standard fields
		CreatorID: raw.CreatorID,
		CreatedTs: raw.CreatedTs,
		UpdatedTs: raw.UpdatedTs,

		// Domain specific fields
		Filename: raw.Filename,
		Blob:     raw.Blob,
		Type:     raw.Type,
		Size:     raw.Size,
	}
}

func (s *Store) CreateResource(ctx context.Context, create *api.ResourceCreate) (*api.Resource, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	resourceRaw, err := createResource(ctx, tx, create)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, FormatError(err)
	}

	resource := resourceRaw.toResource()

	if err := s.cache.UpsertCache(api.ResourceCache, resource.ID, resource); err != nil {
		return nil, err
	}

	return resource, nil
}

func (s *Store) FindResourceList(ctx context.Context, find *api.ResourceFind) ([]*api.Resource, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	resourceRawList, err := findResourceList(ctx, tx, find)
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
	if find.ID != nil {
		resource := &api.Resource{}
		has, err := s.cache.FindCache(api.ResourceCache, *find.ID, resource)
		if err != nil {
			return nil, err
		}
		if has {
			return resource, nil
		}
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	list, err := findResourceList(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	if len(list) == 0 {
		return nil, &common.Error{Code: common.NotFound, Err: fmt.Errorf("not found")}
	}

	resource := list[0].toResource()

	if err := s.cache.UpsertCache(api.ResourceCache, resource.ID, resource); err != nil {
		return nil, err
	}

	return resource, nil
}

func (s *Store) DeleteResource(ctx context.Context, delete *api.ResourceDelete) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return FormatError(err)
	}
	defer tx.Rollback()

	err = deleteResource(ctx, tx, delete)
	if err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return FormatError(err)
	}

	s.cache.DeleteCache(api.ResourceCache, delete.ID)

	return nil
}

func createResource(ctx context.Context, tx *sql.Tx, create *api.ResourceCreate) (*resourceRaw, error) {
	query := `
		INSERT INTO resource (
			filename,
			blob,
			type,
			size,
			creator_id
		)
		VALUES (?, ?, ?, ?, ?)
		RETURNING id, filename, blob, type, size, creator_id, created_ts, updated_ts
	`
	var resourceRaw resourceRaw
	if err := tx.QueryRowContext(ctx, query, create.Filename, create.Blob, create.Type, create.Size, create.CreatorID).Scan(
		&resourceRaw.ID,
		&resourceRaw.Filename,
		&resourceRaw.Blob,
		&resourceRaw.Type,
		&resourceRaw.Size,
		&resourceRaw.CreatorID,
		&resourceRaw.CreatedTs,
		&resourceRaw.UpdatedTs,
	); err != nil {
		return nil, FormatError(err)
	}

	return &resourceRaw, nil
}

func findResourceList(ctx context.Context, tx *sql.Tx, find *api.ResourceFind) ([]*resourceRaw, error) {
	where, args := []string{"1 = 1"}, []interface{}{}

	if v := find.ID; v != nil {
		where, args = append(where, "id = ?"), append(args, *v)
	}
	if v := find.CreatorID; v != nil {
		where, args = append(where, "creator_id = ?"), append(args, *v)
	}
	if v := find.Filename; v != nil {
		where, args = append(where, "filename = ?"), append(args, *v)
	}

	query := `
		SELECT
			id,
			filename,
			blob,
			type,
			size,
			creator_id,
			created_ts,
			updated_ts
		FROM resource
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_ts DESC
	`
	rows, err := tx.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, FormatError(err)
	}
	defer rows.Close()

	resourceRawList := make([]*resourceRaw, 0)
	for rows.Next() {
		var resourceRaw resourceRaw
		if err := rows.Scan(
			&resourceRaw.ID,
			&resourceRaw.Filename,
			&resourceRaw.Blob,
			&resourceRaw.Type,
			&resourceRaw.Size,
			&resourceRaw.CreatorID,
			&resourceRaw.CreatedTs,
			&resourceRaw.UpdatedTs,
		); err != nil {
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
	_, err := tx.ExecContext(ctx, `
		PRAGMA foreign_keys = ON;
		DELETE FROM resource WHERE id = ? AND creator_id = ?
	`, delete.ID, delete.CreatorID)
	if err != nil {
		return FormatError(err)
	}

	return nil
}
