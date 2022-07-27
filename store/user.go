package store

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
)

// userRaw is the store model for an User.
// Fields have exactly the same meanings as User.
type userRaw struct {
	ID int

	// Standard fields
	RowStatus api.RowStatus
	CreatedTs int64
	UpdatedTs int64

	// Domain specific fields
	Email        string
	Role         api.Role
	Name         string
	PasswordHash string
	OpenID       string
}

func (raw *userRaw) toUser() *api.User {
	return &api.User{
		ID: raw.ID,

		RowStatus: raw.RowStatus,
		CreatedTs: raw.CreatedTs,
		UpdatedTs: raw.UpdatedTs,

		Email:        raw.Email,
		Role:         raw.Role,
		Name:         raw.Name,
		PasswordHash: raw.PasswordHash,
		OpenID:       raw.OpenID,
	}
}

func (s *Store) CreateUser(create *api.UserCreate) (*api.User, error) {
	userRaw, err := createUser(s.db, create)
	if err != nil {
		return nil, err
	}

	user := userRaw.toUser()

	return user, nil
}

func (s *Store) PatchUser(patch *api.UserPatch) (*api.User, error) {
	userRaw, err := patchUser(s.db, patch)
	if err != nil {
		return nil, err
	}

	user := userRaw.toUser()

	return user, nil
}

func (s *Store) FindUserList(find *api.UserFind) ([]*api.User, error) {
	userRawList, err := findUserList(s.db, find)
	if err != nil {
		return nil, err
	}

	list := []*api.User{}
	for _, raw := range userRawList {
		list = append(list, raw.toUser())
	}

	return list, nil
}

func (s *Store) FindUser(find *api.UserFind) (*api.User, error) {
	list, err := findUserList(s.db, find)
	if err != nil {
		return nil, err
	}

	if len(list) == 0 {
		return nil, nil
	} else if len(list) > 1 {
		return nil, &common.Error{Code: common.Conflict, Err: fmt.Errorf("found %d users with filter %+v, expect 1. ", len(list), find)}
	}

	user := list[0].toUser()

	return user, nil
}

func (s *Store) DeleteUser(delete *api.UserDelete) error {
	err := deleteUser(s.db, delete)
	if err != nil {
		return FormatError(err)
	}

	return nil
}

func createUser(db *sql.DB, create *api.UserCreate) (*userRaw, error) {
	row, err := db.Query(`
		INSERT INTO user (
			email,
			role,
			name,
			password_hash,
			open_id
		)
		VALUES (?, ?, ?, ?, ?)
		RETURNING id, email, role, name, password_hash, open_id, created_ts, updated_ts, row_status
	`,
		create.Email,
		create.Role,
		create.Name,
		create.PasswordHash,
		create.OpenID,
	)
	if err != nil {
		return nil, FormatError(err)
	}
	defer row.Close()

	row.Next()
	var userRaw userRaw
	if err := row.Scan(
		&userRaw.ID,
		&userRaw.Email,
		&userRaw.Role,
		&userRaw.Name,
		&userRaw.PasswordHash,
		&userRaw.OpenID,
		&userRaw.CreatedTs,
		&userRaw.UpdatedTs,
		&userRaw.RowStatus,
	); err != nil {
		return nil, FormatError(err)
	}

	return &userRaw, nil
}

func patchUser(db *sql.DB, patch *api.UserPatch) (*userRaw, error) {
	set, args := []string{}, []interface{}{}

	if v := patch.RowStatus; v != nil {
		set, args = append(set, "row_status = ?"), append(args, *v)
	}
	if v := patch.Email; v != nil {
		set, args = append(set, "email = ?"), append(args, *v)
	}
	if v := patch.Name; v != nil {
		set, args = append(set, "name = ?"), append(args, *v)
	}
	if v := patch.PasswordHash; v != nil {
		set, args = append(set, "password_hash = ?"), append(args, *v)
	}
	if v := patch.OpenID; v != nil {
		set, args = append(set, "open_id = ?"), append(args, *v)
	}

	args = append(args, patch.ID)

	row, err := db.Query(`
		UPDATE user
		SET `+strings.Join(set, ", ")+`
		WHERE id = ?
		RETURNING id, email, role, name, password_hash, open_id, created_ts, updated_ts, row_status
	`, args...)
	if err != nil {
		return nil, FormatError(err)
	}
	defer row.Close()

	if row.Next() {
		var userRaw userRaw
		if err := row.Scan(
			&userRaw.ID,
			&userRaw.Email,
			&userRaw.Role,
			&userRaw.Name,
			&userRaw.PasswordHash,
			&userRaw.OpenID,
			&userRaw.CreatedTs,
			&userRaw.UpdatedTs,
			&userRaw.RowStatus,
		); err != nil {
			return nil, FormatError(err)
		}

		return &userRaw, nil
	}

	return nil, &common.Error{Code: common.NotFound, Err: fmt.Errorf("user ID not found: %d", patch.ID)}
}

func findUserList(db *sql.DB, find *api.UserFind) ([]*userRaw, error) {
	where, args := []string{"1 = 1"}, []interface{}{}

	if v := find.ID; v != nil {
		where, args = append(where, "id = ?"), append(args, *v)
	}
	if v := find.Role; v != nil {
		where, args = append(where, "role = ?"), append(args, *v)
	}
	if v := find.Email; v != nil {
		where, args = append(where, "email = ?"), append(args, *v)
	}
	if v := find.Name; v != nil {
		where, args = append(where, "name = ?"), append(args, *v)
	}
	if v := find.OpenID; v != nil {
		where, args = append(where, "open_id = ?"), append(args, *v)
	}

	rows, err := db.Query(`
		SELECT 
			id,
			email,
			role,
			name,
			password_hash,
			open_id,
			created_ts,
			updated_ts,
			row_status
		FROM user
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY created_ts DESC, row_status DESC`,
		args...,
	)
	if err != nil {
		return nil, FormatError(err)
	}
	defer rows.Close()

	userRawList := make([]*userRaw, 0)
	for rows.Next() {
		var userRaw userRaw
		if err := rows.Scan(
			&userRaw.ID,
			&userRaw.Email,
			&userRaw.Role,
			&userRaw.Name,
			&userRaw.PasswordHash,
			&userRaw.OpenID,
			&userRaw.CreatedTs,
			&userRaw.UpdatedTs,
			&userRaw.RowStatus,
		); err != nil {
			return nil, FormatError(err)
		}

		userRawList = append(userRawList, &userRaw)
	}

	if err := rows.Err(); err != nil {
		return nil, FormatError(err)
	}

	return userRawList, nil
}

func deleteUser(db *sql.DB, delete *api.UserDelete) error {
	result, err := db.Exec(`
		PRAGMA foreign_keys = ON;
		DELETE FROM user WHERE id = ?
	`, delete.ID)
	if err != nil {
		return FormatError(err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return &common.Error{Code: common.NotFound, Err: fmt.Errorf("user ID not found: %d", delete.ID)}
	}

	return nil
}
