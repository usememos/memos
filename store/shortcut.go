package store

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
)

// shortcutRaw is the store model for an Shortcut.
// Fields have exactly the same meanings as Shortcut.
type shortcutRaw struct {
	ID int

	// Standard fields
	RowStatus api.RowStatus
	CreatorID int
	CreatedTs int64
	UpdatedTs int64

	// Domain specific fields
	Title   string
	Payload string
}

func (raw *shortcutRaw) toShortcut() *api.Shortcut {
	return &api.Shortcut{
		ID: raw.ID,

		RowStatus: raw.RowStatus,
		CreatorID: raw.CreatorID,
		CreatedTs: raw.CreatedTs,
		UpdatedTs: raw.UpdatedTs,

		Title:   raw.Title,
		Payload: raw.Payload,
	}
}

func (s *Store) CreateShortcut(ctx context.Context, create *api.ShortcutCreate) (*api.Shortcut, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	shortcutRaw, err := createShortcut(ctx, tx, create)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, FormatError(err)
	}

	if err := s.cache.UpsertCache(ShortcutCache, shortcutRaw.ID, shortcutRaw); err != nil {
		return nil, err
	}

	shortcut := shortcutRaw.toShortcut()

	return shortcut, nil
}

func (s *Store) PatchShortcut(ctx context.Context, patch *api.ShortcutPatch) (*api.Shortcut, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	shortcutRaw, err := patchShortcut(ctx, tx, patch)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, FormatError(err)
	}

	if err := s.cache.UpsertCache(ShortcutCache, shortcutRaw.ID, shortcutRaw); err != nil {
		return nil, err
	}

	shortcut := shortcutRaw.toShortcut()

	return shortcut, nil
}

func (s *Store) FindShortcutList(ctx context.Context, find *api.ShortcutFind) ([]*api.Shortcut, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	shortcutRawList, err := findShortcutList(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	list := []*api.Shortcut{}
	for _, raw := range shortcutRawList {
		list = append(list, raw.toShortcut())
	}

	return list, nil
}

func (s *Store) FindShortcut(ctx context.Context, find *api.ShortcutFind) (*api.Shortcut, error) {
	if find.ID != nil {
		shortcutRaw := &shortcutRaw{}
		has, err := s.cache.FindCache(ShortcutCache, *find.ID, shortcutRaw)
		if err != nil {
			return nil, err
		}
		if has {
			return shortcutRaw.toShortcut(), nil
		}
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	list, err := findShortcutList(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	if len(list) == 0 {
		return nil, &common.Error{Code: common.NotFound, Err: fmt.Errorf("not found")}
	}

	shortcutRaw := list[0]

	if err := s.cache.UpsertCache(ShortcutCache, shortcutRaw.ID, shortcutRaw); err != nil {
		return nil, err
	}

	shortcut := shortcutRaw.toShortcut()

	return shortcut, nil
}

func (s *Store) DeleteShortcut(ctx context.Context, delete *api.ShortcutDelete) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return FormatError(err)
	}
	defer tx.Rollback()

	err = deleteShortcut(ctx, tx, delete)
	if err != nil {
		return FormatError(err)
	}

	if err := tx.Commit(); err != nil {
		return FormatError(err)
	}

	s.cache.DeleteCache(ShortcutCache, *delete.ID)

	return nil
}

func createShortcut(ctx context.Context, tx *sql.Tx, create *api.ShortcutCreate) (*shortcutRaw, error) {
	query := `
		INSERT INTO shortcut (
			title, 
			payload, 
			creator_id
		)
		VALUES (?, ?, ?)
		RETURNING id, title, payload, creator_id, created_ts, updated_ts, row_status
	`
	var shortcutRaw shortcutRaw
	if err := tx.QueryRowContext(ctx, query, create.Title, create.Payload, create.CreatorID).Scan(
		&shortcutRaw.ID,
		&shortcutRaw.Title,
		&shortcutRaw.Payload,
		&shortcutRaw.CreatorID,
		&shortcutRaw.CreatedTs,
		&shortcutRaw.UpdatedTs,
		&shortcutRaw.RowStatus,
	); err != nil {
		return nil, FormatError(err)
	}

	return &shortcutRaw, nil
}

func patchShortcut(ctx context.Context, tx *sql.Tx, patch *api.ShortcutPatch) (*shortcutRaw, error) {
	set, args := []string{}, []interface{}{}

	if v := patch.UpdatedTs; v != nil {
		set, args = append(set, "updated_ts = ?"), append(args, *v)
	}
	if v := patch.Title; v != nil {
		set, args = append(set, "title = ?"), append(args, *v)
	}
	if v := patch.Payload; v != nil {
		set, args = append(set, "payload = ?"), append(args, *v)
	}
	if v := patch.RowStatus; v != nil {
		set, args = append(set, "row_status = ?"), append(args, *v)
	}

	args = append(args, patch.ID)

	query := `
		UPDATE shortcut
		SET ` + strings.Join(set, ", ") + `
		WHERE id = ?
		RETURNING id, title, payload, creator_id, created_ts, updated_ts, row_status
	`
	var shortcutRaw shortcutRaw
	if err := tx.QueryRowContext(ctx, query, args...).Scan(
		&shortcutRaw.ID,
		&shortcutRaw.Title,
		&shortcutRaw.Payload,
		&shortcutRaw.CreatorID,
		&shortcutRaw.CreatedTs,
		&shortcutRaw.UpdatedTs,
		&shortcutRaw.RowStatus,
	); err != nil {
		return nil, FormatError(err)
	}

	return &shortcutRaw, nil
}

func findShortcutList(ctx context.Context, tx *sql.Tx, find *api.ShortcutFind) ([]*shortcutRaw, error) {
	where, args := []string{"1 = 1"}, []interface{}{}

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

	shortcutRawList := make([]*shortcutRaw, 0)
	for rows.Next() {
		var shortcutRaw shortcutRaw
		if err := rows.Scan(
			&shortcutRaw.ID,
			&shortcutRaw.Title,
			&shortcutRaw.Payload,
			&shortcutRaw.CreatorID,
			&shortcutRaw.CreatedTs,
			&shortcutRaw.UpdatedTs,
			&shortcutRaw.RowStatus,
		); err != nil {
			return nil, FormatError(err)
		}

		shortcutRawList = append(shortcutRawList, &shortcutRaw)
	}

	if err := rows.Err(); err != nil {
		return nil, FormatError(err)
	}

	return shortcutRawList, nil
}

func deleteShortcut(ctx context.Context, tx *sql.Tx, delete *api.ShortcutDelete) error {
	where, args := []string{}, []interface{}{}

	if v := delete.ID; v != nil {
		where, args = append(where, "id = ?"), append(args, *v)
	}
	if v := delete.CreatorID; v != nil {
		where, args = append(where, "creator_id = ?"), append(args, *v)
	}

	stmt := `DELETE FROM shortcut WHERE ` + strings.Join(where, " AND ")
	result, err := tx.ExecContext(ctx, stmt, args...)
	if err != nil {
		return FormatError(err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return &common.Error{Code: common.NotFound, Err: fmt.Errorf("shortcut not found")}
	}

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
		return FormatError(err)
	}

	return nil
}
