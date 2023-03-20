package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
)

type storageRaw struct {
	ID     int
	Name   string
	Type   api.StorageType
	Config *api.StorageConfig
}

func (raw *storageRaw) toStorage() *api.Storage {
	return &api.Storage{
		ID:     raw.ID,
		Name:   raw.Name,
		Type:   raw.Type,
		Config: raw.Config,
	}
}

func (s *Store) CreateStorage(ctx context.Context, create *api.StorageCreate) (*api.Storage, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	storageRaw, err := createStorageRaw(ctx, tx, create)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, FormatError(err)
	}

	return storageRaw.toStorage(), nil
}

func (s *Store) PatchStorage(ctx context.Context, patch *api.StoragePatch) (*api.Storage, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	storageRaw, err := patchStorageRaw(ctx, tx, patch)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, FormatError(err)
	}

	return storageRaw.toStorage(), nil
}

func (s *Store) FindStorageList(ctx context.Context, find *api.StorageFind) ([]*api.Storage, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	storageRawList, err := findStorageRawList(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	list := []*api.Storage{}
	for _, raw := range storageRawList {
		list = append(list, raw.toStorage())
	}

	return list, nil
}

func (s *Store) FindStorage(ctx context.Context, find *api.StorageFind) (*api.Storage, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	list, err := findStorageRawList(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	if len(list) == 0 {
		return nil, &common.Error{Code: common.NotFound, Err: fmt.Errorf("not found")}
	}

	storageRaw := list[0]
	return storageRaw.toStorage(), nil
}

func (s *Store) DeleteStorage(ctx context.Context, delete *api.StorageDelete) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return FormatError(err)
	}
	defer tx.Rollback()

	if err := deleteStorage(ctx, tx, delete); err != nil {
		return FormatError(err)
	}

	if err := tx.Commit(); err != nil {
		return FormatError(err)
	}

	return nil
}

func createStorageRaw(ctx context.Context, tx *sql.Tx, create *api.StorageCreate) (*storageRaw, error) {
	set := []string{"name", "type", "config"}
	args := []any{create.Name, create.Type}
	placeholder := []string{"?", "?", "?"}

	var configBytes []byte
	var err error
	if create.Type == api.StorageS3 {
		configBytes, err = json.Marshal(create.Config.S3Config)
		if err != nil {
			return nil, err
		}
	} else {
		return nil, fmt.Errorf("unsupported storage type %s", string(create.Type))
	}
	args = append(args, string(configBytes))

	query := `
		INSERT INTO storage (
			` + strings.Join(set, ", ") + `
		)
		VALUES (` + strings.Join(placeholder, ",") + `)
		RETURNING id
	`
	storageRaw := storageRaw{
		Name:   create.Name,
		Type:   create.Type,
		Config: create.Config,
	}
	if err := tx.QueryRowContext(ctx, query, args...).Scan(
		&storageRaw.ID,
	); err != nil {
		return nil, FormatError(err)
	}

	return &storageRaw, nil
}

func patchStorageRaw(ctx context.Context, tx *sql.Tx, patch *api.StoragePatch) (*storageRaw, error) {
	set, args := []string{}, []any{}
	if v := patch.Name; v != nil {
		set, args = append(set, "name = ?"), append(args, *v)
	}
	if v := patch.Config; v != nil {
		var configBytes []byte
		var err error
		if patch.Type == api.StorageS3 {
			configBytes, err = json.Marshal(patch.Config.S3Config)
			if err != nil {
				return nil, err
			}
		} else {
			return nil, fmt.Errorf("unsupported storage type %s", string(patch.Type))
		}
		set, args = append(set, "config = ?"), append(args, string(configBytes))
	}
	args = append(args, patch.ID)

	query := `
		UPDATE storage
		SET ` + strings.Join(set, ", ") + `
		WHERE id = ?
		RETURNING id, name, type, config
	`
	var storageRaw storageRaw
	var storageConfig string
	if err := tx.QueryRowContext(ctx, query, args...).Scan(
		&storageRaw.ID,
		&storageRaw.Name,
		&storageRaw.Type,
		&storageConfig,
	); err != nil {
		return nil, FormatError(err)
	}
	if storageRaw.Type == api.StorageS3 {
		s3Config := &api.StorageS3Config{}
		if err := json.Unmarshal([]byte(storageConfig), s3Config); err != nil {
			return nil, err
		}
		storageRaw.Config = &api.StorageConfig{
			S3Config: s3Config,
		}
	} else {
		return nil, fmt.Errorf("unsupported storage type %s", string(storageRaw.Type))
	}

	return &storageRaw, nil
}

func findStorageRawList(ctx context.Context, tx *sql.Tx, find *api.StorageFind) ([]*storageRaw, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.ID; v != nil {
		where, args = append(where, "id = ?"), append(args, *v)
	}

	query := `
		SELECT
			id, 
			name, 
			type, 
			config
		FROM storage
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY id DESC
	`
	rows, err := tx.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, FormatError(err)
	}
	defer rows.Close()

	storageRawList := make([]*storageRaw, 0)
	for rows.Next() {
		var storageRaw storageRaw
		var storageConfig string
		if err := rows.Scan(
			&storageRaw.ID,
			&storageRaw.Name,
			&storageRaw.Type,
			&storageConfig,
		); err != nil {
			return nil, FormatError(err)
		}
		if storageRaw.Type == api.StorageS3 {
			s3Config := &api.StorageS3Config{}
			if err := json.Unmarshal([]byte(storageConfig), s3Config); err != nil {
				return nil, err
			}
			storageRaw.Config = &api.StorageConfig{
				S3Config: s3Config,
			}
		} else {
			return nil, fmt.Errorf("unsupported storage type %s", string(storageRaw.Type))
		}
		storageRawList = append(storageRawList, &storageRaw)
	}

	if err := rows.Err(); err != nil {
		return nil, FormatError(err)
	}

	return storageRawList, nil
}

func deleteStorage(ctx context.Context, tx *sql.Tx, delete *api.StorageDelete) error {
	where, args := []string{"id = ?"}, []any{delete.ID}

	stmt := `DELETE FROM storage WHERE ` + strings.Join(where, " AND ")
	result, err := tx.ExecContext(ctx, stmt, args...)
	if err != nil {
		return FormatError(err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return &common.Error{Code: common.NotFound, Err: fmt.Errorf("storage not found")}
	}

	return nil
}
