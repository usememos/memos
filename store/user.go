package store

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
)

// Role is the type of a role.
type Role string

const (
	// Host is the HOST role.
	Host Role = "HOST"
	// Admin is the ADMIN role.
	Admin Role = "ADMIN"
	// NormalUser is the USER role.
	NormalUser Role = "USER"
)

func (e Role) String() string {
	switch e {
	case Host:
		return "HOST"
	case Admin:
		return "ADMIN"
	case NormalUser:
		return "USER"
	}
	return "USER"
}

type UserMessage struct {
	ID int

	// Standard fields
	RowStatus RowStatus
	CreatedTs int64
	UpdatedTs int64

	// Domain specific fields
	Username     string
	Role         Role
	Email        string
	Nickname     string
	PasswordHash string
	OpenID       string
	AvatarURL    string
}

type FindUserMessage struct {
	ID *int

	// Standard fields
	RowStatus *RowStatus

	// Domain specific fields
	Username *string
	Role     *Role
	Email    *string
	Nickname *string
	OpenID   *string
}

func (s *Store) CreateUserV1(ctx context.Context, create *UserMessage) (*UserMessage, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	query := `
		INSERT INTO user (
			username,
			role,
			email,
			nickname,
			password_hash,
			open_id
		)
		VALUES (?, ?, ?, ?, ?, ?)
		RETURNING id, avatar_url, created_ts, updated_ts, row_status
	`
	if err := tx.QueryRowContext(ctx, query,
		create.Username,
		create.Role,
		create.Email,
		create.Nickname,
		create.PasswordHash,
		create.OpenID,
	).Scan(
		&create.ID,
		&create.AvatarURL,
		&create.CreatedTs,
		&create.UpdatedTs,
		&create.RowStatus,
	); err != nil {
		return nil, FormatError(err)
	}
	if err := tx.Commit(); err != nil {
		return nil, FormatError(err)
	}
	userMessage := create
	return userMessage, nil
}

func (s *Store) ListUsers(ctx context.Context, find *FindUserMessage) ([]*UserMessage, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	list, err := listUsers(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	return list, nil
}

func (s *Store) GetUser(ctx context.Context, find *FindUserMessage) (*UserMessage, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	list, err := listUsers(ctx, tx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, &common.Error{Code: common.NotFound, Err: fmt.Errorf("user not found")}
	}

	memoMessage := list[0]
	return memoMessage, nil
}

func listUsers(ctx context.Context, tx *sql.Tx, find *FindUserMessage) ([]*UserMessage, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.ID; v != nil {
		where, args = append(where, "id = ?"), append(args, *v)
	}
	if v := find.Username; v != nil {
		where, args = append(where, "username = ?"), append(args, *v)
	}
	if v := find.Role; v != nil {
		where, args = append(where, "role = ?"), append(args, *v)
	}
	if v := find.Email; v != nil {
		where, args = append(where, "email = ?"), append(args, *v)
	}
	if v := find.Nickname; v != nil {
		where, args = append(where, "nickname = ?"), append(args, *v)
	}
	if v := find.OpenID; v != nil {
		where, args = append(where, "open_id = ?"), append(args, *v)
	}

	query := `
		SELECT 
			id,
			username,
			role,
			email,
			nickname,
			password_hash,
			open_id,
			avatar_url,
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

	userMessageList := make([]*UserMessage, 0)
	for rows.Next() {
		var userMessage UserMessage
		if err := rows.Scan(
			&userMessage.ID,
			&userMessage.Username,
			&userMessage.Role,
			&userMessage.Email,
			&userMessage.Nickname,
			&userMessage.PasswordHash,
			&userMessage.OpenID,
			&userMessage.AvatarURL,
			&userMessage.CreatedTs,
			&userMessage.UpdatedTs,
			&userMessage.RowStatus,
		); err != nil {
			return nil, FormatError(err)
		}
		userMessageList = append(userMessageList, &userMessage)
	}

	if err := rows.Err(); err != nil {
		return nil, FormatError(err)
	}

	return userMessageList, nil
}

// userRaw is the store model for an User.
// Fields have exactly the same meanings as User.
type userRaw struct {
	ID int

	// Standard fields
	RowStatus api.RowStatus
	CreatedTs int64
	UpdatedTs int64

	// Domain specific fields
	Username     string
	Role         api.Role
	Email        string
	Nickname     string
	PasswordHash string
	OpenID       string
	AvatarURL    string
}

func (raw *userRaw) toUser() *api.User {
	return &api.User{
		ID: raw.ID,

		RowStatus: raw.RowStatus,
		CreatedTs: raw.CreatedTs,
		UpdatedTs: raw.UpdatedTs,

		Username:     raw.Username,
		Role:         raw.Role,
		Email:        raw.Email,
		Nickname:     raw.Nickname,
		PasswordHash: raw.PasswordHash,
		OpenID:       raw.OpenID,
		AvatarURL:    raw.AvatarURL,
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

	s.userCache.Store(userRaw.ID, userRaw)
	user := userRaw.toUser()

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

	s.userCache.Store(userRaw.ID, userRaw)
	user := userRaw.toUser()
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
		if user, ok := s.userCache.Load(*find.ID); ok {
			return user.(*userRaw).toUser(), nil
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
		return nil, &common.Error{Code: common.NotFound, Err: fmt.Errorf("not found user with filter %+v", find)}
	}

	userRaw := list[0]
	s.userCache.Store(userRaw.ID, userRaw)
	user := userRaw.toUser()
	return user, nil
}

func (s *Store) DeleteUser(ctx context.Context, delete *api.UserDelete) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return FormatError(err)
	}
	defer tx.Rollback()

	if err := deleteUser(ctx, tx, delete); err != nil {
		return err
	}
	if err := s.vacuumImpl(ctx, tx); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	s.userCache.Delete(delete.ID)
	return nil
}

func createUser(ctx context.Context, tx *sql.Tx, create *api.UserCreate) (*userRaw, error) {
	query := `
		INSERT INTO user (
			username,
			role,
			email,
			nickname,
			password_hash,
			open_id
		)
		VALUES (?, ?, ?, ?, ?, ?)
		RETURNING id, username, role, email, nickname, password_hash, open_id, avatar_url, created_ts, updated_ts, row_status
	`
	var userRaw userRaw
	if err := tx.QueryRowContext(ctx, query,
		create.Username,
		create.Role,
		create.Email,
		create.Nickname,
		create.PasswordHash,
		create.OpenID,
	).Scan(
		&userRaw.ID,
		&userRaw.Username,
		&userRaw.Role,
		&userRaw.Email,
		&userRaw.Nickname,
		&userRaw.PasswordHash,
		&userRaw.OpenID,
		&userRaw.AvatarURL,
		&userRaw.CreatedTs,
		&userRaw.UpdatedTs,
		&userRaw.RowStatus,
	); err != nil {
		return nil, FormatError(err)
	}

	return &userRaw, nil
}

func patchUser(ctx context.Context, tx *sql.Tx, patch *api.UserPatch) (*userRaw, error) {
	set, args := []string{}, []any{}

	if v := patch.UpdatedTs; v != nil {
		set, args = append(set, "updated_ts = ?"), append(args, *v)
	}
	if v := patch.RowStatus; v != nil {
		set, args = append(set, "row_status = ?"), append(args, *v)
	}
	if v := patch.Username; v != nil {
		set, args = append(set, "username = ?"), append(args, *v)
	}
	if v := patch.Email; v != nil {
		set, args = append(set, "email = ?"), append(args, *v)
	}
	if v := patch.Nickname; v != nil {
		set, args = append(set, "nickname = ?"), append(args, *v)
	}
	if v := patch.AvatarURL; v != nil {
		set, args = append(set, "avatar_url = ?"), append(args, *v)
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
		RETURNING id, username, role, email, nickname, password_hash, open_id, avatar_url, created_ts, updated_ts, row_status
	`
	var userRaw userRaw
	if err := tx.QueryRowContext(ctx, query, args...).Scan(
		&userRaw.ID,
		&userRaw.Username,
		&userRaw.Role,
		&userRaw.Email,
		&userRaw.Nickname,
		&userRaw.PasswordHash,
		&userRaw.OpenID,
		&userRaw.AvatarURL,
		&userRaw.CreatedTs,
		&userRaw.UpdatedTs,
		&userRaw.RowStatus,
	); err != nil {
		return nil, FormatError(err)
	}

	return &userRaw, nil
}

func findUserList(ctx context.Context, tx *sql.Tx, find *api.UserFind) ([]*userRaw, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.ID; v != nil {
		where, args = append(where, "id = ?"), append(args, *v)
	}
	if v := find.Username; v != nil {
		where, args = append(where, "username = ?"), append(args, *v)
	}
	if v := find.Role; v != nil {
		where, args = append(where, "role = ?"), append(args, *v)
	}
	if v := find.Email; v != nil {
		where, args = append(where, "email = ?"), append(args, *v)
	}
	if v := find.Nickname; v != nil {
		where, args = append(where, "nickname = ?"), append(args, *v)
	}
	if v := find.OpenID; v != nil {
		where, args = append(where, "open_id = ?"), append(args, *v)
	}

	query := `
		SELECT 
			id,
			username,
			role,
			email,
			nickname,
			password_hash,
			open_id,
			avatar_url,
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
			&userRaw.Username,
			&userRaw.Role,
			&userRaw.Email,
			&userRaw.Nickname,
			&userRaw.PasswordHash,
			&userRaw.OpenID,
			&userRaw.AvatarURL,
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
		DELETE FROM user WHERE id = ?
	`, delete.ID)
	if err != nil {
		return FormatError(err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return &common.Error{Code: common.NotFound, Err: fmt.Errorf("user not found")}
	}

	return nil
}
