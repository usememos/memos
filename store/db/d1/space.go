package d1

import (
	"context"
	"database/sql"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// Space methods validate with plain reads and then write with either an
// atomic batch guarded by the same predicates or a single statement whose
// WHERE clause encodes them. When the write touches nothing, the validation
// is re-run so the caller receives the precise store error instead of a
// generic not-found.

// spaceAdminCondition asserts that a user is an active administrator whose
// account is not archived. It binds two arguments: the space id and the user
// id.
const spaceAdminCondition = "EXISTS (SELECT 1 FROM space_member admin_member JOIN user admin_user ON admin_user.id = admin_member.user_id" +
	" WHERE admin_member.space_id = ? AND admin_member.user_id = ? AND admin_member.status = 'ACTIVE' AND admin_member.role = 'ADMIN' AND admin_user.row_status = 'NORMAL')"

// spaceActiveAdminCount counts the active administrators whose accounts are
// not archived. It binds one argument: the space id.
const spaceActiveAdminCount = "(SELECT COUNT(*) FROM space_member counted_member JOIN user counted_user ON counted_user.id = counted_member.user_id" +
	" WHERE counted_member.space_id = ? AND counted_member.status = 'ACTIVE' AND counted_member.role = 'ADMIN' AND counted_user.row_status = 'NORMAL')"

const spaceColumns = "id, uid, title, description, payload"

// spaceRecheck runs validate again after a conditional write matched no row
// or a guard aborted a batch. The precondition that failed is reported when
// validation now fails; otherwise fallback explains the empty write. The
// user methods share it.
func spaceRecheck(validate func() error, fallback error) error {
	if err := validate(); err != nil {
		return err
	}
	return fallback
}

// spaceRequireAdmin fails with ErrSpacePermissionDenied unless the actor is an
// active, non-archived administrator of the space.
func spaceRequireAdmin(ctx context.Context, q querier, spaceID, actorUserID int32) error {
	var role store.SpaceMemberRole
	err := q.QueryRowContext(ctx, `SELECT sm.role FROM space_member sm JOIN user u ON u.id = sm.user_id
		WHERE sm.space_id = ? AND sm.user_id = ? AND sm.status = ? AND u.row_status = 'NORMAL'`, spaceID, actorUserID, store.SpaceMemberStatusActive).Scan(&role)
	if errors.Is(err, sql.ErrNoRows) {
		return store.ErrSpacePermissionDenied
	}
	if err != nil {
		return err
	}
	if role != store.SpaceMemberRoleAdmin {
		return store.ErrSpacePermissionDenied
	}
	return nil
}

// spaceAuthorizeAdmin checks that the space exists and the actor administers it.
func spaceAuthorizeAdmin(ctx context.Context, q querier, spaceID, actorUserID int32) error {
	exists, err := spaceExists(ctx, q, spaceID)
	if err != nil {
		return err
	}
	if !exists {
		return store.ErrSpaceNotFound
	}
	return spaceRequireAdmin(ctx, q, spaceID, actorUserID)
}

// spaceRequireAnotherAdmin fails with ErrLastSpaceAdmin when the space has at
// most one active administrator.
func spaceRequireAnotherAdmin(ctx context.Context, q querier, spaceID int32) error {
	var count int
	if err := q.QueryRowContext(ctx, "SELECT "+spaceActiveAdminCount, spaceID).Scan(&count); err != nil {
		return err
	}
	if count <= 1 {
		return store.ErrLastSpaceAdmin
	}
	return nil
}

func spaceMarshalPayload(payload *storepb.SpacePayload) (string, error) {
	if payload == nil {
		return "{}", nil
	}
	data, err := protojson.Marshal(payload)
	if err != nil {
		return "", errors.Wrap(err, "failed to marshal space payload")
	}
	return string(data), nil
}

type spaceRowScanner interface{ Scan(...any) error }

// spaceScan reads the spaceColumns of one row into a Space.
func spaceScan(row spaceRowScanner, extra ...any) (*store.Space, error) {
	space := &store.Space{}
	var payloadBytes []byte
	targets := append([]any{&space.ID, &space.UID, &space.Title, &space.Description, &payloadBytes}, extra...)
	if err := row.Scan(targets...); err != nil {
		return nil, err
	}
	space.Payload = &storepb.SpacePayload{}
	if err := protojsonUnmarshaler.Unmarshal(payloadBytes, space.Payload); err != nil {
		return nil, errors.Wrap(err, "failed to unmarshal space payload")
	}
	return space, nil
}

// spacePopulateSummary fills the viewer's role and the active member count.
func spacePopulateSummary(ctx context.Context, q querier, space *store.Space, userID int32) error {
	err := q.QueryRowContext(ctx, `SELECT viewer_member.role, COUNT(active_member.user_id)
		FROM space_member viewer_member
		JOIN user viewer_user ON viewer_user.id = viewer_member.user_id
		JOIN space_member active_member ON active_member.space_id = viewer_member.space_id AND active_member.status = 'ACTIVE' AND active_member.role IN ('ADMIN', 'USER')
		JOIN user active_user ON active_user.id = active_member.user_id AND active_user.row_status = 'NORMAL'
		WHERE viewer_member.space_id = ? AND viewer_member.user_id = ? AND viewer_member.status = 'ACTIVE'
			AND viewer_member.role IN ('ADMIN', 'USER') AND viewer_user.row_status = 'NORMAL'
		GROUP BY viewer_member.role`, space.ID, userID).Scan(&space.CurrentUserRole, &space.MemberCount)
	return errors.Wrap(err, "failed to populate space summary")
}

// CreateSpace inserts a Space with its creator as the first administrator.
func (d *DB) CreateSpace(ctx context.Context, create *store.Space, creatorID int32) (*store.Space, error) {
	if err := requireActiveUser(ctx, d.db, creatorID, store.ErrSpaceMemberNotActive); err != nil {
		return nil, err
	}
	payload, err := spaceMarshalPayload(create.Payload)
	if err != nil {
		return nil, err
	}
	// The batch runs in order inside one transaction, so the membership row
	// can find the space inserted just before it; it resolves the row through
	// the unique uid because the generated id is only reported after commit.
	b := newBatch()
	b.guard(activeUserCondition, creatorID)
	b.add("INSERT INTO space (uid, title, description, payload) VALUES (?, ?, ?, ?)", create.UID, create.Title, create.Description, payload)
	b.add("INSERT INTO space_member (space_id, user_id, status, role) SELECT id, ?, ?, ? FROM space WHERE uid = ?",
		creatorID, store.SpaceMemberStatusActive, store.SpaceMemberRoleAdmin, create.UID)
	if _, err := b.commit(ctx, d); err != nil {
		if isUniqueViolation(err) {
			return nil, store.ErrSpaceAlreadyExists
		}
		if isGuardFailure(err) {
			return nil, store.ErrSpaceMemberNotActive
		}
		return nil, errors.Wrap(err, "failed to create space")
	}
	space, err := spaceScan(d.db.QueryRowContext(ctx, "SELECT "+spaceColumns+" FROM space WHERE uid = ?", create.UID))
	if err != nil {
		return nil, errors.Wrap(err, "failed to read created space")
	}
	space.CurrentUserRole = store.SpaceMemberRoleAdmin
	space.MemberCount = 1
	return space, nil
}

// ListSpaces returns the Spaces matching find.
func (d *DB) ListSpaces(ctx context.Context, find *store.FindSpace) ([]*store.Space, error) {
	where, args := []string{"1 = 1"}, []any{}
	selectFields := "space.id, space.uid, space.title, space.description, space.payload"
	joins := ""
	groupBy := ""
	if find.ID != nil {
		where, args = append(where, "space.id = ?"), append(args, *find.ID)
	}
	if len(find.IDList) > 0 {
		clause, ids, err := jsonList(find.IDList)
		if err != nil {
			return nil, err
		}
		where, args = append(where, "space.id IN "+clause), append(args, ids)
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
		groupBy = " GROUP BY space.id, space.uid, space.title, space.description, space.payload, viewer_member.role"
	}
	query := "SELECT " + selectFields + " FROM space" + joins + " WHERE " + strings.Join(where, " AND ") + groupBy + " ORDER BY space.id DESC"
	query = appendLimit(query, find.Limit, find.Offset)
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	spaces := []*store.Space{}
	for rows.Next() {
		var summary []any
		var role store.SpaceMemberRole
		var memberCount int32
		if find.MemberUserID != nil {
			summary = []any{&role, &memberCount}
		}
		space, err := spaceScan(rows, summary...)
		if err != nil {
			return nil, err
		}
		space.CurrentUserRole = role
		space.MemberCount = memberCount
		spaces = append(spaces, space)
	}
	return spaces, rows.Err()
}

// UpdateSpace applies the given Space changes on behalf of an administrator.
func (d *DB) UpdateSpace(ctx context.Context, update *store.UpdateSpace, actorUserID int32) (*store.Space, error) {
	validate := func() error { return spaceAuthorizeAdmin(ctx, d.db, update.ID, actorUserID) }
	if err := validate(); err != nil {
		return nil, err
	}
	sets, args := []string{}, []any{}
	if update.Title != nil {
		sets, args = append(sets, "title = ?"), append(args, *update.Title)
	}
	if update.Description != nil {
		sets, args = append(sets, "description = ?"), append(args, *update.Description)
	}
	if update.Payload != nil {
		payload, err := spaceMarshalPayload(update.Payload)
		if err != nil {
			return nil, err
		}
		sets, args = append(sets, "payload = ?"), append(args, payload)
	}
	args = append(args, update.ID, update.ID, actorUserID)
	query := "UPDATE space SET " + strings.Join(sets, ", ") + " WHERE id = ? AND " + spaceAdminCondition + " RETURNING " + spaceColumns
	space, err := spaceScan(d.db.QueryRowContext(ctx, query, args...))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, spaceRecheck(validate, store.ErrSpacePermissionDenied)
	}
	if err != nil {
		return nil, err
	}
	if err := spacePopulateSummary(ctx, d.db, space, actorUserID); err != nil {
		return nil, err
	}
	return space, nil
}

// CreateSpaceInvitation invites a user to a Space on behalf of an administrator.
func (d *DB) CreateSpaceInvitation(ctx context.Context, create *store.SpaceInvitation, actorUserID int32) (*store.SpaceInvitation, error) {
	validate := func() error {
		if err := spaceAuthorizeAdmin(ctx, d.db, create.SpaceID, actorUserID); err != nil {
			return err
		}
		return requireActiveUser(ctx, d.db, create.UserID, store.ErrSpaceMemberNotActive)
	}
	if err := validate(); err != nil {
		return nil, err
	}
	b := newBatch()
	b.guard(spaceAdminCondition, create.SpaceID, actorUserID)
	b.guard(activeUserCondition, create.UserID)
	b.add("INSERT INTO space_member (space_id, user_id, status, role) VALUES (?, ?, ?, ?)", create.SpaceID, create.UserID, store.SpaceMemberStatusInvited, create.Role)
	if _, err := b.commit(ctx, d); err != nil {
		if isUniqueViolation(err) {
			return nil, store.ErrSpaceMemberAlreadyExists
		}
		if isGuardFailure(err) {
			return nil, spaceRecheck(validate, store.ErrSpacePermissionDenied)
		}
		return nil, err
	}
	return &store.SpaceInvitation{SpaceID: create.SpaceID, UserID: create.UserID, Role: create.Role}, nil
}

// ListSpaceMembers returns the active memberships matching find.
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
	query := "SELECT space_id, user_id, role FROM space_member WHERE " + strings.Join(where, " AND ") + " ORDER BY user_id ASC"
	query = appendLimit(query, find.Limit, find.Offset)
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

// ListSpaceInvitations returns the pending invitations matching find.
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
	query := "SELECT space_id, user_id, role FROM space_member WHERE " + strings.Join(where, " AND ") + " ORDER BY space_id DESC, user_id ASC"
	query = appendLimit(query, find.Limit, find.Offset)
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

// AcceptSpaceInvitation turns the actor's own invitation into an active membership.
func (d *DB) AcceptSpaceInvitation(ctx context.Context, accept *store.AcceptSpaceInvitation, actorUserID int32) (*store.SpaceMember, error) {
	if accept.UserID != actorUserID {
		return nil, store.ErrSpacePermissionDenied
	}
	validate := func() error { return requireActiveUser(ctx, d.db, accept.UserID, store.ErrSpaceMemberNotActive) }
	if err := validate(); err != nil {
		return nil, err
	}
	member := &store.SpaceMember{}
	query := `UPDATE space_member SET status = ?
		WHERE space_id = ? AND user_id = ? AND status = ? AND role IN ('ADMIN', 'USER') AND ` + activeUserCondition + `
		RETURNING space_id, user_id, role`
	err := d.db.QueryRowContext(ctx, query, store.SpaceMemberStatusActive, accept.SpaceID, accept.UserID, store.SpaceMemberStatusInvited, accept.UserID).Scan(&member.SpaceID, &member.UserID, &member.Role)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, spaceRecheck(validate, store.ErrSpaceInvitationNotFound)
	}
	if err != nil {
		return nil, err
	}
	return member, nil
}

// DeclineSpaceInvitation removes the actor's own pending invitation.
func (d *DB) DeclineSpaceInvitation(ctx context.Context, decline *store.DeclineSpaceInvitation, actorUserID int32) error {
	if decline.UserID != actorUserID {
		return store.ErrSpacePermissionDenied
	}
	validate := func() error { return requireActiveUser(ctx, d.db, decline.UserID, store.ErrSpaceMemberNotActive) }
	if err := validate(); err != nil {
		return err
	}
	query := "DELETE FROM space_member WHERE space_id = ? AND user_id = ? AND status = ? AND " + activeUserCondition
	return spaceDeleteInvitation(ctx, d, validate, query, decline.SpaceID, decline.UserID, store.SpaceMemberStatusInvited, decline.UserID)
}

// RevokeSpaceInvitation removes a pending invitation on behalf of an administrator.
func (d *DB) RevokeSpaceInvitation(ctx context.Context, revoke *store.RevokeSpaceInvitation, actorUserID int32) error {
	validate := func() error { return spaceAuthorizeAdmin(ctx, d.db, revoke.SpaceID, actorUserID) }
	if err := validate(); err != nil {
		return err
	}
	query := "DELETE FROM space_member WHERE space_id = ? AND user_id = ? AND status = ? AND " + spaceAdminCondition
	return spaceDeleteInvitation(ctx, d, validate, query, revoke.SpaceID, revoke.UserID, store.SpaceMemberStatusInvited, revoke.SpaceID, actorUserID)
}

// spaceDeleteInvitation runs a conditional invitation delete and explains an
// empty result through validate.
func spaceDeleteInvitation(ctx context.Context, d *DB, validate func() error, query string, args ...any) error {
	result, err := d.db.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}
	deleted, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if deleted == 0 {
		return spaceRecheck(validate, store.ErrSpaceInvitationNotFound)
	}
	return nil
}

// spaceValidateMemberUpdate mirrors the predicates encoded in the
// UpdateSpaceMember statement so a no-op write can be explained.
func spaceValidateMemberUpdate(ctx context.Context, q querier, update *store.UpdateSpaceMember, actorUserID int32) error {
	if err := spaceAuthorizeAdmin(ctx, q, update.SpaceID, actorUserID); err != nil {
		return err
	}
	if err := requireActiveUser(ctx, q, update.UserID, store.ErrSpaceMemberNotActive); err != nil {
		return err
	}
	var currentRole store.SpaceMemberRole
	err := q.QueryRowContext(ctx, "SELECT role FROM space_member WHERE space_id = ? AND user_id = ? AND status = ?", update.SpaceID, update.UserID, store.SpaceMemberStatusActive).Scan(&currentRole)
	if errors.Is(err, sql.ErrNoRows) {
		return store.ErrSpaceMemberNotFound
	}
	if err != nil {
		return err
	}
	if currentRole == store.SpaceMemberRoleAdmin && update.Role != nil && *update.Role != store.SpaceMemberRoleAdmin {
		return spaceRequireAnotherAdmin(ctx, q, update.SpaceID)
	}
	return nil
}

// UpdateSpaceMember changes a membership on behalf of an administrator, keeping at least one active administrator.
func (d *DB) UpdateSpaceMember(ctx context.Context, update *store.UpdateSpaceMember, actorUserID int32) (*store.SpaceMember, error) {
	validate := func() error { return spaceValidateMemberUpdate(ctx, d.db, update, actorUserID) }
	if err := validate(); err != nil {
		return nil, err
	}
	sets, args := []string{}, []any{}
	if update.Role != nil {
		sets, args = append(sets, "role = ?"), append(args, *update.Role)
	}
	if len(sets) == 0 {
		// Nothing to write; report the current membership as an update would.
		member := &store.SpaceMember{}
		err := d.db.QueryRowContext(ctx, "SELECT space_id, user_id, role FROM space_member WHERE space_id = ? AND user_id = ? AND status = ?",
			update.SpaceID, update.UserID, store.SpaceMemberStatusActive).Scan(&member.SpaceID, &member.UserID, &member.Role)
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.ErrSpaceMemberNotFound
		}
		if err != nil {
			return nil, err
		}
		return member, nil
	}
	where := []string{"space_id = ?", "user_id = ?", "status = ?", spaceAdminCondition, activeUserCondition}
	args = append(args, update.SpaceID, update.UserID, store.SpaceMemberStatusActive, update.SpaceID, actorUserID, update.UserID)
	if update.Role != nil && *update.Role != store.SpaceMemberRoleAdmin {
		// Demoting the last active administrator would orphan the space.
		where = append(where, "(role <> 'ADMIN' OR "+spaceActiveAdminCount+" > 1)")
		args = append(args, update.SpaceID)
	}
	query := "UPDATE space_member SET " + strings.Join(sets, ", ") + " WHERE " + strings.Join(where, " AND ") + " RETURNING space_id, user_id, role"
	member := &store.SpaceMember{}
	err := d.db.QueryRowContext(ctx, query, args...).Scan(&member.SpaceID, &member.UserID, &member.Role)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, spaceRecheck(validate, store.ErrSpaceMemberNotFound)
	}
	if err != nil {
		return nil, err
	}
	return member, nil
}

// spaceValidateMemberDelete mirrors the predicates encoded in the
// DeleteSpaceMember statement so a no-op write can be explained.
func spaceValidateMemberDelete(ctx context.Context, q querier, delete *store.DeleteSpaceMember, actorUserID int32) error {
	exists, err := spaceExists(ctx, q, delete.SpaceID)
	if err != nil {
		return err
	}
	if !exists {
		return store.ErrSpaceNotFound
	}
	if actorUserID != delete.UserID {
		if err := spaceRequireAdmin(ctx, q, delete.SpaceID, actorUserID); err != nil {
			return err
		}
	}
	var role store.SpaceMemberRole
	var targetStatus sql.NullString
	err = q.QueryRowContext(ctx, `SELECT sm.role, u.row_status FROM space_member sm LEFT JOIN user u ON u.id = sm.user_id
		WHERE sm.space_id = ? AND sm.user_id = ? AND sm.status = ?`, delete.SpaceID, delete.UserID, store.SpaceMemberStatusActive).Scan(&role, &targetStatus)
	if errors.Is(err, sql.ErrNoRows) {
		return store.ErrSpaceMemberNotFound
	}
	if err != nil {
		return err
	}
	if role == store.SpaceMemberRoleAdmin && targetStatus.Valid && store.RowStatus(targetStatus.String) == store.Normal {
		return spaceRequireAnotherAdmin(ctx, q, delete.SpaceID)
	}
	return nil
}

// DeleteSpaceMember removes a membership, keeping at least one active administrator.
func (d *DB) DeleteSpaceMember(ctx context.Context, delete *store.DeleteSpaceMember, actorUserID int32) error {
	validate := func() error { return spaceValidateMemberDelete(ctx, d.db, delete, actorUserID) }
	if err := validate(); err != nil {
		return err
	}
	where := []string{"space_id = ?", "user_id = ?", "status = ?", "EXISTS (SELECT 1 FROM space WHERE id = ?)"}
	args := []any{delete.SpaceID, delete.UserID, store.SpaceMemberStatusActive, delete.SpaceID}
	if actorUserID != delete.UserID {
		where = append(where, spaceAdminCondition)
		args = append(args, delete.SpaceID, actorUserID)
	}
	// An archived administrator may always be removed; an active one only
	// when another active administrator remains.
	where = append(where, "(role <> 'ADMIN' OR NOT "+activeUserCondition+" OR "+spaceActiveAdminCount+" > 1)")
	args = append(args, delete.UserID, delete.SpaceID)
	result, err := d.db.ExecContext(ctx, "DELETE FROM space_member WHERE "+strings.Join(where, " AND "), args...)
	if err != nil {
		return err
	}
	deleted, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if deleted == 0 {
		return spaceRecheck(validate, store.ErrSpaceMemberNotFound)
	}
	return nil
}
