package postgres

import (
	"context"

	"github.com/Masterminds/squirrel"
	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateUser(ctx context.Context, create *store.User) (*store.User, error) {
	// Start building the insert statement
	builder := squirrel.Insert(`"user"`).PlaceholderFormat(squirrel.Dollar)

	columns := []string{"username", "role", "email", "nickname", "password_hash", "avatar_url"}
	builder = builder.Columns(columns...)

	values := []any{create.Username, create.Role, create.Email, create.Nickname, create.PasswordHash, create.AvatarURL}

	builder = builder.Values(values...)
	builder = builder.Suffix("RETURNING id")

	// Prepare the final query
	query, args, err := builder.ToSql()
	if err != nil {
		return nil, err
	}

	// Execute the query and get the returned ID
	var id int32
	err = d.db.QueryRowContext(ctx, query, args...).Scan(&id)
	if err != nil {
		return nil, err
	}

	// Use the returned ID to retrieve the full user object
	user, err := d.GetUser(ctx, &store.FindUser{ID: &id})
	if err != nil {
		return nil, err
	}

	return user, nil
}

func (d *DB) UpdateUser(ctx context.Context, update *store.UpdateUser) (*store.User, error) {
	// Start building the update statement
	builder := squirrel.Update(`"user"`).PlaceholderFormat(squirrel.Dollar)

	// Conditionally add set clauses
	if v := update.UpdatedTs; v != nil {
		builder = builder.Set("updated_ts", *v)
	}
	if v := update.RowStatus; v != nil {
		builder = builder.Set("row_status", *v)
	}
	if v := update.Username; v != nil {
		builder = builder.Set("username", *v)
	}
	if v := update.Email; v != nil {
		builder = builder.Set("email", *v)
	}
	if v := update.Nickname; v != nil {
		builder = builder.Set("nickname", *v)
	}
	if v := update.AvatarURL; v != nil {
		builder = builder.Set("avatar_url", *v)
	}
	if v := update.PasswordHash; v != nil {
		builder = builder.Set("password_hash", *v)
	}

	// Add the WHERE clause
	builder = builder.Where(squirrel.Eq{"id": update.ID})

	// Prepare the final query
	query, args, err := builder.ToSql()
	if err != nil {
		return nil, err
	}

	// Execute the query with the context
	if _, err := d.db.ExecContext(ctx, query, args...); err != nil {
		return nil, err
	}

	// Retrieve the updated user
	user, err := d.GetUser(ctx, &store.FindUser{ID: &update.ID})
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (d *DB) ListUsers(ctx context.Context, find *store.FindUser) ([]*store.User, error) {
	// Start building the SELECT statement
	builder := squirrel.Select("id", "username", "role", "email", "nickname", "password_hash", "avatar_url", "created_ts", "updated_ts", "row_status").
		From(`"user"`).
		PlaceholderFormat(squirrel.Dollar)

	// 1 = 1 is often used as a no-op in SQL, ensuring there's always a WHERE clause
	builder = builder.Where("1 = 1")

	// Conditionally add where clauses
	if v := find.ID; v != nil {
		builder = builder.Where(squirrel.Eq{"id": *v})
	}
	if v := find.Username; v != nil {
		builder = builder.Where(squirrel.Eq{"username": *v})
	}
	if v := find.Role; v != nil {
		builder = builder.Where(squirrel.Eq{"role": *v})
	}
	if v := find.Email; v != nil {
		builder = builder.Where(squirrel.Eq{"email": *v})
	}
	if v := find.Nickname; v != nil {
		builder = builder.Where(squirrel.Eq{"nickname": *v})
	}

	// Add ordering
	builder = builder.OrderBy("created_ts DESC", "row_status DESC")

	// Prepare the final query
	query, args, err := builder.ToSql()
	if err != nil {
		return nil, err
	}

	// Execute the query with the context
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
		return nil, errors.Wrapf(nil, "unexpected user count: %d", len(list))
	}
	return list[0], nil
}

func (d *DB) DeleteUser(ctx context.Context, delete *store.DeleteUser) error {
	// Start building the DELETE statement
	builder := squirrel.Delete(`"user"`).
		PlaceholderFormat(squirrel.Dollar).
		Where(squirrel.Eq{"id": delete.ID})

	// Prepare the final query
	query, args, err := builder.ToSql()
	if err != nil {
		return err
	}

	// Execute the query with the context
	result, err := d.db.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}

	if _, err := result.RowsAffected(); err != nil {
		return err
	}

	if err := d.Vacuum(ctx); err != nil {
		// Prevent linter warning.
		return err
	}

	return nil
}
