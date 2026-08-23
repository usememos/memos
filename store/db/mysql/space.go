package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	mysqldriver "github.com/go-sql-driver/mysql"
	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateSpace(ctx context.Context, create *store.Space, creatorID int32) (*store.Space, error) {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, errors.Wrap(err, "failed to start space create transaction")
	}
	defer func() { _ = tx.Rollback() }()
	if err := requireMySQLActiveUser(ctx, tx, creatorID); err != nil {
		return nil, err
	}
	fields := []string{"uid", "title", "description"}
	values := []string{"?", "?", "?"}
	args := []any{create.UID, create.Title, create.Description}
	result, err := tx.ExecContext(ctx, "INSERT INTO space ("+strings.Join(fields, ", ")+") VALUES ("+strings.Join(values, ", ")+")", args...)
	if err != nil {
		if isMySQLUniqueViolation(err) {
			return nil, store.ErrSpaceAlreadyExists
		}
		return nil, errors.Wrap(err, "failed to create space")
	}
	rawID, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	spaceID := int32(rawID)
	if _, err := tx.ExecContext(ctx, "INSERT INTO space_member (space_id, user_id, role) VALUES (?, ?, ?)", spaceID, creatorID, store.SpaceMemberRoleAdmin); err != nil {
		return nil, errors.Wrap(err, "failed to create initial space admin")
	}
	space, err := getMySQLSpace(ctx, tx, spaceID)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return space, nil
}

func (d *DB) ListSpaces(ctx context.Context, find *store.FindSpace) ([]*store.Space, error) {
	where, args := []string{"1 = 1"}, []any{}
	if find.ID != nil {
		where, args = append(where, "space.id = ?"), append(args, *find.ID)
	}
	if find.UID != nil {
		where, args = append(where, "space.uid = ?"), append(args, *find.UID)
	}
	if find.MemberUserID != nil {
		where, args = append(where, "EXISTS (SELECT 1 FROM space_member sm JOIN user u ON u.id = sm.user_id WHERE sm.space_id = space.id AND sm.user_id = ? AND sm.role IN ('ADMIN', 'USER') AND u.row_status = 'NORMAL')"), append(args, *find.MemberUserID)
	}
	query := `SELECT space.id, space.uid, space.title, space.description
		FROM space WHERE ` + strings.Join(where, " AND ") + ` ORDER BY space.id DESC`
	query = appendMySQLLimit(query, find.Limit, find.Offset)
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	spaces := []*store.Space{}
	for rows.Next() {
		space := &store.Space{}
		if err := scanMySQLSpace(rows, space); err != nil {
			return nil, err
		}
		spaces = append(spaces, space)
	}
	return spaces, rows.Err()
}

func (d *DB) UpdateSpace(ctx context.Context, update *store.UpdateSpace, actorUserID int32) (*store.Space, error) {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()
	if err := requireMySQLActiveUsers(ctx, tx, actorUserID); err != nil {
		return nil, err
	}
	if err := authorizeMySQLSpaceAdmin(ctx, tx, update.ID, actorUserID); err != nil {
		return nil, err
	}
	sets, args := []string{}, []any{}
	if update.Title != nil {
		sets, args = append(sets, "title = ?"), append(args, *update.Title)
	}
	if update.Description != nil {
		sets, args = append(sets, "description = ?"), append(args, *update.Description)
	}
	args = append(args, update.ID)
	if _, err := tx.ExecContext(ctx, "UPDATE space SET "+strings.Join(sets, ", ")+" WHERE id = ?", args...); err != nil {
		return nil, err
	}
	space, err := getMySQLSpace(ctx, tx, update.ID)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return space, nil
}

func (d *DB) CreateSpaceMember(ctx context.Context, create *store.SpaceMember, actorUserID int32) (*store.SpaceMember, error) {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()
	if err := requireMySQLActiveUsers(ctx, tx, actorUserID, create.UserID); err != nil {
		return nil, err
	}
	if err := authorizeMySQLSpaceAdmin(ctx, tx, create.SpaceID, actorUserID); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, "INSERT INTO space_member (space_id, user_id, role) VALUES (?, ?, ?)", create.SpaceID, create.UserID, create.Role); err != nil {
		if isMySQLUniqueViolation(err) {
			return nil, store.ErrSpaceMemberAlreadyExists
		}
		return nil, err
	}
	member, err := getMySQLSpaceMember(ctx, tx, create.SpaceID, create.UserID)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return member, nil
}

func (d *DB) ListSpaceMembers(ctx context.Context, find *store.FindSpaceMember) ([]*store.SpaceMember, error) {
	where, args := []string{
		"space_member.role IN ('ADMIN', 'USER')",
		"EXISTS (SELECT 1 FROM space member_space WHERE member_space.id = space_member.space_id)",
		"EXISTS (SELECT 1 FROM user member_user WHERE member_user.id = space_member.user_id AND member_user.row_status = 'NORMAL')",
	}, []any{}
	if find.SpaceID != nil {
		where, args = append(where, "space_id = ?"), append(args, *find.SpaceID)
	}
	if find.UserID != nil {
		where, args = append(where, "user_id = ?"), append(args, *find.UserID)
	}
	if find.ViewerUserID != nil {
		where, args = append(where, "EXISTS (SELECT 1 FROM space_member viewer JOIN user viewer_user ON viewer_user.id = viewer.user_id WHERE viewer.space_id = space_member.space_id AND viewer.user_id = ? AND viewer.role IN ('ADMIN', 'USER') AND viewer_user.row_status = 'NORMAL')"), append(args, *find.ViewerUserID)
	}
	query := `SELECT space_id, user_id, role FROM space_member
		WHERE ` + strings.Join(where, " AND ") + ` ORDER BY user_id ASC`
	query = appendMySQLLimit(query, find.Limit, find.Offset)
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	members := []*store.SpaceMember{}
	for rows.Next() {
		member := &store.SpaceMember{}
		if err := rows.Scan(&member.SpaceID, &member.UserID, &member.Role); err != nil {
			return nil, err
		}
		members = append(members, member)
	}
	return members, rows.Err()
}

func (d *DB) UpdateSpaceMember(ctx context.Context, update *store.UpdateSpaceMember, actorUserID int32) (*store.SpaceMember, error) {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()
	if err := requireMySQLActiveUsers(ctx, tx, actorUserID, update.UserID); err != nil {
		return nil, err
	}
	if err := authorizeMySQLSpaceAdmin(ctx, tx, update.SpaceID, actorUserID); err != nil {
		return nil, err
	}
	current, err := getMySQLSpaceMember(ctx, tx, update.SpaceID, update.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.ErrSpaceMemberNotFound
		}
		return nil, err
	}
	if current.Role == store.SpaceMemberRoleAdmin && update.Role != nil && *update.Role != store.SpaceMemberRoleAdmin {
		var count int
		if err := tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM space_member sm JOIN user u ON u.id = sm.user_id WHERE sm.space_id = ? AND sm.role = ? AND u.row_status = 'NORMAL'", update.SpaceID, store.SpaceMemberRoleAdmin).Scan(&count); err != nil {
			return nil, err
		}
		if count <= 1 {
			return nil, store.ErrLastSpaceAdmin
		}
	}
	sets, args := []string{}, []any{}
	if update.Role != nil {
		sets, args = append(sets, "role = ?"), append(args, *update.Role)
	}
	args = append(args, update.SpaceID, update.UserID)
	if _, err := tx.ExecContext(ctx, "UPDATE space_member SET "+strings.Join(sets, ", ")+" WHERE space_id = ? AND user_id = ?", args...); err != nil {
		return nil, err
	}
	member, err := getMySQLSpaceMember(ctx, tx, update.SpaceID, update.UserID)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return member, nil
}

func (d *DB) DeleteSpaceMember(ctx context.Context, delete *store.DeleteSpaceMember, actorUserID int32) error {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	userStatuses, err := readMySQLUserStatuses(ctx, tx, actorUserID, delete.UserID)
	if err != nil {
		return err
	}
	if actorUserID != delete.UserID && userStatuses[actorUserID] != store.Normal {
		return store.ErrSpacePermissionDenied
	}
	var spaceID int32
	if err := tx.QueryRowContext(ctx, "SELECT id FROM space WHERE id = ?", delete.SpaceID).Scan(&spaceID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.ErrSpaceNotFound
		}
		return err
	}
	if actorUserID != delete.UserID {
		var role store.SpaceMemberRole
		if err := tx.QueryRowContext(ctx, "SELECT role FROM space_member WHERE space_id = ? AND user_id = ?", delete.SpaceID, actorUserID).Scan(&role); errors.Is(err, sql.ErrNoRows) {
			return store.ErrSpacePermissionDenied
		} else if err != nil {
			return err
		} else if role != store.SpaceMemberRoleAdmin {
			return store.ErrSpacePermissionDenied
		}
	}
	member, err := getMySQLSpaceMember(ctx, tx, delete.SpaceID, delete.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.ErrSpaceMemberNotFound
		}
		return err
	}
	if member.Role == store.SpaceMemberRoleAdmin && userStatuses[delete.UserID] == store.Normal {
		var count int
		if err := tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM space_member sm JOIN user u ON u.id = sm.user_id WHERE sm.space_id = ? AND sm.role = ? AND u.row_status = 'NORMAL'", delete.SpaceID, store.SpaceMemberRoleAdmin).Scan(&count); err != nil {
			return err
		}
		if count <= 1 {
			return store.ErrLastSpaceAdmin
		}
	}
	if _, err := tx.ExecContext(ctx, "DELETE FROM space_member WHERE space_id = ? AND user_id = ?", delete.SpaceID, delete.UserID); err != nil {
		return err
	}
	return tx.Commit()
}

type mysqlRowScanner interface{ Scan(...any) error }

func scanMySQLSpace(row mysqlRowScanner, space *store.Space) error {
	return row.Scan(&space.ID, &space.UID, &space.Title, &space.Description)
}

func getMySQLSpace(ctx context.Context, tx *sql.Tx, id int32) (*store.Space, error) {
	space := &store.Space{}
	return space, scanMySQLSpace(tx.QueryRowContext(ctx, `SELECT id, uid, title, description FROM space WHERE id = ?`, id), space)
}

func getMySQLSpaceMember(ctx context.Context, tx *sql.Tx, spaceID, userID int32) (*store.SpaceMember, error) {
	member := &store.SpaceMember{}
	err := tx.QueryRowContext(ctx, `SELECT space_id, user_id, role FROM space_member WHERE space_id = ? AND user_id = ?`, spaceID, userID).Scan(&member.SpaceID, &member.UserID, &member.Role)
	return member, err
}

func authorizeMySQLSpaceAdmin(ctx context.Context, tx *sql.Tx, spaceID, actorUserID int32) error {
	var existingSpaceID int32
	if err := tx.QueryRowContext(ctx, "SELECT id FROM space WHERE id = ?", spaceID).Scan(&existingSpaceID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.ErrSpaceNotFound
		}
		return err
	}
	var role store.SpaceMemberRole
	if err := tx.QueryRowContext(ctx, "SELECT role FROM space_member WHERE space_id = ? AND user_id = ?", spaceID, actorUserID).Scan(&role); errors.Is(err, sql.ErrNoRows) {
		return store.ErrSpacePermissionDenied
	} else if err != nil {
		return err
	} else if role != store.SpaceMemberRoleAdmin {
		return store.ErrSpacePermissionDenied
	}
	return nil
}

func requireMySQLActiveUser(ctx context.Context, tx *sql.Tx, userID int32) error {
	return requireMySQLActiveUsers(ctx, tx, userID)
}

func requireMySQLActiveUsers(ctx context.Context, tx *sql.Tx, userIDs ...int32) error {
	statuses, err := readMySQLUserStatuses(ctx, tx, userIDs...)
	if err != nil {
		return err
	}
	for _, userID := range userIDs {
		if statuses[userID] != store.Normal {
			return store.ErrSpaceMemberNotActive
		}
	}
	return nil
}

func readMySQLUserStatuses(ctx context.Context, tx *sql.Tx, userIDs ...int32) (map[int32]store.RowStatus, error) {
	statuses := make(map[int32]store.RowStatus, len(userIDs))
	for _, userID := range userIDs {
		if _, ok := statuses[userID]; ok {
			continue
		}
		var status store.RowStatus
		if err := tx.QueryRowContext(ctx, "SELECT row_status FROM user WHERE id = ?", userID).Scan(&status); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				continue
			}
			return nil, err
		}
		statuses[userID] = status
	}
	return statuses, nil
}

func appendMySQLLimit(query string, limit, offset *int) string {
	if limit != nil {
		query = fmt.Sprintf("%s LIMIT %d", query, *limit)
		if offset != nil {
			query = fmt.Sprintf("%s OFFSET %d", query, *offset)
		}
	}
	return query
}

func isMySQLUniqueViolation(err error) bool {
	var mysqlErr *mysqldriver.MySQLError
	return errors.As(err, &mysqlErr) && mysqlErr.Number == 1062
}
