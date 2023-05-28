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
	Config string
}

func (raw *storageRaw) toStorage() *api.Storage {
	s := api.Storage{
		ID:     raw.ID,
		Name:   raw.Name,
		Type:   raw.Type,
		Config: &api.StorageConfig{},
	}

	if s.Type == api.StorageS3 {
		s.Config.S3Config = json.RawMessage(raw.Config)
	}

	return &s
}

func (*storageRaw) fromStorage(s any) *storageRaw {
	checkoutConfig := func(t api.StorageType, cfg *api.StorageConfig) string {
		if t == api.StorageS3 {
			return string(cfg.S3Config)
		}
		return ""
	}

	var raw storageRaw

	switch st := s.(type) {
	case *api.StorageCreate:
		raw = storageRaw{
			Name:   st.Name,
			Type:   st.Type,
			Config: checkoutConfig(st.Type, st.Config),
		}
	case *api.StoragePatch:
		raw = storageRaw{
			ID:     st.ID,
			Name:   "",
			Type:   st.Type,
			Config: checkoutConfig(st.Type, st.Config),
		}
		if st.Name != nil {
			raw.Name = *st.Name
		}
	}

	return &raw
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

	query := `
		INSERT INTO storage (
			` + strings.Join(set, ", ") + `
		)
		VALUES (` + strings.TrimSuffix(strings.Repeat("?,", len(set)), ",") + `)
		RETURNING id
	`

	storageRaw := (&storageRaw{}).fromStorage(create)

	if err := tx.QueryRowContext(ctx, query, storageRaw.Name, storageRaw.Type, storageRaw.Config).Scan(
		&storageRaw.ID,
	); err != nil {
		return nil, FormatError(err)
	}

	return storageRaw, nil
}

func patchStorageRaw(ctx context.Context, tx *sql.Tx, patch *api.StoragePatch) (*storageRaw, error) {
	var (
		storageRaw = (&storageRaw{}).fromStorage(patch)
		set, args  = []string{}, []any{}
	)

	if storageRaw.Name != "" {
		set, args = append(set, "name = ?"), append(args, storageRaw.Name)
	}
	if storageRaw.Config != "" {
		set, args = append(set, "config = ?"), append(args, storageRaw.Config)
	}

	args = append(args, patch.ID)

	query := `
		UPDATE storage
		SET ` + strings.Join(set, ", ") + `
		WHERE id = ?
		RETURNING id, name, type, config
	`

	if err := tx.QueryRowContext(ctx, query, args...).Scan(
		&storageRaw.ID,
		&storageRaw.Name,
		&storageRaw.Type,
		&storageRaw.Config,
	); err != nil {
		return nil, FormatError(err)
	}

	return storageRaw, nil
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

		if err := rows.Scan(
			&storageRaw.ID,
			&storageRaw.Name,
			&storageRaw.Type,
			&storageRaw.Config,
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
