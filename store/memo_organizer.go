package store

import (
	"database/sql"
	"fmt"
	"memos/api"
	"memos/common"
)

// memoOrganizerRaw is the store model for an MemoOrganizer.
// Fields have exactly the same meanings as MemoOrganizer.
type memoOrganizerRaw struct {
	ID int

	// Domain specific fields
	MemoID int
	UserID int
	Pinned bool
}

func (raw *memoOrganizerRaw) toMemoOrganizer() *api.MemoOrganizer {
	return &api.MemoOrganizer{
		ID: raw.ID,

		MemoID: raw.MemoID,
		UserID: raw.UserID,
		Pinned: raw.Pinned,
	}
}

func (s *Store) FindMemoOrganizer(find *api.MemoOrganizerFind) (*api.MemoOrganizer, error) {
	memoOrganizerRaw, err := findMemoOrganizer(s.db, find)
	if err != nil {
		return nil, err
	}

	memoOrganizer := memoOrganizerRaw.toMemoOrganizer()

	return memoOrganizer, nil
}

func (s *Store) UpsertMemoOrganizer(upsert *api.MemoOrganizerUpsert) error {
	err := upsertMemoOrganizer(s.db, upsert)
	if err != nil {
		return err
	}

	return nil
}

func findMemoOrganizer(db *sql.DB, find *api.MemoOrganizerFind) (*memoOrganizerRaw, error) {
	row, err := db.Query(`
		SELECT
			id,
			memo_id,
			user_id,
			pinned
		FROM memo_organizer
		WHERE memo_id = ? AND user_id = ?
	`, find.MemoID, find.UserID)
	if err != nil {
		return nil, FormatError(err)
	}
	defer row.Close()

	if !row.Next() {
		return nil, &common.Error{Code: common.NotFound, Err: fmt.Errorf("not found")}
	}

	var memoOrganizerRaw memoOrganizerRaw
	if err := row.Scan(
		&memoOrganizerRaw.ID,
		&memoOrganizerRaw.MemoID,
		&memoOrganizerRaw.UserID,
		&memoOrganizerRaw.Pinned,
	); err != nil {
		return nil, FormatError(err)
	}

	return &memoOrganizerRaw, nil
}

func upsertMemoOrganizer(db *sql.DB, upsert *api.MemoOrganizerUpsert) error {
	row, err := db.Query(`
		INSERT INTO memo_organizer (
			memo_id,
			user_id,
			pinned
		)
		VALUES (?, ?, ?)
		ON CONFLICT(memo_id, user_id) DO UPDATE 
		SET
			pinned = EXCLUDED.pinned
		RETURNING id, memo_id, user_id, pinned
	`,
		upsert.MemoID,
		upsert.UserID,
		upsert.Pinned,
	)
	if err != nil {
		return FormatError(err)
	}

	defer row.Close()

	row.Next()
	var memoOrganizer api.MemoOrganizer
	if err := row.Scan(
		&memoOrganizer.ID,
		&memoOrganizer.MemoID,
		&memoOrganizer.UserID,
		&memoOrganizer.Pinned,
	); err != nil {
		return FormatError(err)
	}

	return nil
}
