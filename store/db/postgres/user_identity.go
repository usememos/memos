package postgres

import (
	"context"
	"database/sql"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

// rowQuerier is satisfied by both *sql.DB and *sql.Tx so the insert statements
// can be shared between the standalone and transactional creation paths.
type rowQuerier interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

func insertUser(ctx context.Context, q rowQuerier, create *store.User) error {
	stmt := "INSERT INTO \"user\" (username, role, email, nickname, password_hash, avatar_url) VALUES (" + placeholders(6) + ") RETURNING id, description, created_ts, updated_ts, row_status"
	return q.QueryRowContext(
		ctx,
		stmt,
		create.Username,
		create.Role,
		create.Email,
		create.Nickname,
		create.PasswordHash,
		create.AvatarURL,
	).Scan(
		&create.ID,
		&create.Description,
		&create.CreatedTs,
		&create.UpdatedTs,
		&create.RowStatus,
	)
}

func insertUserIdentity(ctx context.Context, q rowQuerier, create *store.UserIdentity) error {
	stmt := "INSERT INTO user_identity (user_id, provider, extern_uid) VALUES (" + placeholders(3) + ") RETURNING id, created_ts, updated_ts"
	return q.QueryRowContext(ctx, stmt, create.UserID, create.Provider, create.ExternUID).Scan(
		&create.ID,
		&create.CreatedTs,
		&create.UpdatedTs,
	)
}

func (d *DB) CreateUserIdentity(ctx context.Context, create *store.UserIdentity) (*store.UserIdentity, error) {
	if err := insertUserIdentity(ctx, d.db, create); err != nil {
		return nil, err
	}
	return create, nil
}

func (d *DB) CreateUserWithIdentity(ctx context.Context, createUser *store.User, createIdentity *store.UserIdentity) (*store.User, error) {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, errors.Wrap(err, "failed to begin user identity transaction")
	}
	defer func() {
		_ = tx.Rollback()
	}()

	if err := insertUser(ctx, tx, createUser); err != nil {
		return nil, errors.Wrap(err, "failed to create user")
	}

	createIdentity.UserID = createUser.ID
	if err := insertUserIdentity(ctx, tx, createIdentity); err != nil {
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
		where, args = append(where, "id = "+placeholder(len(args)+1)), append(args, *find.ID)
	}
	if find.UserID != nil {
		where, args = append(where, "user_id = "+placeholder(len(args)+1)), append(args, *find.UserID)
	}
	if find.Provider != nil {
		where, args = append(where, "provider = "+placeholder(len(args)+1)), append(args, *find.Provider)
	}
	if find.ExternUID != nil {
		where, args = append(where, "extern_uid = "+placeholder(len(args)+1)), append(args, *find.ExternUID)
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
		where, args = append(where, "id = "+placeholder(len(args)+1)), append(args, *delete.ID)
	}
	if delete.UserID != nil {
		where, args = append(where, "user_id = "+placeholder(len(args)+1)), append(args, *delete.UserID)
	}
	if delete.Provider != nil {
		where, args = append(where, "provider = "+placeholder(len(args)+1)), append(args, *delete.Provider)
	}

	if _, err := d.db.ExecContext(ctx, "DELETE FROM user_identity WHERE "+strings.Join(where, " AND "), args...); err != nil {
		return err
	}
	return nil
}
