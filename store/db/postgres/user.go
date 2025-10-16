package postgres

import (
	"context"
	"fmt"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateUser(ctx context.Context, create *store.User) (*store.User, error) {
	fields := []string{"username", "role", "email", "nickname", "password_hash", "avatar_url"}
	args := []any{create.Username, create.Role, create.Email, create.Nickname, create.PasswordHash, create.AvatarURL}
	stmt := "INSERT INTO \"user\" (" + strings.Join(fields, ", ") + ") VALUES (" + placeholders(len(args)) + ") RETURNING id, description, created_ts, updated_ts, row_status"
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(
		&create.ID,
		&create.Description,
		&create.CreatedTs,
		&create.UpdatedTs,
		&create.RowStatus,
	); err != nil {
		return nil, err
	}

	return create, nil
}

func (d *DB) UpdateUser(ctx context.Context, update *store.UpdateUser) (*store.User, error) {
	set, args := []string{}, []any{}
	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "updated_ts = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.RowStatus; v != nil {
		set, args = append(set, "row_status = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.Username; v != nil {
		set, args = append(set, "username = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.Email; v != nil {
		set, args = append(set, "email = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.Nickname; v != nil {
		set, args = append(set, "nickname = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.AvatarURL; v != nil {
		set, args = append(set, "avatar_url = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.PasswordHash; v != nil {
		set, args = append(set, "password_hash = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.Description; v != nil {
		set, args = append(set, "description = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.Role; v != nil {
		set, args = append(set, "role = "+placeholder(len(args)+1)), append(args, *v)
	}

	query := `
		UPDATE "user"
		SET ` + strings.Join(set, ", ") + `
		WHERE id = ` + placeholder(len(args)+1) + `
		RETURNING id, username, role, email, nickname, password_hash, avatar_url, description, created_ts, updated_ts, row_status
	`
	args = append(args, update.ID)
	user := &store.User{}
	if err := d.db.QueryRowContext(ctx, query, args...).Scan(
		&user.ID,
		&user.Username,
		&user.Role,
		&user.Email,
		&user.Nickname,
		&user.PasswordHash,
		&user.AvatarURL,
		&user.Description,
		&user.CreatedTs,
		&user.UpdatedTs,
		&user.RowStatus,
	); err != nil {
		return nil, err
	}

	return user, nil
}

func (d *DB) ListUsers(ctx context.Context, find *store.FindUser) ([]*store.User, error) {
	where, args := []string{"1 = 1"}, []any{}

	if len(find.Filters) > 0 {
		return nil, errors.Errorf("user filters are not supported")
	}

	if v := find.ID; v != nil {
		where, args = append(where, "id = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.Username; v != nil {
		where, args = append(where, "username = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.Role; v != nil {
		where, args = append(where, "role = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.Email; v != nil {
		where, args = append(where, "email = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.Nickname; v != nil {
		where, args = append(where, "nickname = "+placeholder(len(args)+1)), append(args, *v)
	}

	orderBy := []string{"created_ts DESC", "row_status DESC"}
	query := `
		SELECT 
			id,
			username,
			role,
			email,
			nickname,
			password_hash,
			avatar_url,
			description,
			created_ts,
			updated_ts,
			row_status
		FROM "user"
		WHERE ` + strings.Join(where, " AND ") + ` ORDER BY ` + strings.Join(orderBy, ", ")
	if v := find.Limit; v != nil {
		query += fmt.Sprintf(" LIMIT %d", *v)
	}
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]*store.User, 0)
	for rows.Next() {
		var user store.User
		if err := rows.Scan(
			&user.ID,
			&user.Username,
			&user.Role,
			&user.Email,
			&user.Nickname,
			&user.PasswordHash,
			&user.AvatarURL,
			&user.Description,
			&user.CreatedTs,
			&user.UpdatedTs,
			&user.RowStatus,
		); err != nil {
			return nil, err
		}
		list = append(list, &user)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (d *DB) DeleteUser(ctx context.Context, delete *store.DeleteUser) error {
	result, err := d.db.ExecContext(ctx, `DELETE FROM "user" WHERE id = $1`, delete.ID)
	if err != nil {
		return err
	}
	if _, err := result.RowsAffected(); err != nil {
		return err
	}
	return nil
}
