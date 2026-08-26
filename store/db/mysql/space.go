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
	// Lock the creator through the membership insert so a concurrent hard
	// delete either happens before creation or observes the new membership.
	if err := lockMySQLActiveUser(ctx, tx, creatorID); err != nil {
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
	if _, err := tx.ExecContext(ctx, "INSERT INTO space_member (space_id, user_id, status, role) VALUES (?, ?, ?, ?)", spaceID, creatorID, store.SpaceMemberStatusActive, store.SpaceMemberRoleAdmin); err != nil {
		return nil, errors.Wrap(err, "failed to create initial space admin")
	}
	space, err := getMySQLSpace(ctx, tx, spaceID)
	if err != nil {
		return nil, err
	}
	space.CurrentUserRole = store.SpaceMemberRoleAdmin
	space.MemberCount = 1
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return space, nil
}

func (d *DB) ListSpaces(ctx context.Context, find *store.FindSpace) ([]*store.Space, error) {
	where, args := []string{"1 = 1"}, []any{}
	selectFields := "space.id, space.uid, space.title, space.description"
	joins := ""
	groupBy := ""
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
		selectFields += ", viewer_member.role, COUNT(active_member.user_id)"
		joins = ` JOIN space_member viewer_member ON viewer_member.space_id = space.id
			JOIN user viewer_user ON viewer_user.id = viewer_member.user_id
			JOIN space_member active_member ON active_member.space_id = space.id AND active_member.status = 'ACTIVE' AND active_member.role IN ('ADMIN', 'USER')
			JOIN user active_user ON active_user.id = active_member.user_id AND active_user.row_status = 'NORMAL'`
		where = append(where, "viewer_member.user_id = ?", "viewer_member.status = 'ACTIVE'", "viewer_member.role IN ('ADMIN', 'USER')", "viewer_user.row_status = 'NORMAL'")
		args = append(args, *find.MemberUserID)
		groupBy = " GROUP BY space.id, space.uid, space.title, space.description, viewer_member.role"
	}
	query := "SELECT " + selectFields + " FROM space" + joins + " WHERE " + strings.Join(where, " AND ") + groupBy + " ORDER BY space.id DESC"
	query = appendMySQLLimit(query, find.Limit, find.Offset)
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	spaces := []*store.Space{}
	for rows.Next() {
		space := &store.Space{}
		if err := scanMySQLSpaceWithSummary(rows, space, find.MemberUserID != nil); err != nil {
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
	if err := populateMySQLSpaceSummary(ctx, tx, space, actorUserID); err != nil {
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
	if err := authorizeMySQLSpaceAdmin(ctx, tx, create.SpaceID, actorUserID); err != nil {
		return nil, err
	}
	// Relationship creation always locks its parents in Space-then-User order.
	if err := lockMySQLSpace(ctx, tx, create.SpaceID); err != nil {
		return nil, err
	}
	if err := lockMySQLActiveUser(ctx, tx, create.UserID); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, "INSERT INTO space_member (space_id, user_id, status, role) VALUES (?, ?, ?, ?)", create.SpaceID, create.UserID, store.SpaceMemberStatusInvited, create.Role); err != nil {
		if isMySQLUniqueViolation(err) {
			return nil, store.ErrSpaceMemberAlreadyExists
		}
		return nil, err
	}
	invitation, err := getMySQLSpaceInvitation(ctx, tx, create.SpaceID, create.UserID)
	if err != nil {
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
	query = appendMySQLLimit(query, find.Limit, find.Offset)
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
	// Keep the invitee alive until the relationship becomes ACTIVE.
	if err := lockMySQLActiveUser(ctx, tx, accept.UserID); err != nil {
		return nil, err
	}
	result, err := tx.ExecContext(ctx, `UPDATE space_member SET status = ?
		WHERE space_id = ? AND user_id = ? AND status = ? AND role IN ('ADMIN', 'USER')`, store.SpaceMemberStatusActive, accept.SpaceID, accept.UserID, store.SpaceMemberStatusInvited)
	if err != nil {
		return nil, err
	}
	updated, err := result.RowsAffected()
	if err != nil {
		return nil, err
	}
	if updated == 0 {
		return nil, store.ErrSpaceInvitationNotFound
	}
	member, err := getMySQLSpaceMember(ctx, tx, accept.SpaceID, accept.UserID)
	if err != nil {
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
	if err := requireMySQLActiveUser(ctx, tx, decline.UserID); err != nil {
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
	if err := authorizeMySQLSpaceAdmin(ctx, tx, revoke.SpaceID, actorUserID); err != nil {
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
	if err := authorizeMySQLSpaceAdmin(ctx, tx, update.SpaceID, actorUserID); err != nil {
		return nil, err
	}
	if err := requireMySQLActiveUser(ctx, tx, update.UserID); err != nil {
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
	if _, err := tx.ExecContext(ctx, "UPDATE space_member SET "+strings.Join(sets, ", ")+" WHERE space_id = ? AND user_id = ? AND status = ?", args...); err != nil {
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
		if err := tx.QueryRowContext(ctx, "SELECT role FROM space_member WHERE space_id = ? AND user_id = ? AND status = ?", delete.SpaceID, actorUserID, store.SpaceMemberStatusActive).Scan(&role); errors.Is(err, sql.ErrNoRows) {
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

type mysqlRowScanner interface{ Scan(...any) error }

func scanMySQLSpace(row mysqlRowScanner, space *store.Space) error {
	return row.Scan(&space.ID, &space.UID, &space.Title, &space.Description)
}

func scanMySQLSpaceWithSummary(row mysqlRowScanner, space *store.Space, withSummary bool) error {
	if !withSummary {
		return scanMySQLSpace(row, space)
	}
	return row.Scan(&space.ID, &space.UID, &space.Title, &space.Description, &space.CurrentUserRole, &space.MemberCount)
}

func scanMySQLSpaceSummary(row mysqlRowScanner, space *store.Space) error {
	return errors.Wrap(row.Scan(&space.CurrentUserRole, &space.MemberCount), "failed to populate MySQL space summary")
}

func populateMySQLSpaceSummary(ctx context.Context, tx *sql.Tx, space *store.Space, userID int32) error {
	row := tx.QueryRowContext(ctx, `SELECT viewer_member.role, COUNT(active_member.user_id)
		FROM space_member viewer_member
		JOIN user viewer_user ON viewer_user.id = viewer_member.user_id
		JOIN space_member active_member ON active_member.space_id = viewer_member.space_id AND active_member.status = 'ACTIVE' AND active_member.role IN ('ADMIN', 'USER')
		JOIN user active_user ON active_user.id = active_member.user_id AND active_user.row_status = 'NORMAL'
		WHERE viewer_member.space_id = ? AND viewer_member.user_id = ? AND viewer_member.status = 'ACTIVE'
			AND viewer_member.role IN ('ADMIN', 'USER') AND viewer_user.row_status = 'NORMAL'
		GROUP BY viewer_member.role`, space.ID, userID)
	return scanMySQLSpaceSummary(row, space)
}

func getMySQLSpace(ctx context.Context, tx *sql.Tx, id int32) (*store.Space, error) {
	space := &store.Space{}
	return space, scanMySQLSpace(tx.QueryRowContext(ctx, `SELECT id, uid, title, description FROM space WHERE id = ?`, id), space)
}

func getMySQLSpaceMember(ctx context.Context, tx *sql.Tx, spaceID, userID int32) (*store.SpaceMember, error) {
	member := &store.SpaceMember{}
	err := tx.QueryRowContext(ctx, `SELECT space_id, user_id, role FROM space_member WHERE space_id = ? AND user_id = ? AND status = ?`, spaceID, userID, store.SpaceMemberStatusActive).Scan(&member.SpaceID, &member.UserID, &member.Role)
	return member, err
}

func getMySQLSpaceInvitation(ctx context.Context, tx *sql.Tx, spaceID, userID int32) (*store.SpaceInvitation, error) {
	invitation := &store.SpaceInvitation{}
	err := tx.QueryRowContext(ctx, `SELECT space_id, user_id, role FROM space_member WHERE space_id = ? AND user_id = ? AND status = ?`, spaceID, userID, store.SpaceMemberStatusInvited).Scan(&invitation.SpaceID, &invitation.UserID, &invitation.Role)
	return invitation, err
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
	if err := tx.QueryRowContext(ctx, "SELECT sm.role FROM space_member sm JOIN user u ON u.id = sm.user_id WHERE sm.space_id = ? AND sm.user_id = ? AND sm.status = ? AND u.row_status = 'NORMAL'", spaceID, actorUserID, store.SpaceMemberStatusActive).Scan(&role); errors.Is(err, sql.ErrNoRows) {
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

func lockMySQLActiveUser(ctx context.Context, tx *sql.Tx, userID int32) error {
	var status store.RowStatus
	if err := tx.QueryRowContext(ctx, "SELECT row_status FROM user WHERE id = ? FOR UPDATE", userID).Scan(&status); errors.Is(err, sql.ErrNoRows) {
		return store.ErrSpaceMemberNotActive
	} else if err != nil {
		return err
	} else if status != store.Normal {
		return store.ErrSpaceMemberNotActive
	}
	return nil
}

func lockMySQLSpace(ctx context.Context, tx *sql.Tx, spaceID int32) error {
	var storedSpaceID int32
	if err := tx.QueryRowContext(ctx, "SELECT id FROM space WHERE id = ? FOR UPDATE", spaceID).Scan(&storedSpaceID); errors.Is(err, sql.ErrNoRows) {
		return store.ErrSpaceNotFound
	} else if err != nil {
		return err
	}
	return nil
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
