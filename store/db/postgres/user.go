package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateUser(ctx context.Context, create *store.User) (*store.User, error) {
	if err := insertUser(ctx, d.db, create); err != nil {
		return nil, err
	}
	return create, nil
}

func (d *DB) UpdateUser(ctx context.Context, update *store.UpdateUser) (*store.User, error) {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()
	if update.RowStatus != nil && *update.RowStatus == store.Archived {
		if err := validatePostgresUserArchive(ctx, tx, update.ID); err != nil {
			return nil, err
		}
	}
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
	if err := tx.QueryRowContext(ctx, query, args...).Scan(
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
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return user, nil
}

func validatePostgresUserArchive(ctx context.Context, tx *sql.Tx, userID int32) error {
	var isLastActiveAdmin bool
	if err := tx.QueryRowContext(ctx, `SELECT EXISTS (
		SELECT 1
		FROM "user" target_user
		JOIN space_member target ON target.user_id = target_user.id AND target.role = 'ADMIN'
		JOIN space ON space.id = target.space_id
		WHERE target_user.id = $1
			AND target_user.row_status = 'NORMAL'
			AND NOT EXISTS (
				SELECT 1
				FROM space_member other
				JOIN "user" other_user ON other_user.id = other.user_id
				WHERE other.space_id = target.space_id
					AND other.user_id <> target.user_id
					AND other.role = 'ADMIN'
					AND other_user.row_status = 'NORMAL'
			)
	)`, userID).Scan(&isLastActiveAdmin); err != nil {
		return err
	}
	if isLastActiveAdmin {
		return store.ErrLastSpaceAdmin
	}
	return nil
}

func (d *DB) ListUsers(ctx context.Context, find *store.FindUser) ([]*store.User, error) {
	where, args := []string{"1 = 1"}, []any{}
	orderBy := []string{"created_ts DESC", "row_status DESC", "id DESC"}

	if len(find.Filters) > 0 {
		return nil, errors.Errorf("user filters are not supported")
	}

	if v := find.ID; v != nil {
		where, args = append(where, "id = "+placeholder(len(args)+1)), append(args, *v)
	}
	if len(find.IDList) > 0 {
		holders := make([]string, 0, len(find.IDList))
		for range find.IDList {
			holders = append(holders, placeholder(len(args)+1))
			args = append(args, find.IDList[len(holders)-1])
		}
		where = append(where, fmt.Sprintf("id IN (%s)", strings.Join(holders, ", ")))
	}
	if len(find.UsernameList) > 0 {
		holders := make([]string, 0, len(find.UsernameList))
		for _, username := range find.UsernameList {
			holders = append(holders, placeholder(len(args)+1))
			args = append(args, username)
		}
		where = append(where, fmt.Sprintf("username IN (%s)", strings.Join(holders, ", ")))
	}
	if v := find.RowStatus; v != nil {
		where, args = append(where, "row_status = "+placeholder(len(args)+1)), append(args, *v)
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
	if v := find.Search; v != nil && strings.TrimSpace(*v) != "" {
		query := strings.ToLower(strings.TrimSpace(*v))
		where, args = append(where, "(LOWER(username) LIKE "+placeholder(len(args)+1)+" OR LOWER(nickname) LIKE "+placeholder(len(args)+2)+")"), append(args, "%"+query+"%", "%"+query+"%")
		orderBy = []string{
			"CASE WHEN LOWER(username) = " + placeholder(len(args)+1) + " THEN 0 " +
				"WHEN LOWER(username) LIKE " + placeholder(len(args)+2) + " THEN 1 " +
				"WHEN LOWER(nickname) LIKE " + placeholder(len(args)+3) + " THEN 2 ELSE 3 END",
			"LENGTH(username) ASC",
			"created_ts DESC",
			"row_status DESC",
		}
		args = append(args, query, query+"%", query+"%")
	}
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
		if v := find.Offset; v != nil {
			query += fmt.Sprintf(" OFFSET %d", *v)
		}
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
