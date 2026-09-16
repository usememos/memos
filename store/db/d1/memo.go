package d1

import (
	"context"
	"database/sql"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"

	"github.com/usememos/memos/filter"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// memoState is the memo row state read before a write batch. Guards built
// from it re-assert the row inside the batch so a concurrent change aborts
// the commit instead of being overwritten.
type memoState struct {
	id         int32
	creatorID  int32
	rowStatus  store.RowStatus
	visibility store.Visibility
	spaceID    *int32
	content    string
}

// loadMemoState reads the memo row; a missing memo yields sql.ErrNoRows.
func loadMemoState(ctx context.Context, q querier, memoID int32) (*memoState, error) {
	state := &memoState{}
	var spaceID sql.NullInt64
	if err := q.QueryRowContext(ctx, "SELECT id, creator_id, row_status, visibility, space_id, content FROM memo WHERE id = ?", memoID).Scan(
		&state.id, &state.creatorID, &state.rowStatus, &state.visibility, &spaceID, &state.content,
	); err != nil {
		return nil, err
	}
	state.spaceID = store.NullInt32Pointer(spaceID)
	return state, nil
}

// unchangedCondition is a guard condition asserting the memo still has the
// ownership, lifecycle, audience, and placement that were read. "IS ?" makes
// a NULL space compare equal to a NULL binding.
func (s *memoState) unchangedCondition() (string, []any) {
	return "EXISTS (SELECT 1 FROM memo WHERE id = ? AND creator_id = ? AND row_status = ? AND visibility = ? AND space_id IS ?)",
		[]any{s.id, s.creatorID, s.rowStatus, s.visibility, s.spaceID}
}

// contentUnchangedCondition extends unchangedCondition with the content the
// caller expects, for mutations that were computed from that content.
func (s *memoState) contentUnchangedCondition() (string, []any) {
	return "EXISTS (SELECT 1 FROM memo WHERE id = ? AND creator_id = ? AND row_status = ? AND visibility = ? AND space_id IS ? AND content = ?)",
		[]any{s.id, s.creatorID, s.rowStatus, s.visibility, s.spaceID, s.content}
}

// CreateMemo inserts a memo after validating its creator and Space placement.
func (d *DB) CreateMemo(ctx context.Context, create *store.Memo) (*store.Memo, error) {
	if err := memoValidateCreate(ctx, d.db, create); err != nil {
		return nil, err
	}
	b := newBatch()
	memoGuardCreate(b, create)
	if err := memoAddInsert(b, create); err != nil {
		return nil, err
	}
	if _, err := b.commit(ctx, d); err != nil {
		// The guards mirror memoValidateCreate; a failure means the creator
		// or the space membership changed between the read and the commit.
		return nil, guardError(err, store.ErrMemoSpaceMembershipRequired)
	}
	if err := memoLoadCreated(ctx, d.db, create); err != nil {
		return nil, err
	}
	return create, nil
}

// memoValidateCreate checks that the creator is active and, for a Space memo,
// an active member of an existing Space.
func memoValidateCreate(ctx context.Context, q querier, create *store.Memo) error {
	if err := requireActiveUser(ctx, q, create.CreatorID, store.ErrMemoSpaceMembershipRequired); err != nil {
		return err
	}
	if create.SpaceID == nil {
		return nil
	}
	exists, member, err := spaceState(ctx, q, *create.SpaceID, create.CreatorID)
	if err != nil {
		return err
	}
	if !exists {
		return store.ErrMemoSpaceNotWritable
	}
	if !member {
		return store.ErrMemoSpaceMembershipRequired
	}
	return nil
}

// memoGuardCreate re-asserts memoValidateCreate inside the batch.
func memoGuardCreate(b *batch, create *store.Memo) {
	b.guard(activeUserCondition, create.CreatorID)
	if create.SpaceID != nil {
		b.guard("EXISTS (SELECT 1 FROM space WHERE id = ?)", *create.SpaceID)
		b.guard(activeSpaceMemberCondition, *create.SpaceID, create.CreatorID)
	}
}

// memoAddInsert appends the memo INSERT. The uid is always written explicitly
// because later statements in the same batch can only find the new row by it.
func memoAddInsert(b *batch, create *store.Memo) error {
	payload := "{}"
	if create.Payload != nil {
		payloadBytes, err := protojson.Marshal(create.Payload)
		if err != nil {
			return errors.Wrap(err, "failed to marshal memo payload")
		}
		payload = string(payloadBytes)
	}
	columns := []string{"uid", "creator_id", "content", "visibility", "payload", "space_id"}
	args := []any{create.UID, create.CreatorID, create.Content, create.Visibility, payload, create.SpaceID}
	if create.CreatedTs != 0 {
		columns = append(columns, "created_ts")
		args = append(args, create.CreatedTs)
	}
	if create.UpdatedTs != 0 {
		columns = append(columns, "updated_ts")
		args = append(args, create.UpdatedTs)
	}
	b.add("INSERT INTO memo ("+strings.Join(columns, ", ")+") VALUES ("+placeholders(len(args))+")", args...)
	return nil
}

// memoLoadCreated fills the generated columns of a memo inserted by a batch.
// A batch cannot return them, so the row is found again through its uid.
func memoLoadCreated(ctx context.Context, q querier, create *store.Memo) error {
	if err := q.QueryRowContext(ctx, "SELECT id, created_ts, updated_ts, row_status FROM memo WHERE uid = ?", create.UID).Scan(
		&create.ID, &create.CreatedTs, &create.UpdatedTs, &create.RowStatus,
	); err != nil {
		return errors.Wrap(err, "failed to load created memo")
	}
	return nil
}

// ListMemos returns the memos matching find.
func (d *DB) ListMemos(ctx context.Context, find *store.FindMemo) ([]*store.Memo, error) {
	where, args, err := memoListConditions(ctx, find)
	if err != nil {
		return nil, err
	}

	fields := []string{
		"memo.id AS id",
		"memo.uid AS uid",
		"memo.creator_id AS creator_id",
		"memo.created_ts AS created_ts",
		"memo.updated_ts AS updated_ts",
		"memo.row_status AS row_status",
		"memo.visibility AS visibility",
		"memo.pinned AS pinned",
		"memo.payload AS payload",
		"memo.space_id AS space_id",
		`(SELECT parent_memo.uid
			FROM memo_relation AS parent_relation
			JOIN memo AS parent_memo ON parent_memo.id = parent_relation.related_memo_id
			WHERE parent_relation.memo_id = memo.id AND parent_relation.type = 'COMMENT'
			ORDER BY parent_memo.id LIMIT 1) AS parent_uid`,
	}
	if !find.ExcludeContent {
		fields = append(fields, "memo.content AS content")
	}
	// The creator and space joins are referenced by filter expressions.
	query := "SELECT " + strings.Join(fields, ", ") + " FROM memo " +
		"LEFT JOIN user AS memo_creator ON memo.creator_id = memo_creator.id " +
		"LEFT JOIN space AS memo_space ON memo.space_id = memo_space.id " +
		"WHERE " + strings.Join(where, " AND ") + " " +
		"ORDER BY " + strings.Join(memoListOrder(find), ", ")
	query = appendLimit(query, find.Limit, find.Offset)

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]*store.Memo, 0)
	for rows.Next() {
		memo, err := memoScanRow(rows, find.ExcludeContent)
		if err != nil {
			return nil, err
		}
		list = append(list, memo)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

// memoListConditions renders the WHERE clauses for find.
func memoListConditions(ctx context.Context, find *store.FindMemo) ([]string, []any, error) {
	where, args := []string{"1 = 1"}, []any{}

	engine, err := filter.DefaultEngine()
	if err != nil {
		return nil, nil, err
	}
	if err := filter.AppendConditions(ctx, engine, find.Filters, filter.DialectD1, &where, &args); err != nil {
		return nil, nil, err
	}
	if v := find.ID; v != nil {
		where, args = append(where, "memo.id = ?"), append(args, *v)
	}
	if len(find.IDList) > 0 {
		where = append(where, "memo.id IN "+intList(find.IDList))
	}
	if v := find.UID; v != nil {
		where, args = append(where, "memo.uid = ?"), append(args, *v)
	}
	if len(find.UIDList) > 0 {
		clause, uidArg, err := jsonList(find.UIDList)
		if err != nil {
			return nil, nil, err
		}
		where, args = append(where, "memo.uid IN "+clause), append(args, uidArg)
	}
	if v := find.CreatorID; v != nil {
		where, args = append(where, "memo.creator_id = ?"), append(args, *v)
	}
	if v := find.RowStatus; v != nil {
		where, args = append(where, "memo.row_status = ?"), append(args, *v)
	}
	if len(find.VisibilityList) > 0 {
		visibilities := make([]string, 0, len(find.VisibilityList))
		for _, visibility := range find.VisibilityList {
			visibilities = append(visibilities, visibility.String())
		}
		clause, visibilityArgs := inClause(visibilities)
		where, args = append(where, "memo.visibility IN "+clause), append(args, visibilityArgs...)
	}
	if v := find.CommentContextMemoID; v != nil {
		where, args = append(where, `EXISTS (
			SELECT 1 FROM memo_relation AS comment_context
			WHERE comment_context.memo_id = memo.id
				AND comment_context.related_memo_id = ?
				AND comment_context.type = 'COMMENT'
		)`), append(args, *v)
	}
	if access := find.Access; access != nil {
		where = append(where, memoAccessPredicate(access, "memo", "access_member", &args))
	}
	if find.ExcludeComments {
		where = append(where, `NOT EXISTS (
			SELECT 1 FROM memo_relation AS comment_relation
			WHERE comment_relation.memo_id = memo.id AND comment_relation.type = 'COMMENT'
		)`)
	}
	return where, args, nil
}

// memoListOrder renders the ORDER BY terms for find, with id as tie-breaker.
func memoListOrder(find *store.FindMemo) []string {
	order := "DESC"
	if find.OrderByTimeAsc {
		order = "ASC"
	}
	orderBy := []string{}
	if find.OrderByPinned {
		orderBy = append(orderBy, "pinned DESC")
	}
	if find.OrderByUpdatedTs {
		orderBy = append(orderBy, "updated_ts "+order)
	} else {
		orderBy = append(orderBy, "created_ts "+order)
	}
	return append(orderBy, "id DESC")
}

// memoScanRow reads one ListMemos row.
func memoScanRow(rows *sql.Rows, excludeContent bool) (*store.Memo, error) {
	memo := &store.Memo{}
	var payloadBytes []byte
	dests := []any{
		&memo.ID,
		&memo.UID,
		&memo.CreatorID,
		&memo.CreatedTs,
		&memo.UpdatedTs,
		&memo.RowStatus,
		&memo.Visibility,
		&memo.Pinned,
		&payloadBytes,
		&memo.SpaceID,
		&memo.ParentUID,
	}
	if !excludeContent {
		dests = append(dests, &memo.Content)
	}
	if err := rows.Scan(dests...); err != nil {
		return nil, err
	}
	payload := &storepb.MemoPayload{}
	if len(payloadBytes) > 0 {
		if err := protojsonUnmarshaler.Unmarshal(payloadBytes, payload); err != nil {
			return nil, errors.Wrap(err, "failed to unmarshal payload")
		}
	}
	memo.Payload = payload
	return memo, nil
}

// UpdateMemo applies the given memo changes, checking the write policy when one is set.
func (d *DB) UpdateMemo(ctx context.Context, update *store.UpdateMemo) error {
	b := newBatch()
	if update.Policy != nil {
		state, err := validateMemoWritePolicy(ctx, d.db, update.ID, update.Policy, update)
		if err != nil {
			return err
		}
		b.guard(activeUserCondition, update.Policy.ActorUserID)
		memoGuardWritePolicy(b, state, update.Policy, update)
	}
	if err := memoAddUpdate(b, update); err != nil {
		return err
	}
	if _, err := b.commit(ctx, d); err != nil {
		return guardError(err, errors.Wrap(store.ErrMemoMutationConflict, "memo changed while updating"))
	}
	return nil
}

// memoGuardPolicyPlacement re-asserts the Space and share state that
// validateMemoWritePolicy accepted: the source Space still exists, the actor
// keeps the memberships the policy needs, and no active share blocks a move
// to the SPACE audience.
func memoGuardPolicyPlacement(b *batch, state *memoState, policy *store.MemoWritePolicy, update *store.UpdateMemo) {
	if state.spaceID != nil {
		b.guard("EXISTS (SELECT 1 FROM space WHERE id = ?)", *state.spaceID)
		if !policy.LifecycleOnly {
			b.guard(activeSpaceMemberCondition, *state.spaceID, policy.ActorUserID)
		}
	}
	if update == nil {
		return
	}
	if update.SpaceID != nil {
		b.guard(activeSpaceMemberCondition, *update.SpaceID, policy.ActorUserID)
	}
	if update.Visibility != nil && *update.Visibility == store.SpaceAudience {
		b.guard(`NOT EXISTS (SELECT 1 FROM memo_share
			WHERE memo_id = ? AND (expires_ts IS NULL OR expires_ts > CAST(strftime('%s', 'now') AS INTEGER)))`, state.id)
	}
}

// memoAddUpdate appends the memo UPDATE for the fields set on update, or
// nothing when there is no field to write.
func memoAddUpdate(b *batch, update *store.UpdateMemo) error {
	set, args := []string{}, []any{}
	if v := update.UID; v != nil {
		set, args = append(set, "uid = ?"), append(args, *v)
	}
	if v := update.CreatedTs; v != nil {
		set, args = append(set, "created_ts = ?"), append(args, *v)
	}
	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "updated_ts = ?"), append(args, *v)
	}
	if v := update.RowStatus; v != nil {
		set, args = append(set, "row_status = ?"), append(args, *v)
	}
	if v := update.Content; v != nil {
		set, args = append(set, "content = ?"), append(args, *v)
	}
	if v := update.Visibility; v != nil {
		set, args = append(set, "visibility = ?"), append(args, *v)
	}
	if v := update.Pinned; v != nil {
		set, args = append(set, "pinned = ?"), append(args, *v)
	}
	if v := update.Payload; v != nil {
		payload, err := protojson.Marshal(v)
		if err != nil {
			return errors.Wrap(err, "failed to marshal memo payload")
		}
		set, args = append(set, "payload = ?"), append(args, string(payload))
	}
	if update.ClearSpace {
		set = append(set, "space_id = NULL")
	} else if v := update.SpaceID; v != nil {
		set, args = append(set, "space_id = ?"), append(args, *v)
	}
	if len(set) == 0 {
		return nil
	}
	args = append(args, update.ID)
	b.add("UPDATE memo SET "+strings.Join(set, ", ")+" WHERE id = ?", args...)
	return nil
}

// DeleteMemo removes a memo and its reactions.
func (d *DB) DeleteMemo(ctx context.Context, delete *store.DeleteMemo) error {
	b := newBatch()
	b.add("DELETE FROM memo WHERE id = ?", delete.ID)
	b.add("DELETE FROM reaction WHERE memo_id = ?", delete.ID)
	if _, err := b.commit(ctx, d); err != nil {
		return errors.Wrap(err, "failed to delete memo")
	}
	return nil
}
