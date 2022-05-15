package store

import (
	"fmt"
	"memos/api"
	"memos/common"
	"strings"
)

func (s *Store) CreateUser(create *api.UserCreate) (*api.User, error) {
	user, err := createUser(s.db, create)
	if err != nil {
		return nil, err
	}

	return user, nil
}

func (s *Store) PatchUser(patch *api.UserPatch) (*api.User, error) {
	user, err := patchUser(s.db, patch)
	if err != nil {
		return nil, err
	}

	return user, nil
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

	return list[0], nil
}

func createUser(db *DB, create *api.UserCreate) (*api.User, error) {
	row, err := db.Db.Query(`
		INSERT INTO user (
			email,
			role,
			name,
			password_hash,
			open_id
		)
		VALUES (?, ?, ?, ?, ?)
		RETURNING id, email, role, name, password_hash, open_id, created_ts, updated_ts
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
	var user api.User
	if err := row.Scan(
		&user.ID,
		&user.Email,
		&user.Role,
		&user.Name,
		&user.PasswordHash,
		&user.OpenID,
		&user.CreatedTs,
		&user.UpdatedTs,
	); err != nil {
		return nil, FormatError(err)
	}

	return &user, nil
}

func patchUser(db *DB, patch *api.UserPatch) (*api.User, error) {
	set, args := []string{}, []interface{}{}

	if v := patch.Email; v != nil {
		set, args = append(set, "email = ?"), append(args, v)
	}
	if v := patch.Name; v != nil {
		set, args = append(set, "name = ?"), append(args, v)
	}
	if v := patch.PasswordHash; v != nil {
		set, args = append(set, "password_hash = ?"), append(args, v)
	}
	if v := patch.OpenID; v != nil {
		set, args = append(set, "open_id = ?"), append(args, v)
	}

	args = append(args, patch.ID)

	row, err := db.Db.Query(`
		UPDATE user
		SET `+strings.Join(set, ", ")+`
		WHERE id = ?
		RETURNING id, email, role, name, password_hash, open_id, created_ts, updated_ts
	`, args...)
	if err != nil {
		return nil, FormatError(err)
	}
	defer row.Close()

	if row.Next() {
		var user api.User
		if err := row.Scan(
			&user.ID,
			&user.Email,
			&user.Role,
			&user.Name,
			&user.PasswordHash,
			&user.OpenID,
			&user.CreatedTs,
			&user.UpdatedTs,
		); err != nil {
			return nil, FormatError(err)
		}

		return &user, nil
	}

	return nil, &common.Error{Code: common.NotFound, Err: fmt.Errorf("user ID not found: %d", patch.ID)}
}

func findUserList(db *DB, find *api.UserFind) ([]*api.User, error) {
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

	rows, err := db.Db.Query(`
		SELECT 
			id,
			email,
			role,
			name,
			password_hash,
			open_id,
			created_ts,
			updated_ts
		FROM user
		WHERE `+strings.Join(where, " AND "),
		args...,
	)
	if err != nil {
		return nil, FormatError(err)
	}
	defer rows.Close()

	list := make([]*api.User, 0)
	for rows.Next() {
		var user api.User
		if err := rows.Scan(
			&user.ID,
			&user.Email,
			&user.Role,
			&user.Name,
			&user.PasswordHash,
			&user.OpenID,
			&user.CreatedTs,
			&user.UpdatedTs,
		); err != nil {
			fmt.Println(err)
			return nil, FormatError(err)
		}

		list = append(list, &user)
	}

	if err := rows.Err(); err != nil {
		return nil, FormatError(err)
	}

	return list, nil
}
