package store

import (
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

func (s *Store) CreateShortcut(create *api.ShortcutCreate) (*api.Shortcut, error) {
	shortcutRaw, err := createShortcut(s.db, create)
	if err != nil {
		return nil, err
	}

	shortcut := shortcutRaw.toShortcut()

	return shortcut, nil
}

func (s *Store) PatchShortcut(patch *api.ShortcutPatch) (*api.Shortcut, error) {
	shortcutRaw, err := patchShortcut(s.db, patch)
	if err != nil {
		return nil, err
	}

	shortcut := shortcutRaw.toShortcut()

	return shortcut, nil
}

func (s *Store) FindShortcutList(find *api.ShortcutFind) ([]*api.Shortcut, error) {
	shortcutRawList, err := findShortcutList(s.db, find)
	if err != nil {
		return nil, err
	}

	list := []*api.Shortcut{}
	for _, raw := range shortcutRawList {
		list = append(list, raw.toShortcut())
	}

	return list, nil
}

func (s *Store) FindShortcut(find *api.ShortcutFind) (*api.Shortcut, error) {
	list, err := findShortcutList(s.db, find)
	if err != nil {
		return nil, err
	}

	if len(list) == 0 {
		return nil, &common.Error{Code: common.NotFound, Err: fmt.Errorf("not found")}
	}

	shortcut := list[0].toShortcut()

	return shortcut, nil
}

func (s *Store) DeleteShortcut(delete *api.ShortcutDelete) error {
	err := deleteShortcut(s.db, delete)
	if err != nil {
		return FormatError(err)
	}

	return nil
}

func createShortcut(db *sql.DB, create *api.ShortcutCreate) (*shortcutRaw, error) {
	row, err := db.Query(`
		INSERT INTO shortcut (
			title, 
			payload, 
			creator_id
		)
		VALUES (?, ?, ?)
		RETURNING id, title, payload, creator_id, created_ts, updated_ts, row_status
	`,
		create.Title,
		create.Payload,
		create.CreatorID,
	)
	if err != nil {
		return nil, FormatError(err)
	}
	defer row.Close()

	row.Next()
	var shortcutRaw shortcutRaw
	if err := row.Scan(
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

func patchShortcut(db *sql.DB, patch *api.ShortcutPatch) (*shortcutRaw, error) {
	set, args := []string{}, []interface{}{}

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

	row, err := db.Query(`
		UPDATE shortcut
		SET `+strings.Join(set, ", ")+`
		WHERE id = ?
		RETURNING id, title, payload, created_ts, updated_ts, row_status
	`, args...)
	if err != nil {
		return nil, FormatError(err)
	}
	defer row.Close()

	if !row.Next() {
		return nil, &common.Error{Code: common.NotFound, Err: fmt.Errorf("not found")}
	}

	var shortcutRaw shortcutRaw
	if err := row.Scan(
		&shortcutRaw.ID,
		&shortcutRaw.Title,
		&shortcutRaw.Payload,
		&shortcutRaw.CreatedTs,
		&shortcutRaw.UpdatedTs,
		&shortcutRaw.RowStatus,
	); err != nil {
		return nil, FormatError(err)
	}

	return &shortcutRaw, nil
}

func findShortcutList(db *sql.DB, find *api.ShortcutFind) ([]*shortcutRaw, error) {
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

	rows, err := db.Query(`
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

func deleteShortcut(db *sql.DB, delete *api.ShortcutDelete) error {
	result, err := db.Exec(`
		PRAGMA foreign_keys = ON;
		DELETE FROM shortcut WHERE id = ?
	`, delete.ID)
	if err != nil {
		return FormatError(err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return &common.Error{Code: common.NotFound, Err: fmt.Errorf("shortcut ID not found: %d", delete.ID)}
	}

	return nil
}
