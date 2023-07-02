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
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	query := `
		INSERT INTO shortcut (
			title, 
			payload, 
			creator_id
		)
		VALUES (?, ?, ?)
		RETURNING id, created_ts, updated_ts, row_status
	`
	if err := tx.QueryRowContext(ctx, query, create.Title, create.Payload, create.CreatorID).Scan(
		&create.ID,
		&create.CreatedTs,
		&create.UpdatedTs,
		&create.RowStatus,
	); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	shortcut := create
	return shortcut, nil
}

func (s *Store) ListShortcuts(ctx context.Context, find *FindShortcut) ([]*Shortcut, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	list, err := listShortcuts(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	return list, nil
}

func (s *Store) GetShortcut(ctx context.Context, find *FindShortcut) (*Shortcut, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	list, err := listShortcuts(ctx, tx, find)
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
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

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

	query := `
		UPDATE shortcut
		SET ` + strings.Join(set, ", ") + `
		WHERE id = ?
		RETURNING id, title, payload, creator_id, created_ts, updated_ts, row_status
	`
	shortcut := &Shortcut{}
	if err := tx.QueryRowContext(ctx, query, args...).Scan(
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

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return shortcut, nil
}

func (s *Store) DeleteShortcut(ctx context.Context, delete *DeleteShortcut) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	where, args := []string{}, []any{}
	if v := delete.ID; v != nil {
		where, args = append(where, "id = ?"), append(args, *v)
	}
	if v := delete.CreatorID; v != nil {
		where, args = append(where, "creator_id = ?"), append(args, *v)
	}

	stmt := `DELETE FROM shortcut WHERE ` + strings.Join(where, " AND ")
	if _, err := tx.ExecContext(ctx, stmt, args...); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	s.shortcutCache.Delete(*delete.ID)
	return nil
}

func listShortcuts(ctx context.Context, tx *sql.Tx, find *FindShortcut) ([]*Shortcut, error) {
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

	rows, err := tx.QueryContext(ctx, `
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
		return nil, FormatError(err)
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
			return nil, FormatError(err)
		}
		list = append(list, &shortcut)
	}

	if err := rows.Err(); err != nil {
		return nil, FormatError(err)
	}

	return list, nil
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
		return FormatError(err)
	}

	return nil
}
