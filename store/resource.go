package store

import (
	"context"
	"database/sql"
	"fmt"
	"sort"
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
	Filename     string
	Blob         []byte
	ExternalLink string
	Type         string
	Size         int64
}

func (raw *resourceRaw) toResource() *api.Resource {
	return &api.Resource{
		ID: raw.ID,

		// Standard fields
		CreatorID: raw.CreatorID,
		CreatedTs: raw.CreatedTs,
		UpdatedTs: raw.UpdatedTs,

		// Domain specific fields
		Filename:     raw.Filename,
		Blob:         raw.Blob,
		ExternalLink: raw.ExternalLink,
		Type:         raw.Type,
		Size:         raw.Size,
	}
}

func (s *Store) ComposeMemoResourceList(ctx context.Context, memo *api.Memo) error {
	resourceList, err := s.FindResourceList(ctx, &api.ResourceFind{
		MemoID: &memo.ID,
	})
	if err != nil {
		return err
	}

	for _, resource := range resourceList {
		memoResource, err := s.FindMemoResource(ctx, &api.MemoResourceFind{
			MemoID:     &memo.ID,
			ResourceID: &resource.ID,
		})
		if err != nil {
			return err
		}

		resource.CreatedTs = memoResource.CreatedTs
		resource.UpdatedTs = memoResource.UpdatedTs
	}

	sort.Slice(resourceList, func(i, j int) bool {
		if resourceList[i].CreatedTs != resourceList[j].CreatedTs {
			return resourceList[i].CreatedTs < resourceList[j].CreatedTs
		}

		return resourceList[i].ID < resourceList[j].ID
	})

	memo.ResourceList = resourceList

	return nil
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

	if err := s.cache.UpsertCache(api.ResourceCache, resourceRaw.ID, resourceRaw); err != nil {
		return nil, err
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
		resourceRaw := &resourceRaw{}
		has, err := s.cache.FindCache(api.ResourceCache, *find.ID, resourceRaw)
		if err != nil {
			return nil, err
		}
		if has {
			return resourceRaw.toResource(), nil
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

	resourceRaw := list[0]

	if err := s.cache.UpsertCache(api.ResourceCache, resourceRaw.ID, resourceRaw); err != nil {
		return nil, err
	}

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
	if err := vacuum(ctx, tx); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return FormatError(err)
	}

	s.cache.DeleteCache(api.ResourceCache, delete.ID)

	return nil
}

func (s *Store) PatchResource(ctx context.Context, patch *api.ResourcePatch) (*api.Resource, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	resourceRaw, err := patchResource(ctx, tx, patch)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, FormatError(err)
	}

	if err := s.cache.UpsertCache(api.ResourceCache, resourceRaw.ID, resourceRaw); err != nil {
		return nil, err
	}

	resource := resourceRaw.toResource()

	return resource, nil
}

func createResource(ctx context.Context, tx *sql.Tx, create *api.ResourceCreate) (*resourceRaw, error) {
	query := `
		INSERT INTO resource (
			filename,
			blob,
			external_link,
			type,
			size,
			creator_id
		)
		VALUES (?, ?, ?, ?, ?, ?)
		RETURNING id, filename, blob, external_link, type, size, creator_id, created_ts, updated_ts
	`
	var resourceRaw resourceRaw
	if err := tx.QueryRowContext(ctx, query, create.Filename, create.Blob, create.ExternalLink, create.Type, create.Size, create.CreatorID).Scan(
		&resourceRaw.ID,
		&resourceRaw.Filename,
		&resourceRaw.Blob,
		&resourceRaw.ExternalLink,
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

func patchResource(ctx context.Context, tx *sql.Tx, patch *api.ResourcePatch) (*resourceRaw, error) {
	set, args := []string{}, []interface{}{}

	if v := patch.UpdatedTs; v != nil {
		set, args = append(set, "updated_ts = ?"), append(args, *v)
	}
	if v := patch.Filename; v != nil {
		set, args = append(set, "filename = ?"), append(args, *v)
	}

	args = append(args, patch.ID)

	query := `
		UPDATE resource
		SET ` + strings.Join(set, ", ") + `
		WHERE id = ?
		RETURNING id, filename, blob, external_link, type, size, creator_id, created_ts, updated_ts
	`
	var resourceRaw resourceRaw
	if err := tx.QueryRowContext(ctx, query, args...).Scan(
		&resourceRaw.ID,
		&resourceRaw.Filename,
		&resourceRaw.Blob,
		&resourceRaw.ExternalLink,
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
	if v := find.MemoID; v != nil {
		where, args = append(where, "id in (SELECT resource_id FROM memo_resource WHERE memo_id = ?)"), append(args, *v)
	}

	query := `
		SELECT
			id,
			filename,
			blob,
			external_link,
			type,
			size,
			creator_id,
			created_ts,
			updated_ts
		FROM resource
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY id DESC
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
			&resourceRaw.ExternalLink,
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
	where, args := []string{"id = ?"}, []interface{}{delete.ID}

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
