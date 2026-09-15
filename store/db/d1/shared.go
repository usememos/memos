package d1

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/pkg/errors"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// This file holds the validation reads and batch fragments shared by several
// driver methods. Reads run before a batch; guards re-check the invariants a
// read established so a concurrent change aborts the batch instead of
// producing a partial write.

// activeUserCondition is a guard condition asserting that a user exists and is
// not archived. It binds one argument: the user id.
const activeUserCondition = "EXISTS (SELECT 1 FROM user WHERE id = ? AND row_status = 'NORMAL')"

// activeSpaceMemberCondition asserts an active membership. It binds two
// arguments: the space id and the user id.
const activeSpaceMemberCondition = "EXISTS (SELECT 1 FROM space_member WHERE space_id = ? AND user_id = ? AND status = 'ACTIVE' AND role IN ('ADMIN', 'USER'))"

// requireActiveUser fails with notActive when the user is missing or archived.
func requireActiveUser(ctx context.Context, q querier, userID int32, notActive error) error {
	var rowStatus store.RowStatus
	err := q.QueryRowContext(ctx, "SELECT row_status FROM user WHERE id = ?", userID).Scan(&rowStatus)
	if errors.Is(err, sql.ErrNoRows) {
		return notActive
	}
	if err != nil {
		return err
	}
	if rowStatus != store.Normal {
		return notActive
	}
	return nil
}

// spaceExists reports whether the space row is present.
func spaceExists(ctx context.Context, q querier, spaceID int32) (bool, error) {
	var exists bool
	if err := q.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM space WHERE id = ?)", spaceID).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

// spaceMemberActive reports whether userID is an active member of spaceID.
func spaceMemberActive(ctx context.Context, q querier, spaceID, userID int32) (bool, error) {
	var role store.SpaceMemberRole
	err := q.QueryRowContext(ctx, `SELECT role FROM space_member
		WHERE space_id = ? AND user_id = ? AND status = 'ACTIVE' AND role IN ('ADMIN', 'USER')`, spaceID, userID).Scan(&role)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return role.IsActiveMember(), nil
}

// spaceState resolves existence and the actor's active membership in one call.
func spaceState(ctx context.Context, q querier, spaceID, userID int32) (exists bool, member bool, err error) {
	exists, err = spaceExists(ctx, q, spaceID)
	if err != nil || !exists {
		return exists, false, err
	}
	member, err = spaceMemberActive(ctx, q, spaceID, userID)
	return true, member, err
}

// validateMemoWritePolicy checks that the actor may write memoID under policy,
// optionally for the pending update.
func validateMemoWritePolicy(ctx context.Context, q querier, memoID int32, policy *store.MemoWritePolicy, update *store.UpdateMemo) error {
	if err := requireActiveUser(ctx, q, policy.ActorUserID, store.ErrMemoSpaceMembershipRequired); err != nil {
		return err
	}

	snapshot := new(store.MemoWriteSnapshot)
	var spaceID sql.NullInt64
	if err := q.QueryRowContext(ctx, `SELECT creator_id, row_status, space_id, visibility FROM memo WHERE id = ?`, memoID).Scan(
		&snapshot.CreatorID, &snapshot.RowStatus, &spaceID, &snapshot.Visibility,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.ErrMemoMutationConflict
		}
		return err
	}
	snapshot.SpaceID = store.NullInt32Pointer(spaceID)
	if snapshot.SpaceID != nil {
		exists, member, err := spaceState(ctx, q, *snapshot.SpaceID, policy.ActorUserID)
		if err != nil {
			return err
		}
		snapshot.SourceSpaceExists = exists
		snapshot.SourceMemberActive = member
	}
	if update != nil && update.SpaceID != nil {
		exists, member, err := spaceState(ctx, q, *update.SpaceID, policy.ActorUserID)
		if err != nil {
			return err
		}
		snapshot.TargetSpaceExists = exists
		snapshot.TargetMemberActive = member
	}
	if update != nil && update.Visibility != nil && *update.Visibility == store.SpaceAudience {
		var shareID int32
		err := q.QueryRowContext(ctx, `SELECT id FROM memo_share
			WHERE memo_id = ? AND (expires_ts IS NULL OR expires_ts > CAST(strftime('%s', 'now') AS INTEGER))
			LIMIT 1`, memoID).Scan(&shareID)
		snapshot.HasActiveShare = err == nil
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
	}
	return store.ValidateMemoWriteSnapshot(policy, update, snapshot)
}

// loadMemoParticipation resolves the actor, Space, membership, and memo state
// shared by comment and reaction participation checks. A missing memo yields
// sql.ErrNoRows.
func loadMemoParticipation(ctx context.Context, q querier, memoID, actorUserID int32) (*store.MemoCommentAuthorizationSnapshot, error) {
	snapshot := &store.MemoCommentAuthorizationSnapshot{ActorUserID: actorUserID, ContextID: memoID}
	var actorStatus store.RowStatus
	if err := q.QueryRowContext(ctx, "SELECT row_status FROM user WHERE id = ?", actorUserID).Scan(&actorStatus); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.ErrMemoPermissionDenied
		}
		return nil, err
	}
	snapshot.ActorActive = actorStatus == store.Normal

	var contextSpace sql.NullInt64
	if err := q.QueryRowContext(ctx, `SELECT creator_id, row_status, visibility, space_id FROM memo WHERE id = ?`, memoID).Scan(
		&snapshot.ContextCreatorID, &snapshot.ContextRowStatus, &snapshot.ContextVisibility, &contextSpace,
	); err != nil {
		return nil, err
	}
	snapshot.ContextSpaceID = store.NullInt32Pointer(contextSpace)
	if snapshot.ContextSpaceID != nil {
		exists, member, err := spaceState(ctx, q, *snapshot.ContextSpaceID, actorUserID)
		if err != nil {
			return nil, err
		}
		snapshot.ContextSpaceExists = exists
		snapshot.ContextMemberActive = member
	}
	return snapshot, nil
}

// authorizeMemoComment checks that the actor may comment on contextMemoID.
func authorizeMemoComment(ctx context.Context, q querier, contextMemoID, actorUserID int32) error {
	snapshot, err := loadMemoParticipation(ctx, q, contextMemoID, actorUserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.ErrMemoSpaceNotWritable
		}
		return err
	}
	return store.ValidateMemoCommentAuthorization(snapshot)
}

// memoAccessPredicate builds the memo read predicate for memoAlias and appends
// its bind values to args.
func memoAccessPredicate(access *store.MemoAccessScope, memoAlias, memberAlias string, args *[]any) string {
	clauses := []string{}
	if access.AllowPublic {
		clauses = append(clauses, memoAlias+".visibility = 'PUBLIC'")
	}
	if access.UserID != nil {
		*args = append(*args, *access.UserID)
		authenticated := []string{}

		*args = append(*args, *access.UserID)
		authenticated = append(authenticated, "("+memoAlias+".visibility = 'PRIVATE' AND "+memoAlias+".creator_id = ?)")
		if access.AllowProtected {
			authenticated = append(authenticated, memoAlias+".visibility = 'PROTECTED'")
		}
		*args = append(*args, *access.UserID)
		authenticated = append(authenticated, "("+memoAlias+".visibility = 'SPACE' AND EXISTS (SELECT 1 FROM space_member AS "+memberAlias+" WHERE "+memberAlias+".space_id = "+memoAlias+".space_id AND "+memberAlias+".user_id = ? AND "+memberAlias+".status = 'ACTIVE' AND "+memberAlias+".role IN ('ADMIN', 'USER')))")

		clauses = append(clauses, "(EXISTS (SELECT 1 FROM user AS access_user WHERE access_user.id = ? AND access_user.row_status = 'NORMAL') AND ("+strings.Join(authenticated, " OR ")+"))")
	}
	if len(clauses) == 0 {
		return "1 = 0"
	}

	validMemo := "(" + memoAlias + ".visibility IN ('PUBLIC', 'PROTECTED', 'PRIVATE', 'SPACE')" +
		" AND EXISTS (SELECT 1 FROM user AS valid_creator WHERE valid_creator.id = " + memoAlias + ".creator_id AND valid_creator.row_status IN ('NORMAL', 'ARCHIVED'))" +
		" AND (" + memoAlias + ".visibility <> 'SPACE' OR (" + memoAlias + ".space_id IS NOT NULL" +
		" AND EXISTS (SELECT 1 FROM space AS valid_space WHERE valid_space.id = " + memoAlias + ".space_id))))"
	validState := memoAlias + ".row_status = 'NORMAL'"
	if access.UserID != nil {
		*args = append(*args, *access.UserID)
		validState = fmt.Sprintf("(%s.row_status = 'NORMAL' OR (%s.row_status = 'ARCHIVED' AND %s.creator_id = ?))", memoAlias, memoAlias, memoAlias)
	}
	return "(" + strings.Join(clauses, " OR ") + ") AND " + validMemo + " AND " + validState
}

// scanAttachmentSnapshots reads attachment rows selected by query into
// attachments, skipping ids already in seen.
func scanAttachmentSnapshots(ctx context.Context, q querier, query string, args []any, seen map[int32]struct{}, attachments *[]*store.Attachment) error {
	rows, err := q.QueryContext(ctx, query, args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		attachment := &store.Attachment{}
		var memoID sql.NullInt32
		var storageType string
		var payloadBytes []byte
		if err := rows.Scan(&attachment.ID, &attachment.UID, &attachment.CreatorID, &memoID, &storageType, &attachment.Reference, &payloadBytes); err != nil {
			return err
		}
		if _, exists := seen[attachment.ID]; exists {
			continue
		}
		seen[attachment.ID] = struct{}{}
		if memoID.Valid {
			attachment.MemoID = &memoID.Int32
		}
		attachment.StorageType = storepb.AttachmentStorageType(storepb.AttachmentStorageType_value[storageType])
		payload := &storepb.AttachmentPayload{}
		if len(payloadBytes) > 0 {
			if err := protojsonUnmarshaler.Unmarshal(payloadBytes, payload); err != nil {
				return err
			}
		}
		attachment.Payload = payload
		*attachments = append(*attachments, attachment)
	}
	return rows.Err()
}

const attachmentSnapshotColumns = "id, uid, creator_id, memo_id, storage_type, reference, payload"

// listAttachmentSnapshots loads the attachments with the given ids, ordered by id.
func listAttachmentSnapshots(ctx context.Context, q querier, attachmentIDs []int32) ([]*store.Attachment, error) {
	attachments := make([]*store.Attachment, 0, len(attachmentIDs))
	seen := make(map[int32]struct{}, len(attachmentIDs))
	for _, ids := range chunk(attachmentIDs, inClauseBatchSize) {
		clause, args := inClause(ids)
		if err := scanAttachmentSnapshots(ctx, q, "SELECT "+attachmentSnapshotColumns+" FROM attachment WHERE id IN "+clause+" ORDER BY id", args, seen, &attachments); err != nil {
			return nil, err
		}
	}
	return attachments, nil
}

// listMemoSetAttachments loads every attachment bound to one of memoIDs.
func listMemoSetAttachments(ctx context.Context, q querier, memoIDs []int32) ([]*store.Attachment, error) {
	attachments := make([]*store.Attachment, 0)
	seen := make(map[int32]struct{})
	for _, ids := range chunk(memoIDs, inClauseBatchSize) {
		clause, args := inClause(ids)
		if err := scanAttachmentSnapshots(ctx, q, "SELECT "+attachmentSnapshotColumns+" FROM attachment WHERE memo_id IN "+clause+" ORDER BY id", args, seen, &attachments); err != nil {
			return nil, err
		}
	}
	return attachments, nil
}

// authorizeAttachmentMutation checks the actor may mutate attachments bound to
// memoIDs, optionally requiring the memos' current contents to match.
func authorizeAttachmentMutation(ctx context.Context, q querier, actorUserID int32, memoIDs []int32, expectedMemoContents map[int32]string) error {
	if err := requireActiveUser(ctx, q, actorUserID, store.ErrMemoPermissionDenied); err != nil {
		return err
	}
	for _, memoID := range memoIDs {
		snapshot := &store.MemoWriteSnapshot{}
		var currentSpace sql.NullInt64
		var content string
		if err := q.QueryRowContext(ctx, `SELECT creator_id, row_status, space_id, visibility, content FROM memo WHERE id = ?`, memoID).Scan(
			&snapshot.CreatorID, &snapshot.RowStatus, &currentSpace, &snapshot.Visibility, &content,
		); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return store.ErrMemoMutationConflict
			}
			return errors.Wrap(err, "failed to read attachment memo")
		}
		snapshot.SpaceID = store.NullInt32Pointer(currentSpace)
		if expectedMemoContents != nil && content != expectedMemoContents[memoID] {
			return store.ErrMemoMutationConflict
		}
		if snapshot.SpaceID != nil {
			exists, member, err := spaceState(ctx, q, *snapshot.SpaceID, actorUserID)
			if err != nil {
				return errors.Wrap(err, "failed to read attachment memo space")
			}
			snapshot.SourceSpaceExists = exists
			snapshot.SourceMemberActive = member
		}
		if err := store.ValidateMemoWriteSnapshot(&store.MemoWritePolicy{ActorUserID: actorUserID}, nil, snapshot); err != nil {
			return err
		}
	}
	return nil
}

// attachmentIDs extracts the ids of attachments.
func attachmentIDs(attachments []*store.Attachment) []int32 {
	ids := make([]int32, 0, len(attachments))
	for _, attachment := range attachments {
		if attachment != nil {
			ids = append(ids, attachment.ID)
		}
	}
	return ids
}

// addMemoSetDeletes appends the statements that remove memoIDs together with
// their shares, reactions, bound attachments, and relations. Attachments are
// listed by the caller beforehand so it can report them for storage cleanup.
func addMemoSetDeletes(b *batch, memoIDs []int32, boundAttachmentIDs []int32) {
	for _, ids := range chunk(memoIDs, inClauseBatchSize) {
		clause, args := inClause(ids)
		b.add("DELETE FROM memo_share WHERE memo_id IN "+clause, args...)
	}
	for _, ids := range chunk(memoIDs, inClauseBatchSize) {
		clause, args := inClause(ids)
		b.add("DELETE FROM memo WHERE id IN "+clause, args...)
	}
	for _, ids := range chunk(memoIDs, inClauseBatchSize) {
		clause, args := inClause(ids)
		b.add("DELETE FROM reaction WHERE memo_id IN "+clause, args...)
	}
	for _, ids := range chunk(boundAttachmentIDs, inClauseBatchSize) {
		clause, args := inClause(ids)
		b.add("DELETE FROM attachment WHERE id IN "+clause, args...)
	}
	// Two IN lists share one statement, so halve the chunk to stay within the
	// bind limit.
	for _, ids := range chunk(memoIDs, inClauseBatchSize/2) {
		memoClause, args := inClause(ids)
		relatedClause, relatedArgs := inClause(ids)
		b.add("DELETE FROM memo_relation WHERE memo_id IN "+memoClause+" OR related_memo_id IN "+relatedClause, append(args, relatedArgs...)...)
	}
}

// listMemoIDs returns the ids selected by query, in query order.
func listMemoIDs(ctx context.Context, q querier, query string, args ...any) ([]int32, error) {
	rows, err := q.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ids := make([]int32, 0)
	for rows.Next() {
		var id int32
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// nullableEmail maps the store's "no address" value to SQL NULL so the unique
// index ignores users without an address.
func nullableEmail(email string) any {
	if email == "" {
		return nil
	}
	return email
}
