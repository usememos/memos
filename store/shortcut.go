package store

import (
	"context"
	"database/sql"
	"strings"
)

type Shortcut struct {
	ID int

	// Standard fields
	RowStatus RowStatus
	CreatorID int
	CreatedTs int64
	UpdatedTs int64

	// Domain specific fields
	Title   string
	Payload string
}

type UpdateShortcut struct {
	ID int

	UpdatedTs *int64
	RowStatus *RowStatus
	Title     *string
	Payload   *string
}

type FindShortcut struct {
	ID        *int
	CreatorID *int
	Title     *string
}

type DeleteShortcut struct {
	ID        *int
	CreatorID *int
}

func (s *Store) CreateShortcut(ctx context.Context, create *Shortcut) (*Shortcut, error) {
	stmt := `
		INSERT INTO shortcut (
			title, 
			payload, 
			creator_id
		)
		VALUES (?, ?, ?)
		RETURNING id, created_ts, updated_ts, row_status
	`
	if err := s.db.QueryRowContext(ctx, stmt, create.Title, create.Payload, create.CreatorID).Scan(
		&create.ID,
		&create.CreatedTs,
		&create.UpdatedTs,
		&create.RowStatus,
	); err != nil {
		return nil, err
	}

	shortcut := create
	return shortcut, nil
}

func (s *Store) ListShortcuts(ctx context.Context, find *FindShortcut) ([]*Shortcut, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.ID; v != nil {
		where, args = append(where, "id = ?"), append(args, *v)
	}
	if v := find.CreatorID; v != nil {
		where, args = append(where, "creator_id = ?"), append(args, *v)
	}
	if v := find.Title; v != nil {
		where, args = append(where, "title = ?"), append(args, *v)
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT
			id,
			title,
			payload,
			creator_id,
			created_ts,
			updated_ts,
			row_status
		FROM shortcut
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY created_ts DESC`,
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]*Shortcut, 0)
	for rows.Next() {
		var shortcut Shortcut
		if err := rows.Scan(
			&shortcut.ID,
			&shortcut.Title,
			&shortcut.Payload,
			&shortcut.CreatorID,
			&shortcut.CreatedTs,
			&shortcut.UpdatedTs,
			&shortcut.RowStatus,
		); err != nil {
			return nil, err
		}
		list = append(list, &shortcut)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (s *Store) GetShortcut(ctx context.Context, find *FindShortcut) (*Shortcut, error) {
	list, err := s.ListShortcuts(ctx, find)
	if err != nil {
		return nil, err
	}

	if len(list) == 0 {
		return nil, nil
	}

	shortcut := list[0]
	return shortcut, nil
}

func (s *Store) UpdateShortcut(ctx context.Context, update *UpdateShortcut) (*Shortcut, error) {
	set, args := []string{}, []any{}
	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "updated_ts = ?"), append(args, *v)
	}
	if v := update.Title; v != nil {
		set, args = append(set, "title = ?"), append(args, *v)
	}
	if v := update.Payload; v != nil {
		set, args = append(set, "payload = ?"), append(args, *v)
	}
	if v := update.RowStatus; v != nil {
		set, args = append(set, "row_status = ?"), append(args, *v)
	}
	args = append(args, update.ID)

	stmt := `
		UPDATE shortcut
		SET ` + strings.Join(set, ", ") + `
		WHERE id = ?
		RETURNING id, title, payload, creator_id, created_ts, updated_ts, row_status
	`
	shortcut := &Shortcut{}
	if err := s.db.QueryRowContext(ctx, stmt, args...).Scan(
		&shortcut.ID,
		&shortcut.Title,
		&shortcut.Payload,
		&shortcut.CreatorID,
		&shortcut.CreatedTs,
		&shortcut.UpdatedTs,
		&shortcut.RowStatus,
	); err != nil {
		return nil, err
	}

	return shortcut, nil
}

func (s *Store) DeleteShortcut(ctx context.Context, delete *DeleteShortcut) error {
	where, args := []string{}, []any{}
	if v := delete.ID; v != nil {
		where, args = append(where, "id = ?"), append(args, *v)
	}
	if v := delete.CreatorID; v != nil {
		where, args = append(where, "creator_id = ?"), append(args, *v)
	}
	stmt := `DELETE FROM shortcut WHERE ` + strings.Join(where, " AND ")
	result, err := s.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return err
	}
	if _, err := result.RowsAffected(); err != nil {
		return err
	}
	s.shortcutCache.Delete(*delete.ID)
	return nil
}

func vacuumShortcut(ctx context.Context, tx *sql.Tx) error {
	stmt := `
	DELETE FROM 
		shortcut 
	WHERE 
		creator_id NOT IN (
			SELECT 
				id 
			FROM 
				user
		)`
	_, err := tx.ExecContext(ctx, stmt)
	if err != nil {
		return err
	}

	return nil
}
