package d1

import (
	"context"
	"database/sql"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

// reactionInsertStatement selects from the memo row so the insert is
// conditional on the memo still existing: a vanished memo yields no row
// instead of a reaction that outlives its memo.
const reactionInsertStatement = `
	INSERT INTO reaction (creator_id, memo_id, reaction_type)
	SELECT ?, memo.id, ?
	FROM memo
	WHERE memo.id = ?
	RETURNING id, created_ts`

// UpsertReaction records a reaction. With a policy, the participation state
// that authorized the write is re-asserted by guards in the same batch as
// the insert, so a memo or membership change between validation and write
// aborts it.
func (d *DB) UpsertReaction(ctx context.Context, upsert *store.Reaction) (*store.Reaction, error) {
	if upsert.Policy == nil {
		if err := d.db.QueryRowContext(ctx, reactionInsertStatement, upsert.CreatorID, upsert.ReactionType, upsert.MemoID).Scan(
			&upsert.ID,
			&upsert.CreatedTs,
		); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, errors.Wrap(store.ErrReactionMemoNotFound, "failed to create reaction")
			}
			return nil, err
		}
		return upsert, nil
	}

	participation, err := reactionLoadParticipation(ctx, d.db, upsert)
	if err != nil {
		return nil, err
	}
	if err := store.ValidateReactionWriteParticipation(upsert, participation); err != nil {
		return nil, err
	}
	memo, err := loadMemoState(ctx, d.db, upsert.MemoID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.ErrReactionMemoNotFound
		}
		return nil, errors.Wrap(err, "failed to read reaction memo")
	}

	b := newBatch()
	b.guard(activeUserCondition, upsert.Policy.ActorUserID)
	condition, args := memo.unchangedCondition()
	b.guard(condition, args...)
	if memo.spaceID != nil {
		membership := activeSpaceMemberCondition
		if !participation.ContextMemberActive {
			membership = "NOT " + membership
		}
		b.guard(membership, *memo.spaceID, upsert.Policy.ActorUserID)
	}
	index := b.add(reactionInsertStatement, upsert.CreatorID, upsert.ReactionType, upsert.MemoID)
	results, err := b.commit(ctx, d)
	if err != nil {
		if isGuardFailure(err) {
			// Report the precondition that no longer holds, falling back to a
			// permission error when the state moved past what was validated.
			if err := reactionValidateWritePolicy(ctx, d.db, upsert); err != nil {
				return nil, err
			}
			return nil, errors.Wrap(store.ErrReactionPermissionDenied, "memo state changed while recording reaction")
		}
		return nil, err
	}
	rows := results[index].Rows
	if len(rows) == 0 || len(rows[0]) < 2 {
		return nil, errors.Wrap(store.ErrReactionMemoNotFound, "failed to create reaction")
	}
	id, idOK := rows[0][0].(int64)
	createdTs, tsOK := rows[0][1].(int64)
	if !idOK || !tsOK {
		return nil, errors.New("d1: unexpected reaction row shape")
	}
	upsert.ID = int32(id)
	upsert.CreatedTs = createdTs
	return upsert, nil
}

// ListReactions returns the reactions matching find.
func (d *DB) ListReactions(ctx context.Context, find *store.FindReaction) ([]*store.Reaction, error) {
	where, args := []string{"1 = 1"}, []any{}

	if find.ID != nil {
		where, args = append(where, "id = ?"), append(args, *find.ID)
	}
	if find.CreatorID != nil {
		where, args = append(where, "creator_id = ?"), append(args, *find.CreatorID)
	}
	if find.MemoID != nil {
		where, args = append(where, "memo_id = ?"), append(args, *find.MemoID)
	}
	if len(find.MemoIDList) > 0 {
		clause, memoArg, err := jsonList(find.MemoIDList)
		if err != nil {
			return nil, err
		}
		where, args = append(where, "memo_id IN "+clause), append(args, memoArg)
	}
	return reactionQuery(ctx, d.db, where, args)
}

// reactionQuery lists the reactions matching where, ordered by id.
func reactionQuery(ctx context.Context, q querier, where []string, args []any) ([]*store.Reaction, error) {
	rows, err := q.QueryContext(ctx, "SELECT id, created_ts, creator_id, memo_id, reaction_type FROM reaction WHERE "+strings.Join(where, " AND ")+" ORDER BY id ASC", args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []*store.Reaction{}
	for rows.Next() {
		reaction := &store.Reaction{}
		if err := rows.Scan(
			&reaction.ID,
			&reaction.CreatedTs,
			&reaction.CreatorID,
			&reaction.MemoID,
			&reaction.ReactionType,
		); err != nil {
			return nil, err
		}
		list = append(list, reaction)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

// GetReaction returns the first reaction matching find, or nil.
func (d *DB) GetReaction(ctx context.Context, find *store.FindReaction) (*store.Reaction, error) {
	list, err := d.ListReactions(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}
	return list[0], nil
}

// DeleteReaction removes reactions, checking ownership when an actor is set.
func (d *DB) DeleteReaction(ctx context.Context, delete *store.DeleteReaction) error {
	if delete.ActorUserID != nil {
		return d.deleteReactionAsCreator(ctx, delete)
	}
	where, args := []string{}, []any{}
	if delete.ID != nil {
		where, args = append(where, "id = ?"), append(args, *delete.ID)
	}
	if delete.MemoID != nil {
		where, args = append(where, "memo_id = ?"), append(args, *delete.MemoID)
	}
	if len(where) == 0 {
		return nil
	}
	_, err := d.execOne(ctx, "DELETE FROM reaction WHERE "+strings.Join(where, " AND "), args...)
	return err
}

// deleteReactionAsCreator removes the reaction only when the actor owns it.
// Ownership is read first for the error mapping and then re-asserted in the
// DELETE itself, which stands in for the transaction a socket driver would use.
func (d *DB) deleteReactionAsCreator(ctx context.Context, delete *store.DeleteReaction) error {
	if delete.Policy != nil {
		if err := reactionValidateDeletePolicy(ctx, d.db, &store.Reaction{
			CreatorID: *delete.ActorUserID,
			MemoID:    *delete.MemoID,
			Policy:    delete.Policy,
		}); err != nil {
			return err
		}
	}

	var creatorID, memoID int32
	if err := d.db.QueryRowContext(ctx, "SELECT creator_id, memo_id FROM reaction WHERE id = ?", *delete.ID).Scan(&creatorID, &memoID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil
		}
		return errors.Wrap(err, "failed to read reaction for deletion")
	}
	if creatorID != *delete.ActorUserID || (delete.MemoID != nil && memoID != *delete.MemoID) {
		return store.ErrReactionPermissionDenied
	}
	if _, err := d.execOne(ctx, "DELETE FROM reaction WHERE id = ? AND creator_id = ?", *delete.ID, *delete.ActorUserID); err != nil {
		return errors.Wrap(err, "failed to delete reaction")
	}
	return nil
}
