package store

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
)

// memoOrganizerRaw is the store model for an MemoOrganizer.
// Fields have exactly the same meanings as MemoOrganizer.
type memoOrganizerRaw struct {
	// Domain specific fields
	MemoID int
	UserID int
	Pinned bool
}

func (raw *memoOrganizerRaw) toMemoOrganizer() *api.MemoOrganizer {
	return &api.MemoOrganizer{
		MemoID: raw.MemoID,
		UserID: raw.UserID,
		Pinned: raw.Pinned,
	}
}

func (s *Store) FindMemoOrganizer(ctx context.Context, find *api.MemoOrganizerFind) (*api.MemoOrganizer, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	memoOrganizerRaw, err := findMemoOrganizer(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	memoOrganizer := memoOrganizerRaw.toMemoOrganizer()

	return memoOrganizer, nil
}

func (s *Store) UpsertMemoOrganizer(ctx context.Context, upsert *api.MemoOrganizerUpsert) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return FormatError(err)
	}
	defer tx.Rollback()

	if err := upsertMemoOrganizer(ctx, tx, upsert); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return FormatError(err)
	}

	return nil
}

func (s *Store) DeleteMemoOrganizer(ctx context.Context, delete *api.MemoOrganizerDelete) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return FormatError(err)
	}
	defer tx.Rollback()

	if err := deleteMemoOrganizer(ctx, tx, delete); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return FormatError(err)
	}

	return nil
}

func findMemoOrganizer(ctx context.Context, tx *sql.Tx, find *api.MemoOrganizerFind) (*memoOrganizerRaw, error) {
	query := `
		SELECT
			memo_id,
			user_id,
			pinned
		FROM memo_organizer
		WHERE memo_id = ? AND user_id = ?
	`
	row, err := tx.QueryContext(ctx, query, find.MemoID, find.UserID)
	if err != nil {
		return nil, FormatError(err)
	}
	defer row.Close()

	if !row.Next() {
		return nil, &common.Error{Code: common.NotFound, Err: fmt.Errorf("not found")}
	}

	var memoOrganizerRaw memoOrganizerRaw
	if err := row.Scan(
		&memoOrganizerRaw.MemoID,
		&memoOrganizerRaw.UserID,
		&memoOrganizerRaw.Pinned,
	); err != nil {
		return nil, FormatError(err)
	}

	if err := row.Err(); err != nil {
		return nil, err
	}

	return &memoOrganizerRaw, nil
}

func upsertMemoOrganizer(ctx context.Context, tx *sql.Tx, upsert *api.MemoOrganizerUpsert) error {
	query := `
		INSERT INTO memo_organizer (
			memo_id,
			user_id,
			pinned
		)
		VALUES (?, ?, ?)
		ON CONFLICT(memo_id, user_id) DO UPDATE 
		SET
			pinned = EXCLUDED.pinned
		RETURNING memo_id, user_id, pinned
	`
	var memoOrganizer api.MemoOrganizer
	if err := tx.QueryRowContext(ctx, query, upsert.MemoID, upsert.UserID, upsert.Pinned).Scan(
		&memoOrganizer.MemoID,
		&memoOrganizer.UserID,
		&memoOrganizer.Pinned,
	); err != nil {
		return FormatError(err)
	}

	return nil
}

func deleteMemoOrganizer(ctx context.Context, tx *sql.Tx, delete *api.MemoOrganizerDelete) error {
	where, args := []string{}, []any{}

	if v := delete.MemoID; v != nil {
		where, args = append(where, "memo_id = ?"), append(args, *v)
	}
	if v := delete.UserID; v != nil {
		where, args = append(where, "user_id = ?"), append(args, *v)
	}

	stmt := `DELETE FROM memo_organizer WHERE ` + strings.Join(where, " AND ")
	result, err := tx.ExecContext(ctx, stmt, args...)
	if err != nil {
		return FormatError(err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return &common.Error{Code: common.NotFound, Err: fmt.Errorf("memo organizer not found")}
	}

	return nil
}

func vacuumMemoOrganizer(ctx context.Context, tx *sql.Tx) error {
	stmt := `
	DELETE FROM 
		memo_organizer 
	WHERE 
		memo_id NOT IN (
			SELECT 
				id 
			FROM 
				memo
		)
		OR user_id NOT IN (
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
