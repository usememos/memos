package mysql

import (
	"context"
	"fmt"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateUser(ctx context.Context, create *store.User) (*store.User, error) {
	fields := []string{"`username`", "`role`", "`email`", "`nickname`", "`password_hash`", "`avatar_url`"}
	placeholder := []string{"?", "?", "?", "?", "?", "?"}
	args := []any{create.Username, create.Role, create.Email, create.Nickname, create.PasswordHash, create.AvatarURL}

	stmt := "INSERT INTO user (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(placeholder, ", ") + ")"
	result, err := d.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	id32 := int32(id)
	list, err := d.ListUsers(ctx, &store.FindUser{ID: &id32})
	if err != nil {
		return nil, err
	}
	if len(list) != 1 {
		return nil, errors.Errorf("unexpected user count: %d", len(list))
	}

	return list[0], nil
}

func (d *DB) UpdateUser(ctx context.Context, update *store.UpdateUser) (*store.User, error) {
	set, args := []string{}, []any{}
	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "`updated_ts` = FROM_UNIXTIME(?)"), append(args, *v)
	}
	if v := update.RowStatus; v != nil {
		set, args = append(set, "`row_status` = ?"), append(args, *v)
	}
	if v := update.Username; v != nil {
		set, args = append(set, "`username` = ?"), append(args, *v)
	}
	if v := update.Email; v != nil {
		set, args = append(set, "`email` = ?"), append(args, *v)
	}
	if v := update.Nickname; v != nil {
		set, args = append(set, "`nickname` = ?"), append(args, *v)
	}
	if v := update.AvatarURL; v != nil {
		set, args = append(set, "`avatar_url` = ?"), append(args, *v)
	}
	if v := update.PasswordHash; v != nil {
		set, args = append(set, "`password_hash` = ?"), append(args, *v)
	}
	if v := update.Description; v != nil {
		set, args = append(set, "`description` = ?"), append(args, *v)
	}
	if v := update.Role; v != nil {
		set, args = append(set, "`role` = ?"), append(args, *v)
	}
	args = append(args, update.ID)

	query := "UPDATE `user` SET " + strings.Join(set, ", ") + " WHERE `id` = ?"
	if _, err := d.db.ExecContext(ctx, query, args...); err != nil {
		return nil, err
	}

	user, err := d.GetUser(ctx, &store.FindUser{ID: &update.ID})
	if err != nil {
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
		where, args = append(where, "`id` = ?"), append(args, *v)
	}
	if v := find.Username; v != nil {
		where, args = append(where, "`username` = ?"), append(args, *v)
	}
	if v := find.Role; v != nil {
		where, args = append(where, "`role` = ?"), append(args, *v)
	}
	if v := find.Email; v != nil {
		where, args = append(where, "`email` = ?"), append(args, *v)
	}
	if v := find.Nickname; v != nil {
		where, args = append(where, "`nickname` = ?"), append(args, *v)
	}

	orderBy := []string{"`created_ts` DESC", "`row_status` DESC"}
	query := "SELECT `id`, `username`, `role`, `email`, `nickname`, `password_hash`, `avatar_url`, `description`, UNIX_TIMESTAMP(`created_ts`), UNIX_TIMESTAMP(`updated_ts`), `row_status` FROM `user` WHERE " + strings.Join(where, " AND ") + " ORDER BY " + strings.Join(orderBy, ", ")
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

func (d *DB) GetUser(ctx context.Context, find *store.FindUser) (*store.User, error) {
	list, err := d.ListUsers(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) != 1 {
		return nil, errors.Errorf("unexpected user count: %d", len(list))
	}
	return list[0], nil
}

func (d *DB) DeleteUser(ctx context.Context, delete *store.DeleteUser) error {
	result, err := d.db.ExecContext(ctx, "DELETE FROM `user` WHERE `id` = ?", delete.ID)
	if err != nil {
		return err
	}
	if _, err := result.RowsAffected(); err != nil {
		return err
	}
	return nil
}
