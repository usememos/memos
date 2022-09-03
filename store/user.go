package store

import (
	"context"
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

func (s *Store) CreateUser(ctx context.Context, create *api.UserCreate) (*api.User, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	userRaw, err := createUser(ctx, tx, create)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, FormatError(err)
	}

	user := userRaw.toUser()

	if err := s.cache.UpsertCache(api.UserCache, user.ID, user); err != nil {
		return nil, err
	}

	return user, nil
}

func (s *Store) PatchUser(ctx context.Context, patch *api.UserPatch) (*api.User, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	userRaw, err := patchUser(ctx, tx, patch)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, FormatError(err)
	}

	user := userRaw.toUser()

	if err := s.cache.UpsertCache(api.UserCache, user.ID, user); err != nil {
		return nil, err
	}

	return user, nil
}

func (s *Store) FindUserList(ctx context.Context, find *api.UserFind) ([]*api.User, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	userRawList, err := findUserList(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	list := []*api.User{}
	for _, raw := range userRawList {
		list = append(list, raw.toUser())
	}

	return list, nil
}

func (s *Store) FindUser(ctx context.Context, find *api.UserFind) (*api.User, error) {
	if find.ID != nil {
		user := &api.User{}
		has, err := s.cache.FindCache(api.UserCache, *find.ID, user)
		if err != nil {
			return nil, err
		}
		if has {
			return user, nil
		}
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	list, err := findUserList(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	if len(list) == 0 {
		return nil, nil
	} else if len(list) > 1 {
		return nil, &common.Error{Code: common.Conflict, Err: fmt.Errorf("found %d users with filter %+v, expect 1. ", len(list), find)}
	}

	user := list[0].toUser()

	if err := s.cache.UpsertCache(api.UserCache, user.ID, user); err != nil {
		return nil, err
	}

	return user, nil
}

func (s *Store) DeleteUser(ctx context.Context, delete *api.UserDelete) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return FormatError(err)
	}
	defer tx.Rollback()

	err = deleteUser(ctx, tx, delete)
	if err != nil {
		return FormatError(err)
	}

	if err := tx.Commit(); err != nil {
		return FormatError(err)
	}

	s.cache.DeleteCache(api.UserCache, delete.ID)

	return nil
}

func createUser(ctx context.Context, tx *sql.Tx, create *api.UserCreate) (*userRaw, error) {
	query := `
		INSERT INTO user (
			email,
			role,
			name,
			password_hash,
			open_id
		)
		VALUES (?, ?, ?, ?, ?)
		RETURNING id, email, role, name, password_hash, open_id, created_ts, updated_ts, row_status
	`
	var userRaw userRaw
	if err := tx.QueryRowContext(ctx, query,
		create.Email,
		create.Role,
		create.Name,
		create.PasswordHash,
		create.OpenID,
	).Scan(
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

func patchUser(ctx context.Context, tx *sql.Tx, patch *api.UserPatch) (*userRaw, error) {
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

	query := `
		UPDATE user
		SET ` + strings.Join(set, ", ") + `
		WHERE id = ?
		RETURNING id, email, role, name, password_hash, open_id, created_ts, updated_ts, row_status
	`
	row, err := tx.QueryContext(ctx, query, args...)
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

		if err := row.Err(); err != nil {
			return nil, err
		}

		return &userRaw, nil
	}

	return nil, &common.Error{Code: common.NotFound, Err: fmt.Errorf("user ID not found: %d", patch.ID)}
}

func findUserList(ctx context.Context, tx *sql.Tx, find *api.UserFind) ([]*userRaw, error) {
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

	query := `
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
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_ts DESC, row_status DESC
	`
	rows, err := tx.QueryContext(ctx, query, args...)
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

func deleteUser(ctx context.Context, tx *sql.Tx, delete *api.UserDelete) error {
	result, err := tx.ExecContext(ctx, `
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
