package sqlite

import (
	"context"
	"strings"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateStorage(ctx context.Context, create *store.Storage) (*store.Storage, error) {
	fields := []string{"`name`", "`type`", "`config`"}
	placeholder := []string{"?", "?", "?"}
	args := []any{create.Name, create.Type, create.Config}

	stmt := "INSERT INTO `storage` (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(placeholder, ", ") + ") RETURNING `id`"
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(
		&create.ID,
	); err != nil {
		return nil, err
	}

	storage := create
	return storage, nil
}

func (d *DB) ListStorages(ctx context.Context, find *store.FindStorage) ([]*store.Storage, error) {
	where, args := []string{"1 = 1"}, []any{}
	if find.ID != nil {
		where, args = append(where, "id = ?"), append(args, *find.ID)
	}

	rows, err := d.db.QueryContext(ctx, `
		SELECT
			id,
			name,
			type,
			config
		FROM storage
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY id DESC`,
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []*store.Storage{}
	for rows.Next() {
		storage := &store.Storage{}
		if err := rows.Scan(
			&storage.ID,
			&storage.Name,
			&storage.Type,
			&storage.Config,
		); err != nil {
			return nil, err
		}
		list = append(list, storage)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (d *DB) UpdateStorage(ctx context.Context, update *store.UpdateStorage) (*store.Storage, error) {
	set, args := []string{}, []any{}
	if update.Name != nil {
		set = append(set, "name = ?")
		args = append(args, *update.Name)
	}
	if update.Config != nil {
		set = append(set, "config = ?")
		args = append(args, *update.Config)
	}
	args = append(args, update.ID)

	stmt := `
		UPDATE storage
		SET ` + strings.Join(set, ", ") + `
		WHERE id = ?
		RETURNING
			id,
			name,
			type,
			config
	`
	storage := &store.Storage{}
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(
		&storage.ID,
		&storage.Name,
		&storage.Type,
		&storage.Config,
	); err != nil {
		return nil, err
	}

	return storage, nil
}

func (d *DB) DeleteStorage(ctx context.Context, delete *store.DeleteStorage) error {
	stmt := `
		DELETE FROM storage
		WHERE id = ?
	`
	result, err := d.db.ExecContext(ctx, stmt, delete.ID)
	if err != nil {
		return err
	}
	if _, err := result.RowsAffected(); err != nil {
		return err
	}
	return nil
}
