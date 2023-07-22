package store

import (
	"context"
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
	stmt := `
		INSERT INTO storage (
			name,
			type,
			config
		)
		VALUES (?, ?, ?)
		RETURNING id
	`
	if err := s.db.QueryRowContext(ctx, stmt, create.Name, create.Type, create.Config).Scan(
		&create.ID,
	); err != nil {
		return nil, err
	}

	storage := create
	return storage, nil
}

func (s *Store) ListStorages(ctx context.Context, find *FindStorage) ([]*Storage, error) {
	where, args := []string{"1 = 1"}, []any{}
	if find.ID != nil {
		where, args = append(where, "id = ?"), append(args, *find.ID)
	}

	rows, err := s.db.QueryContext(ctx, `
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

func (s *Store) GetStorage(ctx context.Context, find *FindStorage) (*Storage, error) {
	list, err := s.ListStorages(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}

	return list[0], nil
}

func (s *Store) UpdateStorage(ctx context.Context, update *UpdateStorage) (*Storage, error) {
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
	storage := &Storage{}
	if err := s.db.QueryRowContext(ctx, stmt, args...).Scan(
		&storage.ID,
		&storage.Name,
		&storage.Type,
		&storage.Config,
	); err != nil {
		return nil, err
	}

	return storage, nil
}

func (s *Store) DeleteStorage(ctx context.Context, delete *DeleteStorage) error {
	stmt := `
		DELETE FROM storage
		WHERE id = ?
	`
	result, err := s.db.ExecContext(ctx, stmt, delete.ID)
	if err != nil {
		return err
	}
	if _, err := result.RowsAffected(); err != nil {
		return err
	}
	return nil
}
