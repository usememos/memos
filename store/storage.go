package store

import (
	"context"
	"database/sql"
	"strings"
)

type Storage struct {
	ID     int
	Name   string
	Type   string
	Config string
}

type FindStorage struct {
	ID *int
}

type UpdateStorage struct {
	ID     int
	Name   *string
	Config *string
}

type DeleteStorage struct {
	ID int
}

func (s *Store) CreateStorage(ctx context.Context, create *Storage) (*Storage, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	query := `
		INSERT INTO storage (
			name,
			type,
			config
		)
		VALUES (?, ?, ?)
		RETURNING id
	`
	if err := tx.QueryRowContext(ctx, query, create.Name, create.Type, create.Config).Scan(
		&create.ID,
	); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	storage := create
	return storage, nil
}

func (s *Store) ListStorages(ctx context.Context, find *FindStorage) ([]*Storage, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	list, err := listStorages(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	return list, nil
}

func (s *Store) GetStorage(ctx context.Context, find *FindStorage) (*Storage, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	list, err := listStorages(ctx, tx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}

	return list[0], nil
}

func (s *Store) UpdateStorage(ctx context.Context, update *UpdateStorage) (*Storage, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

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

	query := `
		UPDATE storage
		SET ` + strings.Join(set, ", ") + `
		WHERE id = ?
		RETURNING
			id,
			name,
			type,
			config
	`
	storage := &Storage{}
	if err := tx.QueryRowContext(ctx, query, args...).Scan(
		&storage.ID,
		&storage.Name,
		&storage.Type,
		&storage.Config,
	); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return storage, nil
}

func (s *Store) DeleteStorage(ctx context.Context, delete *DeleteStorage) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	query := `
		DELETE FROM storage
		WHERE id = ?
	`
	if _, err := tx.ExecContext(ctx, query, delete.ID); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		// Prevent linter warning.
		return err
	}

	return nil
}

func listStorages(ctx context.Context, tx *sql.Tx, find *FindStorage) ([]*Storage, error) {
	where, args := []string{"1 = 1"}, []any{}
	if find.ID != nil {
		where, args = append(where, "id = ?"), append(args, *find.ID)
	}

	rows, err := tx.QueryContext(ctx, `
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

	list := []*Storage{}
	for rows.Next() {
		storage := &Storage{}
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
