package store

import (
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

func (s *Store) CreateResource(create *api.ResourceCreate) (*api.Resource, error) {
	resourceRaw, err := createResource(s.db, create)
	if err != nil {
		return nil, err
	}

	resource := resourceRaw.toResource()

	return resource, nil
}

func (s *Store) FindResourceList(find *api.ResourceFind) ([]*api.Resource, error) {
	resourceRawList, err := findResourceList(s.db, find)
	if err != nil {
		return nil, err
	}

	resourceList := []*api.Resource{}
	for _, raw := range resourceRawList {
		resourceList = append(resourceList, raw.toResource())
	}

	return resourceList, nil
}

func (s *Store) FindResource(find *api.ResourceFind) (*api.Resource, error) {
	list, err := findResourceList(s.db, find)
	if err != nil {
		return nil, err
	}

	if len(list) == 0 {
		return nil, &common.Error{Code: common.NotFound, Err: fmt.Errorf("not found")}
	}

	resource := list[0].toResource()

	return resource, nil
}

func (s *Store) DeleteResource(delete *api.ResourceDelete) error {
	err := deleteResource(s.db, delete)
	if err != nil {
		return err
	}

	return nil
}

func createResource(db *sql.DB, create *api.ResourceCreate) (*resourceRaw, error) {
	row, err := db.Query(`
		INSERT INTO resource (
			filename,
			blob,
			type,
			size,
			creator_id
		)
		VALUES (?, ?, ?, ?, ?)
		RETURNING id, filename, blob, type, size, created_ts, updated_ts
	`,
		create.Filename,
		create.Blob,
		create.Type,
		create.Size,
		create.CreatorID,
	)
	if err != nil {
		return nil, FormatError(err)
	}
	defer row.Close()

	row.Next()
	var resourceRaw resourceRaw
	if err := row.Scan(
		&resourceRaw.ID,
		&resourceRaw.Filename,
		&resourceRaw.Blob,
		&resourceRaw.Type,
		&resourceRaw.Size,
		&resourceRaw.CreatedTs,
		&resourceRaw.UpdatedTs,
	); err != nil {
		return nil, FormatError(err)
	}

	return &resourceRaw, nil
}

func findResourceList(db *sql.DB, find *api.ResourceFind) ([]*resourceRaw, error) {
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

	rows, err := db.Query(`
		SELECT
			id,
			filename,
			blob,
			type,
			size,
			created_ts,
			updated_ts
		FROM resource
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY created_ts DESC`,
		args...,
	)
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

func deleteResource(db *sql.DB, delete *api.ResourceDelete) error {
	result, err := db.Exec(`DELETE FROM resource WHERE id = ?`, delete.ID)
	if err != nil {
		return FormatError(err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return &common.Error{Code: common.NotFound, Err: fmt.Errorf("resource ID not found: %d", delete.ID)}
	}

	return nil
}
