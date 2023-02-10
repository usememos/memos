package store

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
)

type storageSettingRaw struct {
	ID        int
	CreatorID int
	CreatedTs int64
	Name      string
	EndPoint  string
	AccessKey string
	SecretKey string
	Bucket    string
}

func (raw *storageSettingRaw) toStorageSetting() *api.StorageSetting {
	return &api.StorageSetting{
		ID:        raw.ID,
		CreatorID: raw.CreatorID,
		CreatedTs: raw.CreatedTs,
		Name:      raw.Name,
		EndPoint:  raw.EndPoint,
		AccessKey: raw.AccessKey,
		SecretKey: raw.SecretKey,
		Bucket:    raw.Bucket,
	}
}

func (s *Store) CreateStorageSetting(ctx context.Context, create *api.StorageSettingCreate) (*api.StorageSetting, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	storageSettingRaw, err := createStorageSettingRaw(ctx, tx, create)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, FormatError(err)
	}

	return storageSettingRaw.toStorageSetting(), nil
}

func (s *Store) PatchStorageSetting(ctx context.Context, patch *api.StorageSettingPatch) (*api.StorageSetting, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	storageSettingRaw, err := patchStorageSettingRaw(ctx, tx, patch)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, FormatError(err)
	}

	return storageSettingRaw.toStorageSetting(), nil
}

func (s *Store) FindStorageSettingList(ctx context.Context, find *api.StorageSettingFind) ([]*api.StorageSetting, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	storageSettingRawList, err := findStorageSettingRawList(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	list := []*api.StorageSetting{}
	for _, raw := range storageSettingRawList {
		list = append(list, raw.toStorageSetting())
	}

	return list, nil
}

func (s *Store) DeleteStorageSetting(ctx context.Context, delete *api.StorageSettingDelete) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return FormatError(err)
	}
	defer tx.Rollback()

	if err := deleteStorageSetting(ctx, tx, delete); err != nil {
		return FormatError(err)
	}

	if err := tx.Commit(); err != nil {
		return FormatError(err)
	}

	return nil
}

func createStorageSettingRaw(ctx context.Context, tx *sql.Tx, create *api.StorageSettingCreate) (*storageSettingRaw, error) {
	set := []string{"creator_id", "name", "end_point", "access_key", "secret_key", "bucket"}
	args := []interface{}{create.CreatorID, create.Name, create.AccessKey, create.SecretKey, create.Bucket}
	placeholder := []string{"?", "?", "?", "?", "?", "?"}

	query := `
		INSERT INTO storage_setting (
			` + strings.Join(set, ", ") + `
		)
		VALUES (` + strings.Join(placeholder, ",") + `)
		RETURNING id, creator_id, created_ts, name, end_point, access_key, secret_key, bucket
	`
	var storageSettingRaw storageSettingRaw
	if err := tx.QueryRowContext(ctx, query, args...).Scan(
		&storageSettingRaw.ID,
		&storageSettingRaw.CreatorID,
		&storageSettingRaw.CreatedTs,
		&storageSettingRaw.Name,
		&storageSettingRaw.EndPoint,
		&storageSettingRaw.AccessKey,
		&storageSettingRaw.SecretKey,
		&storageSettingRaw.Bucket,
	); err != nil {
		return nil, FormatError(err)
	}

	return &storageSettingRaw, nil
}

func patchStorageSettingRaw(ctx context.Context, tx *sql.Tx, patch *api.StorageSettingPatch) (*storageSettingRaw, error) {
	set, args := []string{}, []interface{}{}
	// TODO
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
		UPDATE storage_setting
		SET ` + strings.Join(set, ", ") + `
		WHERE id = ?
		RETURNING id, creator_id, created_ts, name, end_point, access_key, secret_key, bucket
	`

	var storageSettingRaw storageSettingRaw
	if err := tx.QueryRowContext(ctx, query, args...).Scan(
		&storageSettingRaw.ID,
		&storageSettingRaw.CreatorID,
		&storageSettingRaw.CreatedTs,
		&storageSettingRaw.Name,
		&storageSettingRaw.EndPoint,
		&storageSettingRaw.AccessKey,
		&storageSettingRaw.SecretKey,
		&storageSettingRaw.Bucket,
	); err != nil {
		return nil, FormatError(err)
	}

	return &storageSettingRaw, nil
}

func findStorageSettingRawList(ctx context.Context, tx *sql.Tx, find *api.StorageSettingFind) ([]*storageSettingRaw, error) {
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
		FROM storage_setting
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_ts DESC
	`
	rows, err := tx.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, FormatError(err)
	}
	defer rows.Close()

	storageSettingRawList := make([]*storageSettingRaw, 0)
	for rows.Next() {
		var storageSettingRaw storageSettingRaw
		if err := rows.Scan(
			&storageSettingRaw.ID,
			&storageSettingRaw.CreatorID,
			&storageSettingRaw.CreatedTs,
			&storageSettingRaw.Name,
			&storageSettingRaw.EndPoint,
			&storageSettingRaw.AccessKey,
			&storageSettingRaw.SecretKey,
			&storageSettingRaw.Bucket,
		); err != nil {
			return nil, FormatError(err)
		}

		storageSettingRawList = append(storageSettingRawList, &storageSettingRaw)
	}

	if err := rows.Err(); err != nil {
		return nil, FormatError(err)
	}

	return storageSettingRawList, nil
}

func deleteStorageSetting(ctx context.Context, tx *sql.Tx, delete *api.StorageSettingDelete) error {
	where, args := []string{"id = ?"}, []interface{}{delete.ID}

	stmt := `DELETE FROM storage_setting WHERE ` + strings.Join(where, " AND ")
	result, err := tx.ExecContext(ctx, stmt, args...)
	if err != nil {
		return FormatError(err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return &common.Error{Code: common.NotFound, Err: fmt.Errorf("storage setting not found")}
	}

	return nil
}
