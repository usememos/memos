package store

import (
	"fmt"
	"memos/api"
	"memos/common"
	"strings"
)

func (s *Store) CreateShortcut(create *api.ShortcutCreate) (*api.Shortcut, error) {
	shortcut, err := createShortcut(s.db, create)
	if err != nil {
		return nil, err
	}

	return shortcut, nil
}

func (s *Store) PatchShortcut(patch *api.ShortcutPatch) (*api.Shortcut, error) {
	shortcut, err := patchShortcut(s.db, patch)
	if err != nil {
		return nil, err
	}

	return shortcut, nil
}

func (s *Store) FindShortcutList(find *api.ShortcutFind) ([]*api.Shortcut, error) {
	list, err := findShortcutList(s.db, find)
	if err != nil {
		return nil, err
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

	return list[0], nil
}

func (s *Store) DeleteShortcut(delete *api.ShortcutDelete) error {
	err := deleteShortcut(s.db, delete)
	if err != nil {
		return FormatError(err)
	}

	return nil
}

func createShortcut(db *DB, create *api.ShortcutCreate) (*api.Shortcut, error) {
	row, err := db.Db.Query(`
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
	var shortcut api.Shortcut
	if err := row.Scan(
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

	return &shortcut, nil
}

func patchShortcut(db *DB, patch *api.ShortcutPatch) (*api.Shortcut, error) {
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

	row, err := db.Db.Query(`
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

	var shortcut api.Shortcut
	if err := row.Scan(
		&shortcut.ID,
		&shortcut.Title,
		&shortcut.Payload,
		&shortcut.CreatedTs,
		&shortcut.UpdatedTs,
		&shortcut.RowStatus,
	); err != nil {
		return nil, FormatError(err)
	}

	return &shortcut, nil
}

func findShortcutList(db *DB, find *api.ShortcutFind) ([]*api.Shortcut, error) {
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

	rows, err := db.Db.Query(`
		SELECT
			id,
			title,
			payload,
			creator_id,
			created_ts,
			updated_ts,
			row_status
		FROM shortcut
		WHERE `+strings.Join(where, " AND "),
		args...,
	)
	if err != nil {
		return nil, FormatError(err)
	}
	defer rows.Close()

	list := make([]*api.Shortcut, 0)
	for rows.Next() {
		var shortcut api.Shortcut
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

func deleteShortcut(db *DB, delete *api.ShortcutDelete) error {
	result, err := db.Db.Exec(`DELETE FROM shortcut WHERE id = ?`, delete.ID)
	if err != nil {
		return FormatError(err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return &common.Error{Code: common.NotFound, Err: fmt.Errorf("shortcut ID not found: %d", delete.ID)}
	}

	return nil
}
