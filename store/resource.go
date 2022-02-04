package store

import (
	"fmt"
	"memos/api"
	"memos/common"
	"strings"
)

type ResourceService struct {
	db *DB
}

func NewResourceService(db *DB) *ResourceService {
	return &ResourceService{db: db}
}

func (s *ResourceService) CreateResource(create *api.ResourceCreate) (*api.Resource, error) {
	resource, err := createResource(s.db, create)
	if err != nil {
		return nil, err
	}

	return resource, nil
}

func (s *ResourceService) FindResourceList(find *api.ResourceFind) ([]*api.Resource, error) {
	list, err := findResourceList(s.db, find)
	if err != nil {
		return nil, err
	}

	return list, nil
}

func (s *ResourceService) FindResource(find *api.ResourceFind) (*api.Resource, error) {
	list, err := findResourceList(s.db, find)
	if err != nil {
		return nil, err
	}

	if len(list) == 0 {
		return nil, &common.Error{Code: common.NotFound, Err: fmt.Errorf("not found")}
	}

	return list[0], nil
}

func (s *ResourceService) DeleteResource(delete *api.ResourceDelete) error {
	err := deleteResource(s.db, delete)
	if err != nil {
		return err
	}

	return nil
}

func createResource(db *DB, create *api.ResourceCreate) (*api.Resource, error) {
	row, err := db.Db.Query(`
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
		create.CreatorId,
	)
	if err != nil {
		return nil, FormatError(err)
	}
	defer row.Close()

	if !row.Next() {
		return nil, &common.Error{Code: common.NotFound, Err: fmt.Errorf("not found")}
	}

	var resource api.Resource
	if err := row.Scan(
		&resource.Id,
		&resource.Filename,
		&resource.Blob,
		&resource.Type,
		&resource.Size,
		&resource.CreatedTs,
		&resource.UpdatedTs,
	); err != nil {
		return nil, FormatError(err)
	}

	return &resource, nil
}

func findResourceList(db *DB, find *api.ResourceFind) ([]*api.Resource, error) {
	where, args := []string{"1 = 1"}, []interface{}{}
	if v := find.Id; v != nil {
		where, args = append(where, "id = ?"), append(args, *v)
	}
	if v := find.CreatorId; v != nil {
		where, args = append(where, "creator_id = ?"), append(args, *v)
	}
	if v := find.Filename; v != nil {
		where, args = append(where, "filename = ?"), append(args, *v)
	}

	rows, err := db.Db.Query(`
		SELECT
			id,
			filename,
			blob,
			type,
			size,
			created_ts,
			updated_ts
		FROM resource
		WHERE `+strings.Join(where, " AND "),
		args...,
	)
	if err != nil {
		return nil, FormatError(err)
	}
	defer rows.Close()

	list := make([]*api.Resource, 0)
	for rows.Next() {
		var resource api.Resource
		if err := rows.Scan(
			&resource.Id,
			&resource.Filename,
			&resource.Blob,
			&resource.Type,
			&resource.Size,
			&resource.CreatedTs,
			&resource.UpdatedTs,
		); err != nil {
			return nil, FormatError(err)
		}

		list = append(list, &resource)
	}

	if err := rows.Err(); err != nil {
		return nil, FormatError(err)
	}

	return list, nil
}

func deleteResource(db *DB, delete *api.ResourceDelete) error {
	result, err := db.Db.Exec(`DELETE FROM resource WHERE id = ?`, delete.Id)
	if err != nil {
		return FormatError(err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return &common.Error{Code: common.NotFound, Err: fmt.Errorf("resource ID not found: %d", delete.Id)}
	}

	return nil
}
