package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/lib/pq"
	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateSpace(ctx context.Context, create *store.Space, creatorID int32) (*store.Space, error) {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()
	if err := requirePostgresActiveUser(ctx, tx, creatorID); err != nil {
		return nil, err
	}
	fields := []string{"uid", "title", "description"}
	args := []any{create.UID, create.Title, create.Description}
	space := &store.Space{}
	query := "INSERT INTO space (" + strings.Join(fields, ", ") + ") VALUES (" + placeholders(len(args)) + ") RETURNING id, uid, title, description"
	if err := tx.QueryRowContext(ctx, query, args...).Scan(&space.ID, &space.UID, &space.Title, &space.Description); err != nil {
		if isPostgresUniqueViolation(err) {
			return nil, store.ErrSpaceAlreadyExists
		}
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, "INSERT INTO space_member (space_id, user_id, role) VALUES ($1, $2, $3)", space.ID, creatorID, store.SpaceMemberRoleAdmin); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return space, nil
}

func (d *DB) ListSpaces(ctx context.Context, find *store.FindSpace) ([]*store.Space, error) {
	where, args := []string{"1 = 1"}, []any{}
	add := func(condition string, value any) {
		args = append(args, value)
		where = append(where, fmt.Sprintf(condition, placeholder(len(args))))
	}
	if find.ID != nil {
		add("space.id = %s", *find.ID)
	}
	if find.UID != nil {
		add("space.uid = %s", *find.UID)
	}
	if find.MemberUserID != nil {
		add(`EXISTS (SELECT 1 FROM space_member sm JOIN "user" u ON u.id = sm.user_id WHERE sm.space_id = space.id AND sm.user_id = %s AND sm.role IN ('ADMIN', 'USER') AND u.row_status = 'NORMAL')`, *find.MemberUserID)
	}
	query := `SELECT space.id, space.uid, space.title, space.description
		FROM space WHERE ` + strings.Join(where, " AND ") + ` ORDER BY space.id DESC`
	query = appendPostgresLimit(query, find.Limit, find.Offset)
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	spaces := []*store.Space{}
	for rows.Next() {
		space := &store.Space{}
		if err := rows.Scan(&space.ID, &space.UID, &space.Title, &space.Description); err != nil {
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
	if err := requirePostgresActiveUsers(ctx, tx, actorUserID); err != nil {
		return nil, err
	}
	if err := authorizePostgresSpaceAdmin(ctx, tx, update.ID, actorUserID); err != nil {
		return nil, err
	}
	sets, args := []string{}, []any{}
	add := func(field string, value any) {
		args = append(args, value)
		sets = append(sets, field+" = "+placeholder(len(args)))
	}
	if update.Title != nil {
		add("title", *update.Title)
	}
	if update.Description != nil {
		add("description", *update.Description)
	}
	args = append(args, update.ID)
	space := &store.Space{}
	query := "UPDATE space SET " + strings.Join(sets, ", ") + " WHERE id = " + placeholder(len(args)) + " RETURNING id, uid, title, description"
	if err := tx.QueryRowContext(ctx, query, args...).Scan(&space.ID, &space.UID, &space.Title, &space.Description); err != nil {
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
	if err := requirePostgresActiveUsers(ctx, tx, actorUserID, create.UserID); err != nil {
		return nil, err
	}
	if err := authorizePostgresSpaceAdmin(ctx, tx, create.SpaceID, actorUserID); err != nil {
		return nil, err
	}
	member := &store.SpaceMember{}
	err = tx.QueryRowContext(ctx, `INSERT INTO space_member (space_id, user_id, role) VALUES ($1, $2, $3)
		RETURNING space_id, user_id, role`, create.SpaceID, create.UserID, create.Role).Scan(&member.SpaceID, &member.UserID, &member.Role)
	if err != nil {
		if isPostgresUniqueViolation(err) {
			return nil, store.ErrSpaceMemberAlreadyExists
		}
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
		`EXISTS (SELECT 1 FROM "user" member_user WHERE member_user.id = space_member.user_id AND member_user.row_status = 'NORMAL')`,
	}, []any{}
	add := func(condition string, value any) {
		args = append(args, value)
		where = append(where, fmt.Sprintf(condition, placeholder(len(args))))
	}
	if find.SpaceID != nil {
		add("space_id = %s", *find.SpaceID)
	}
	if find.UserID != nil {
		add("user_id = %s", *find.UserID)
	}
	if find.ViewerUserID != nil {
		add(`EXISTS (SELECT 1 FROM space_member viewer JOIN "user" viewer_user ON viewer_user.id = viewer.user_id WHERE viewer.space_id = space_member.space_id AND viewer.user_id = %s AND viewer.role IN ('ADMIN', 'USER') AND viewer_user.row_status = 'NORMAL')`, *find.ViewerUserID)
	}
	query := `SELECT space_id, user_id, role FROM space_member WHERE ` + strings.Join(where, " AND ") + ` ORDER BY user_id ASC`
	query = appendPostgresLimit(query, find.Limit, find.Offset)
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
	if err := requirePostgresActiveUsers(ctx, tx, actorUserID, update.UserID); err != nil {
		return nil, err
	}
	if err := authorizePostgresSpaceAdmin(ctx, tx, update.SpaceID, actorUserID); err != nil {
		return nil, err
	}
	current, err := getPostgresSpaceMember(ctx, tx, update.SpaceID, update.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.ErrSpaceMemberNotFound
		}
		return nil, err
	}
	if current.Role == store.SpaceMemberRoleAdmin && update.Role != nil && *update.Role != store.SpaceMemberRoleAdmin {
		var count int
		if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM space_member sm JOIN "user" u ON u.id = sm.user_id WHERE sm.space_id = $1 AND sm.role = $2 AND u.row_status = 'NORMAL'`, update.SpaceID, store.SpaceMemberRoleAdmin).Scan(&count); err != nil {
			return nil, err
		}
		if count <= 1 {
			return nil, store.ErrLastSpaceAdmin
		}
	}
	sets, args := []string{}, []any{}
	add := func(field string, value any) {
		args = append(args, value)
		sets = append(sets, field+" = "+placeholder(len(args)))
	}
	if update.Role != nil {
		add("role", *update.Role)
	}
	args = append(args, update.SpaceID, update.UserID)
	member := &store.SpaceMember{}
	query := "UPDATE space_member SET " + strings.Join(sets, ", ") + " WHERE space_id = " + placeholder(len(args)-1) + " AND user_id = " + placeholder(len(args)) + " RETURNING space_id, user_id, role"
	if err := tx.QueryRowContext(ctx, query, args...).Scan(&member.SpaceID, &member.UserID, &member.Role); err != nil {
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
	userStatuses, err := readPostgresUserStatuses(ctx, tx, actorUserID, delete.UserID)
	if err != nil {
		return err
	}
	if actorUserID != delete.UserID && userStatuses[actorUserID] != store.Normal {
		return store.ErrSpacePermissionDenied
	}
	var spaceID int32
	if err := tx.QueryRowContext(ctx, "SELECT id FROM space WHERE id = $1", delete.SpaceID).Scan(&spaceID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.ErrSpaceNotFound
		}
		return err
	}
	if actorUserID != delete.UserID {
		var role store.SpaceMemberRole
		if err := tx.QueryRowContext(ctx, "SELECT role FROM space_member WHERE space_id = $1 AND user_id = $2", delete.SpaceID, actorUserID).Scan(&role); errors.Is(err, sql.ErrNoRows) {
			return store.ErrSpacePermissionDenied
		} else if err != nil {
			return err
		} else if role != store.SpaceMemberRoleAdmin {
			return store.ErrSpacePermissionDenied
		}
	}
	member, err := getPostgresSpaceMember(ctx, tx, delete.SpaceID, delete.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.ErrSpaceMemberNotFound
		}
		return err
	}
	if member.Role == store.SpaceMemberRoleAdmin && userStatuses[delete.UserID] == store.Normal {
		var count int
		if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM space_member sm JOIN "user" u ON u.id = sm.user_id WHERE sm.space_id = $1 AND sm.role = $2 AND u.row_status = 'NORMAL'`, delete.SpaceID, store.SpaceMemberRoleAdmin).Scan(&count); err != nil {
			return err
		}
		if count <= 1 {
			return store.ErrLastSpaceAdmin
		}
	}
	if _, err := tx.ExecContext(ctx, "DELETE FROM space_member WHERE space_id = $1 AND user_id = $2", delete.SpaceID, delete.UserID); err != nil {
		return err
	}
	return tx.Commit()
}

func authorizePostgresSpaceAdmin(ctx context.Context, tx *sql.Tx, spaceID, actorUserID int32) error {
	var storedSpaceID int32
	if err := tx.QueryRowContext(ctx, "SELECT id FROM space WHERE id = $1", spaceID).Scan(&storedSpaceID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.ErrSpaceNotFound
		}
		return err
	}
	var role store.SpaceMemberRole
	if err := tx.QueryRowContext(ctx, "SELECT role FROM space_member WHERE space_id = $1 AND user_id = $2", spaceID, actorUserID).Scan(&role); errors.Is(err, sql.ErrNoRows) {
		return store.ErrSpacePermissionDenied
	} else if err != nil {
		return err
	} else if role != store.SpaceMemberRoleAdmin {
		return store.ErrSpacePermissionDenied
	}
	return nil
}

func requirePostgresActiveUser(ctx context.Context, tx *sql.Tx, userID int32) error {
	return requirePostgresActiveUsers(ctx, tx, userID)
}

func getPostgresSpaceMember(ctx context.Context, tx *sql.Tx, spaceID, userID int32) (*store.SpaceMember, error) {
	member := &store.SpaceMember{}
	err := tx.QueryRowContext(ctx, `SELECT space_id, user_id, role FROM space_member WHERE space_id = $1 AND user_id = $2`, spaceID, userID).Scan(&member.SpaceID, &member.UserID, &member.Role)
	return member, err
}

func requirePostgresActiveUsers(ctx context.Context, tx *sql.Tx, userIDs ...int32) error {
	statuses, err := readPostgresUserStatuses(ctx, tx, userIDs...)
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

func readPostgresUserStatuses(ctx context.Context, tx *sql.Tx, userIDs ...int32) (map[int32]store.RowStatus, error) {
	statuses := make(map[int32]store.RowStatus, len(userIDs))
	for _, userID := range userIDs {
		if _, ok := statuses[userID]; ok {
			continue
		}
		var status store.RowStatus
		if err := tx.QueryRowContext(ctx, `SELECT row_status FROM "user" WHERE id = $1`, userID).Scan(&status); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				continue
			}
			return nil, err
		}
		statuses[userID] = status
	}
	return statuses, nil
}

func appendPostgresLimit(query string, limit, offset *int) string {
	if limit != nil {
		query = fmt.Sprintf("%s LIMIT %d", query, *limit)
		if offset != nil {
			query = fmt.Sprintf("%s OFFSET %d", query, *offset)
		}
	}
	return query
}

func isPostgresUniqueViolation(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == "23505"
}
