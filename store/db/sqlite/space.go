package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/pkg/errors"
	msqlite "modernc.org/sqlite"
	sqlite3 "modernc.org/sqlite/lib"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateSpace(ctx context.Context, create *store.Space, creatorID int32) (*store.Space, error) {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, errors.Wrap(err, "failed to start space create transaction")
	}
	defer func() { _ = tx.Rollback() }()
	if err := requireSQLiteActiveUser(ctx, tx, creatorID); err != nil {
		return nil, err
	}

	fields := []string{"uid", "title", "description"}
	values := []string{"?", "?", "?"}
	args := []any{create.UID, create.Title, create.Description}
	query := "INSERT INTO space (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(values, ", ") + ") RETURNING id, uid, title, description"
	space := &store.Space{}
	if err := tx.QueryRowContext(ctx, query, args...).Scan(&space.ID, &space.UID, &space.Title, &space.Description); err != nil {
		if isSQLiteUniqueViolation(err) {
			return nil, store.ErrSpaceAlreadyExists
		}
		return nil, errors.Wrap(err, "failed to create space")
	}
	if _, err := tx.ExecContext(ctx, "INSERT INTO space_member (space_id, user_id, status, role) VALUES (?, ?, ?, ?)", space.ID, creatorID, store.SpaceMemberStatusActive, store.SpaceMemberRoleAdmin); err != nil {
		return nil, errors.Wrap(err, "failed to create initial space admin")
	}
	if err := tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "failed to commit space create transaction")
	}
	return space, nil
}

func (d *DB) ListSpaces(ctx context.Context, find *store.FindSpace) ([]*store.Space, error) {
	where, args := []string{"1 = 1"}, []any{}
	if find.ID != nil {
		where, args = append(where, "space.id = ?"), append(args, *find.ID)
	}
	if len(find.IDList) > 0 {
		placeholders := make([]string, 0, len(find.IDList))
		for _, id := range find.IDList {
			placeholders = append(placeholders, "?")
			args = append(args, id)
		}
		where = append(where, "space.id IN ("+strings.Join(placeholders, ", ")+")")
	}
	if find.UID != nil {
		where, args = append(where, "space.uid = ?"), append(args, *find.UID)
	}
	if find.MemberUserID != nil {
		where, args = append(where, "EXISTS (SELECT 1 FROM space_member sm JOIN user u ON u.id = sm.user_id WHERE sm.space_id = space.id AND sm.user_id = ? AND sm.status = 'ACTIVE' AND sm.role IN ('ADMIN', 'USER') AND u.row_status = 'NORMAL')"), append(args, *find.MemberUserID)
	}
	query := `SELECT space.id, space.uid, space.title, space.description
		FROM space WHERE ` + strings.Join(where, " AND ") + ` ORDER BY space.id DESC`
	query = appendSQLiteLimit(query, find.Limit, find.Offset)
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
	if err := authorizeSQLiteSpaceAdmin(ctx, tx, update.ID, actorUserID); err != nil {
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
	query := `UPDATE space SET ` + strings.Join(sets, ", ") + ` WHERE id = ?
		RETURNING id, uid, title, description`
	space := &store.Space{}
	if err := tx.QueryRowContext(ctx, query, args...).Scan(&space.ID, &space.UID, &space.Title, &space.Description); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return space, nil
}

func (d *DB) CreateSpaceInvitation(ctx context.Context, create *store.SpaceInvitation, actorUserID int32) (*store.SpaceInvitation, error) {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()
	if err := authorizeSQLiteSpaceAdmin(ctx, tx, create.SpaceID, actorUserID); err != nil {
		return nil, err
	}
	if err := requireSQLiteActiveUser(ctx, tx, create.UserID); err != nil {
		return nil, err
	}
	query := `INSERT INTO space_member (space_id, user_id, status, role) VALUES (?, ?, ?, ?)
		RETURNING space_id, user_id, role`
	invitation := &store.SpaceInvitation{}
	if err := tx.QueryRowContext(ctx, query, create.SpaceID, create.UserID, store.SpaceMemberStatusInvited, create.Role).Scan(&invitation.SpaceID, &invitation.UserID, &invitation.Role); err != nil {
		if isSQLiteUniqueViolation(err) {
			return nil, store.ErrSpaceMemberAlreadyExists
		}
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return invitation, nil
}

func (d *DB) ListSpaceMembers(ctx context.Context, find *store.FindSpaceMember) ([]*store.SpaceMember, error) {
	where, args := []string{
		"space_member.status = 'ACTIVE'",
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
		where, args = append(where, "EXISTS (SELECT 1 FROM space_member viewer JOIN user viewer_user ON viewer_user.id = viewer.user_id WHERE viewer.space_id = space_member.space_id AND viewer.user_id = ? AND viewer.status = 'ACTIVE' AND viewer.role IN ('ADMIN', 'USER') AND viewer_user.row_status = 'NORMAL')"), append(args, *find.ViewerUserID)
	}
	query := `SELECT space_id, user_id, role FROM space_member
		WHERE ` + strings.Join(where, " AND ") + ` ORDER BY user_id ASC`
	query = appendSQLiteLimit(query, find.Limit, find.Offset)
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

func (d *DB) ListSpaceInvitations(ctx context.Context, find *store.FindSpaceInvitation) ([]*store.SpaceInvitation, error) {
	where, args := []string{
		"space_member.status = 'INVITED'",
		"space_member.role IN ('ADMIN', 'USER')",
		"EXISTS (SELECT 1 FROM space invitation_space WHERE invitation_space.id = space_member.space_id)",
		"EXISTS (SELECT 1 FROM user invitee WHERE invitee.id = space_member.user_id)",
	}, []any{}
	if find.SpaceID != nil {
		where, args = append(where, "space_member.space_id = ?"), append(args, *find.SpaceID)
	}
	if find.UserID != nil {
		where, args = append(where, "space_member.user_id = ?"), append(args, *find.UserID)
	}
	if find.ViewerUserID != nil {
		where, args = append(where, `(
			(space_member.user_id = ? AND EXISTS (SELECT 1 FROM user viewer_user WHERE viewer_user.id = ? AND viewer_user.row_status = 'NORMAL'))
			OR EXISTS (
				SELECT 1 FROM space_member viewer
				JOIN user viewer_user ON viewer_user.id = viewer.user_id
				WHERE viewer.space_id = space_member.space_id
					AND viewer.user_id = ?
					AND viewer.status = 'ACTIVE'
					AND viewer.role = 'ADMIN'
					AND viewer_user.row_status = 'NORMAL'
			)
		)`), append(args, *find.ViewerUserID, *find.ViewerUserID, *find.ViewerUserID)
	}
	query := `SELECT space_id, user_id, role FROM space_member
		WHERE ` + strings.Join(where, " AND ") + ` ORDER BY space_id DESC, user_id ASC`
	query = appendSQLiteLimit(query, find.Limit, find.Offset)
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	invitations := []*store.SpaceInvitation{}
	for rows.Next() {
		invitation := &store.SpaceInvitation{}
		if err := rows.Scan(&invitation.SpaceID, &invitation.UserID, &invitation.Role); err != nil {
			return nil, err
		}
		invitations = append(invitations, invitation)
	}
	return invitations, rows.Err()
}

func (d *DB) AcceptSpaceInvitation(ctx context.Context, accept *store.AcceptSpaceInvitation, actorUserID int32) (*store.SpaceMember, error) {
	if accept.UserID != actorUserID {
		return nil, store.ErrSpacePermissionDenied
	}
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()
	if err := requireSQLiteActiveUser(ctx, tx, accept.UserID); err != nil {
		return nil, err
	}
	member := &store.SpaceMember{}
	query := `UPDATE space_member SET status = ?
		WHERE space_id = ? AND user_id = ? AND status = ? AND role IN ('ADMIN', 'USER')
		RETURNING space_id, user_id, role`
	if err := tx.QueryRowContext(ctx, query, store.SpaceMemberStatusActive, accept.SpaceID, accept.UserID, store.SpaceMemberStatusInvited).Scan(&member.SpaceID, &member.UserID, &member.Role); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.ErrSpaceInvitationNotFound
		}
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return member, nil
}

func (d *DB) DeclineSpaceInvitation(ctx context.Context, decline *store.DeclineSpaceInvitation, actorUserID int32) error {
	if decline.UserID != actorUserID {
		return store.ErrSpacePermissionDenied
	}
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if err := requireSQLiteActiveUser(ctx, tx, decline.UserID); err != nil {
		return err
	}
	result, err := tx.ExecContext(ctx, "DELETE FROM space_member WHERE space_id = ? AND user_id = ? AND status = ?", decline.SpaceID, decline.UserID, store.SpaceMemberStatusInvited)
	if err != nil {
		return err
	}
	deleted, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if deleted == 0 {
		return store.ErrSpaceInvitationNotFound
	}
	return tx.Commit()
}

func (d *DB) RevokeSpaceInvitation(ctx context.Context, revoke *store.RevokeSpaceInvitation, actorUserID int32) error {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if err := authorizeSQLiteSpaceAdmin(ctx, tx, revoke.SpaceID, actorUserID); err != nil {
		return err
	}
	result, err := tx.ExecContext(ctx, "DELETE FROM space_member WHERE space_id = ? AND user_id = ? AND status = ?", revoke.SpaceID, revoke.UserID, store.SpaceMemberStatusInvited)
	if err != nil {
		return err
	}
	deleted, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if deleted == 0 {
		return store.ErrSpaceInvitationNotFound
	}
	return tx.Commit()
}

func (d *DB) UpdateSpaceMember(ctx context.Context, update *store.UpdateSpaceMember, actorUserID int32) (*store.SpaceMember, error) {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()
	if err := authorizeSQLiteSpaceAdmin(ctx, tx, update.SpaceID, actorUserID); err != nil {
		return nil, err
	}
	if err := requireSQLiteActiveUser(ctx, tx, update.UserID); err != nil {
		return nil, err
	}
	var currentRole store.SpaceMemberRole
	if err := tx.QueryRowContext(ctx, "SELECT role FROM space_member WHERE space_id = ? AND user_id = ? AND status = ?", update.SpaceID, update.UserID, store.SpaceMemberStatusActive).Scan(&currentRole); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.ErrSpaceMemberNotFound
		}
		return nil, err
	}
	if currentRole == store.SpaceMemberRoleAdmin && update.Role != nil && *update.Role != store.SpaceMemberRoleAdmin {
		var count int
		if err := tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM space_member sm JOIN user u ON u.id = sm.user_id WHERE sm.space_id = ? AND sm.status = ? AND sm.role = ? AND u.row_status = 'NORMAL'", update.SpaceID, store.SpaceMemberStatusActive, store.SpaceMemberRoleAdmin).Scan(&count); err != nil {
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
	args = append(args, update.SpaceID, update.UserID, store.SpaceMemberStatusActive)
	query := `UPDATE space_member SET ` + strings.Join(sets, ", ") + ` WHERE space_id = ? AND user_id = ? AND status = ?
		RETURNING space_id, user_id, role`
	member := &store.SpaceMember{}
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
	var spaceID int32
	if err := tx.QueryRowContext(ctx, "SELECT id FROM space WHERE id = ?", delete.SpaceID).Scan(&spaceID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.ErrSpaceNotFound
		}
		return err
	}
	if actorUserID != delete.UserID {
		var actorRole store.SpaceMemberRole
		if err := tx.QueryRowContext(ctx, "SELECT sm.role FROM space_member sm JOIN user u ON u.id = sm.user_id WHERE sm.space_id = ? AND sm.user_id = ? AND sm.status = ? AND u.row_status = 'NORMAL'", delete.SpaceID, actorUserID, store.SpaceMemberStatusActive).Scan(&actorRole); errors.Is(err, sql.ErrNoRows) {
			return store.ErrSpacePermissionDenied
		} else if err != nil {
			return err
		} else if actorRole != store.SpaceMemberRoleAdmin {
			return store.ErrSpacePermissionDenied
		}
	}
	var role store.SpaceMemberRole
	var targetStatus sql.NullString
	if err := tx.QueryRowContext(ctx, "SELECT sm.role, u.row_status FROM space_member sm LEFT JOIN user u ON u.id = sm.user_id WHERE sm.space_id = ? AND sm.user_id = ? AND sm.status = ?", delete.SpaceID, delete.UserID, store.SpaceMemberStatusActive).Scan(&role, &targetStatus); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.ErrSpaceMemberNotFound
		}
		return err
	}
	if role == store.SpaceMemberRoleAdmin && targetStatus.Valid && store.RowStatus(targetStatus.String) == store.Normal {
		var count int
		if err := tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM space_member sm JOIN user u ON u.id = sm.user_id WHERE sm.space_id = ? AND sm.status = ? AND sm.role = ? AND u.row_status = 'NORMAL'", delete.SpaceID, store.SpaceMemberStatusActive, store.SpaceMemberRoleAdmin).Scan(&count); err != nil {
			return err
		}
		if count <= 1 {
			return store.ErrLastSpaceAdmin
		}
	}
	if _, err := tx.ExecContext(ctx, "DELETE FROM space_member WHERE space_id = ? AND user_id = ? AND status = ?", delete.SpaceID, delete.UserID, store.SpaceMemberStatusActive); err != nil {
		return err
	}
	return tx.Commit()
}

func appendSQLiteLimit(query string, limit, offset *int) string {
	if limit != nil {
		query = fmt.Sprintf("%s LIMIT %d", query, *limit)
		if offset != nil {
			query = fmt.Sprintf("%s OFFSET %d", query, *offset)
		}
	}
	return query
}

func authorizeSQLiteSpaceAdmin(ctx context.Context, tx dbExecutor, spaceID, actorUserID int32) error {
	var existingSpaceID int32
	if err := tx.QueryRowContext(ctx, "SELECT id FROM space WHERE id = ?", spaceID).Scan(&existingSpaceID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.ErrSpaceNotFound
		}
		return err
	}
	var role store.SpaceMemberRole
	if err := tx.QueryRowContext(ctx, "SELECT sm.role FROM space_member sm JOIN user u ON u.id = sm.user_id WHERE sm.space_id = ? AND sm.user_id = ? AND sm.status = ? AND u.row_status = 'NORMAL'", spaceID, actorUserID, store.SpaceMemberStatusActive).Scan(&role); errors.Is(err, sql.ErrNoRows) {
		return store.ErrSpacePermissionDenied
	} else if err != nil {
		return err
	} else if role != store.SpaceMemberRoleAdmin {
		return store.ErrSpacePermissionDenied
	}
	return nil
}

func requireSQLiteActiveUser(ctx context.Context, tx dbExecutor, userID int32) error {
	var rowStatus store.RowStatus
	if err := tx.QueryRowContext(ctx, "SELECT row_status FROM user WHERE id = ?", userID).Scan(&rowStatus); errors.Is(err, sql.ErrNoRows) {
		return store.ErrSpaceMemberNotActive
	} else if err != nil {
		return err
	} else if rowStatus != store.Normal {
		return store.ErrSpaceMemberNotActive
	}
	return nil
}

func isSQLiteUniqueViolation(err error) bool {
	var sqliteErr *msqlite.Error
	return errors.As(err, &sqliteErr) && (sqliteErr.Code() == sqlite3.SQLITE_CONSTRAINT_UNIQUE || sqliteErr.Code() == sqlite3.SQLITE_CONSTRAINT_PRIMARYKEY)
}
