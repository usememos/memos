package store

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
)

type storageRaw struct {
	ID        int
	CreatorID int
	CreatedTs int64
	UpdatedTs int64
	Name      string
	EndPoint  string
	AccessKey string
	SecretKey string
	Bucket    string
}

func (raw *storageRaw) toStorage() *api.Storage {
	return &api.Storage{
		ID:        raw.ID,
		CreatorID: raw.CreatorID,
		CreatedTs: raw.CreatedTs,
		UpdatedTs: raw.UpdatedTs,
		Name:      raw.Name,
		EndPoint:  raw.EndPoint,
		AccessKey: raw.AccessKey,
		SecretKey: raw.SecretKey,
		Bucket:    raw.Bucket,
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
	set := []string{"creator_id", "name", "end_point", "access_key", "secret_key", "bucket"}
	args := []interface{}{create.CreatorID, create.Name, create.AccessKey, create.SecretKey, create.Bucket}
	placeholder := []string{"?", "?", "?", "?", "?", "?"}

	query := `
		INSERT INTO storage (
			` + strings.Join(set, ", ") + `
		)
		VALUES (` + strings.Join(placeholder, ",") + `)
		RETURNING id, creator_id, created_ts, updated_ts, name, end_point, access_key, secret_key, bucket
	`
	var storageRaw storageRaw
	if err := tx.QueryRowContext(ctx, query, args...).Scan(
		&storageRaw.ID,
		&storageRaw.CreatorID,
		&storageRaw.CreatedTs,
		&storageRaw.UpdatedTs,
		&storageRaw.Name,
		&storageRaw.EndPoint,
		&storageRaw.AccessKey,
		&storageRaw.SecretKey,
		&storageRaw.Bucket,
	); err != nil {
		return nil, FormatError(err)
	}

	return &storageRaw, nil
}

func patchStorageRaw(ctx context.Context, tx *sql.Tx, patch *api.StoragePatch) (*storageRaw, error) {
	set, args := []string{}, []interface{}{}
	if v := patch.UpdatedTs; v != nil {
		set, args = append(set, "updated_ts = ?"), append(args, *v)
	}
	if v := patch.Name; v != nil {
		set, args = append(set, "name = ?"), append(args, *v)
	}
	if v := patch.EndPoint; v != nil {
		set, args = append(set, "end_point = ?"), append(args, *v)
	}
	if v := patch.AccessKey; v != nil {
		set, args = append(set, "access_key = ?"), append(args, *v)
	}
	if v := patch.SecretKey; v != nil {
		set, args = append(set, "secret_key = ?"), append(args, *v)
	}
	if v := patch.Bucket; v != nil {
		set, args = append(set, "bucket = ?"), append(args, *v)
	}

	args = append(args, patch.ID)

	query := `
		UPDATE storage
		SET ` + strings.Join(set, ", ") + `
		WHERE id = ?
		RETURNING id, creator_id, created_ts, updated_ts, name, end_point, access_key, secret_key, bucket
	`

	var storageRaw storageRaw
	if err := tx.QueryRowContext(ctx, query, args...).Scan(
		&storageRaw.ID,
		&storageRaw.CreatorID,
		&storageRaw.CreatedTs,
		&storageRaw.UpdatedTs,
		&storageRaw.Name,
		&storageRaw.EndPoint,
		&storageRaw.AccessKey,
		&storageRaw.SecretKey,
		&storageRaw.Bucket,
	); err != nil {
		return nil, FormatError(err)
	}

	return &storageRaw, nil
}

func findStorageRawList(ctx context.Context, tx *sql.Tx, find *api.StorageFind) ([]*storageRaw, error) {
	where, args := []string{"1 = 1"}, []interface{}{}

	if v := find.CreatorID; v != nil {
		where, args = append(where, "creator_id = ?"), append(args, *v)
	}

	query := `
		SELECT
			id, 
			creator_id, 
			created_ts, 
			name, 
			end_point, 
			access_key, 
			secret_key, 
			bucket
		FROM storage
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_ts DESC
	`
	rows, err := tx.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, FormatError(err)
	}
	defer rows.Close()

	storageRawList := make([]*storageRaw, 0)
	for rows.Next() {
		var storageRaw storageRaw
		if err := rows.Scan(
			&storageRaw.ID,
			&storageRaw.CreatorID,
			&storageRaw.CreatedTs,
			&storageRaw.Name,
			&storageRaw.EndPoint,
			&storageRaw.AccessKey,
			&storageRaw.SecretKey,
			&storageRaw.Bucket,
		); err != nil {
			return nil, FormatError(err)
		}

		storageRawList = append(storageRawList, &storageRaw)
	}

	if err := rows.Err(); err != nil {
		return nil, FormatError(err)
	}

	return storageRawList, nil
}

func deleteStorage(ctx context.Context, tx *sql.Tx, delete *api.StorageDelete) error {
	where, args := []string{"id = ?"}, []interface{}{delete.ID}

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
