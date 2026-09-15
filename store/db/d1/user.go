package d1

import (
	"context"
	"database/sql"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

const userColumns = "id, username, role, email, nickname, password_hash, avatar_url, description, created_ts, updated_ts, row_status"

// userLastAdminCondition is true when the user is the only active,
// non-archived administrator of some space. It binds the user id twice.
const userLastAdminCondition = `EXISTS (
	SELECT 1 FROM space_member target
	WHERE target.user_id = ? AND target.status = 'ACTIVE' AND target.role = 'ADMIN'
	AND NOT EXISTS (
		SELECT 1 FROM space_member other JOIN user u ON u.id = other.user_id
		WHERE other.space_id = target.space_id AND other.user_id <> ?
			AND other.status = 'ACTIVE' AND other.role = 'ADMIN' AND u.row_status = 'NORMAL'
	))`

type userRowScanner interface{ Scan(...any) error }

// userScan reads the userColumns of one row.
func userScan(row userRowScanner, user *store.User) error {
	var email sql.NullString
	if err := row.Scan(
		&user.ID,
		&user.Username,
		&user.Role,
		&email,
		&user.Nickname,
		&user.PasswordHash,
		&user.AvatarURL,
		&user.Description,
		&user.CreatedTs,
		&user.UpdatedTs,
		&user.RowStatus,
	); err != nil {
		return err
	}
	user.Email = email.String
	return nil
}

// userInsert inserts create and fills the generated columns from the row.
func userInsert(ctx context.Context, q querier, create *store.User) error {
	query := "INSERT INTO user (username, role, email, nickname, password_hash, avatar_url) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, description, created_ts, updated_ts, row_status"
	return q.QueryRowContext(ctx, query, create.Username, create.Role, nullableEmail(create.Email), create.Nickname, create.PasswordHash, create.AvatarURL).Scan(
		&create.ID,
		&create.Description,
		&create.CreatedTs,
		&create.UpdatedTs,
		&create.RowStatus,
	)
}

// CreateUser inserts a user.
func (d *DB) CreateUser(ctx context.Context, create *store.User) (*store.User, error) {
	if err := userInsert(ctx, d.db, create); err != nil {
		return nil, err
	}
	return create, nil
}

// userValidateArchive fails with ErrLastSpaceAdmin when archiving the user
// would leave a space without an active administrator. A missing user yields
// sql.ErrNoRows.
func userValidateArchive(ctx context.Context, q querier, userID int32) error {
	var current store.RowStatus
	if err := q.QueryRowContext(ctx, "SELECT row_status FROM user WHERE id = ?", userID).Scan(&current); err != nil {
		return err
	}
	if current != store.Normal {
		return nil
	}
	var wouldLoseAdmin bool
	if err := q.QueryRowContext(ctx, "SELECT "+userLastAdminCondition, userID, userID).Scan(&wouldLoseAdmin); err != nil {
		return err
	}
	if wouldLoseAdmin {
		return store.ErrLastSpaceAdmin
	}
	return nil
}

// UpdateUser applies the given user changes, refusing to archive the last administrator of a Space.
func (d *DB) UpdateUser(ctx context.Context, update *store.UpdateUser) (*store.User, error) {
	archiving := update.RowStatus != nil && *update.RowStatus == store.Archived
	validate := func() error {
		if archiving {
			return userValidateArchive(ctx, d.db, update.ID)
		}
		return nil
	}
	if err := validate(); err != nil {
		return nil, err
	}
	set, args := []string{}, []any{}
	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "updated_ts = ?"), append(args, *v)
	}
	if v := update.RowStatus; v != nil {
		set, args = append(set, "row_status = ?"), append(args, *v)
	}
	if v := update.Username; v != nil {
		set, args = append(set, "username = ?"), append(args, *v)
	}
	if v := update.Email; v != nil {
		set, args = append(set, "email = ?"), append(args, nullableEmail(*v))
	}
	if v := update.Nickname; v != nil {
		set, args = append(set, "nickname = ?"), append(args, *v)
	}
	if v := update.AvatarURL; v != nil {
		set, args = append(set, "avatar_url = ?"), append(args, *v)
	}
	if v := update.PasswordHash; v != nil {
		set, args = append(set, "password_hash = ?"), append(args, *v)
	}
	if v := update.Description; v != nil {
		set, args = append(set, "description = ?"), append(args, *v)
	}
	if v := update.Role; v != nil {
		set, args = append(set, "role = ?"), append(args, *v)
	}
	if len(set) == 0 {
		// Nothing to write; report the current row as an update would.
		user := &store.User{}
		if err := userScan(d.db.QueryRowContext(ctx, "SELECT "+userColumns+" FROM user WHERE id = ?", update.ID), user); err != nil {
			return nil, err
		}
		return user, nil
	}
	where := "id = ?"
	args = append(args, update.ID)
	if archiving {
		// The validation read is not transactional with this write, so the
		// last-admin invariant is re-asserted in the statement itself.
		where += " AND (row_status <> 'NORMAL' OR NOT " + userLastAdminCondition + ")"
		args = append(args, update.ID, update.ID)
	}
	query := "UPDATE user SET " + strings.Join(set, ", ") + " WHERE " + where + " RETURNING " + userColumns
	user := &store.User{}
	err := userScan(d.db.QueryRowContext(ctx, query, args...), user)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, spaceRecheck(validate, err)
	}
	if err != nil {
		return nil, err
	}
	return user, nil
}

// ListUsers returns the users matching find.
func (d *DB) ListUsers(ctx context.Context, find *store.FindUser) ([]*store.User, error) {
	if len(find.Filters) > 0 {
		return nil, errors.Errorf("user filters are not supported")
	}
	where, args := []string{"1 = 1"}, []any{}
	orderBy := []string{"created_ts DESC", "row_status DESC", "id DESC"}

	if v := find.ID; v != nil {
		where, args = append(where, "id = ?"), append(args, *v)
	}
	if len(find.IDList) > 0 {
		clause, ids := inClause(find.IDList)
		where, args = append(where, "id IN "+clause), append(args, ids...)
	}
	if len(find.UsernameList) > 0 {
		clause, usernames := inClause(find.UsernameList)
		where, args = append(where, "username IN "+clause), append(args, usernames...)
	}
	if v := find.RowStatus; v != nil {
		where, args = append(where, "row_status = ?"), append(args, *v)
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
	if v := find.Search; v != nil && strings.TrimSpace(*v) != "" {
		query := strings.ToLower(strings.TrimSpace(*v))
		where, args = append(where, "(LOWER(username) LIKE ? OR LOWER(nickname) LIKE ?)"), append(args, "%"+query+"%", "%"+query+"%")
		orderBy = []string{
			"CASE WHEN LOWER(username) = ? THEN 0 WHEN LOWER(username) LIKE ? THEN 1 WHEN LOWER(nickname) LIKE ? THEN 2 ELSE 3 END",
			"LENGTH(username) ASC",
			"created_ts DESC",
			"row_status DESC",
		}
		args = append(args, query, query+"%", query+"%")
	}
	query := "SELECT " + userColumns + " FROM user WHERE " + strings.Join(where, " AND ") + " ORDER BY " + strings.Join(orderBy, ", ")
	query = appendLimit(query, find.Limit, find.Offset)

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]*store.User, 0)
	for rows.Next() {
		user := &store.User{}
		if err := userScan(rows, user); err != nil {
			return nil, err
		}
		list = append(list, user)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}
