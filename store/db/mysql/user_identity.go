package mysql

import (
	"context"
	"database/sql"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

// execer is satisfied by both *sql.DB and *sql.Tx so the INSERT statements can be
// shared between the standalone and transactional creation paths.
type execer interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

func insertUser(ctx context.Context, e execer, create *store.User) (sql.Result, error) {
	stmt := "INSERT INTO user (`username`, `role`, `email`, `nickname`, `password_hash`, `avatar_url`) VALUES (?, ?, ?, ?, ?, ?)"
	return e.ExecContext(ctx, stmt, create.Username, create.Role, create.Email, create.Nickname, create.PasswordHash, create.AvatarURL)
}

func insertUserIdentity(ctx context.Context, e execer, create *store.UserIdentity) (sql.Result, error) {
	stmt := "INSERT INTO `user_identity` (`user_id`, `provider`, `extern_uid`) VALUES (?, ?, ?)"
	return e.ExecContext(ctx, stmt, create.UserID, create.Provider, create.ExternUID)
}

func (d *DB) CreateUserIdentity(ctx context.Context, create *store.UserIdentity) (*store.UserIdentity, error) {
	result, err := insertUserIdentity(ctx, d.db, create)
	if err != nil {
		return nil, err
	}

	rawID, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	id := int32(rawID)
	list, err := d.ListUserIdentities(ctx, &store.FindUserIdentity{ID: &id})
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, errors.Errorf("failed to create user identity")
	}
	return list[0], nil
}

func (d *DB) CreateUserWithIdentity(ctx context.Context, createUser *store.User, createIdentity *store.UserIdentity) (*store.User, error) {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, errors.Wrap(err, "failed to begin user identity transaction")
	}
	defer func() {
		_ = tx.Rollback()
	}()

	userResult, err := insertUser(ctx, tx, createUser)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create user")
	}
	rawUserID, err := userResult.LastInsertId()
	if err != nil {
		return nil, errors.Wrap(err, "failed to read created user ID")
	}
	createUser.ID = int32(rawUserID)
	// RETURNING is unavailable on MySQL, so read back the DB-populated columns the
	// user cache needs within the same transaction.
	if err := tx.QueryRowContext(
		ctx,
		"SELECT `description`, UNIX_TIMESTAMP(`created_ts`), UNIX_TIMESTAMP(`updated_ts`), `row_status` FROM `user` WHERE `id` = ?",
		createUser.ID,
	).Scan(
		&createUser.Description,
		&createUser.CreatedTs,
		&createUser.UpdatedTs,
		&createUser.RowStatus,
	); err != nil {
		return nil, errors.Wrap(err, "failed to read created user")
	}

	createIdentity.UserID = createUser.ID
	if _, err := insertUserIdentity(ctx, tx, createIdentity); err != nil {
		return nil, errors.Wrap(err, "failed to create user identity")
	}

	if err := tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "failed to commit user identity transaction")
	}
	return createUser, nil
}

func (d *DB) ListUserIdentities(ctx context.Context, find *store.FindUserIdentity) ([]*store.UserIdentity, error) {
	where, args := []string{"1 = 1"}, []any{}

	if find.ID != nil {
		where, args = append(where, "`id` = ?"), append(args, *find.ID)
	}
	if find.UserID != nil {
		where, args = append(where, "`user_id` = ?"), append(args, *find.UserID)
	}
	if find.Provider != nil {
		where, args = append(where, "`provider` = ?"), append(args, *find.Provider)
	}
	if find.ExternUID != nil {
		where, args = append(where, "`extern_uid` = ?"), append(args, *find.ExternUID)
	}

	rows, err := d.db.QueryContext(ctx, `
		SELECT
			id,
			user_id,
			provider,
			extern_uid,
			created_ts,
			updated_ts
		FROM user_identity
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY id ASC`,
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []*store.UserIdentity{}
	for rows.Next() {
		ui := &store.UserIdentity{}
		if err := rows.Scan(
			&ui.ID,
			&ui.UserID,
			&ui.Provider,
			&ui.ExternUID,
			&ui.CreatedTs,
			&ui.UpdatedTs,
		); err != nil {
			return nil, err
		}
		list = append(list, ui)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

func (d *DB) DeleteUserIdentities(ctx context.Context, delete *store.DeleteUserIdentity) error {
	where, args := []string{"1 = 1"}, []any{}

	if delete.ID != nil {
		where, args = append(where, "`id` = ?"), append(args, *delete.ID)
	}
	if delete.UserID != nil {
		where, args = append(where, "`user_id` = ?"), append(args, *delete.UserID)
	}
	if delete.Provider != nil {
		where, args = append(where, "`provider` = ?"), append(args, *delete.Provider)
	}

	if _, err := d.db.ExecContext(ctx, "DELETE FROM `user_identity` WHERE "+strings.Join(where, " AND "), args...); err != nil {
		return err
	}
	return nil
}
