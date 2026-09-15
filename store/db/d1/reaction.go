package d1

import (
	"context"
	"database/sql"
	"slices"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func (d *DB) UpsertReaction(ctx context.Context, upsert *store.Reaction) (*store.Reaction, error) {
	if upsert.Policy != nil {
		if err := reactionValidateWritePolicy(ctx, d.db, upsert); err != nil {
			return nil, err
		}
	}
	// Selecting from the memo row makes the insert conditional on the memo
	// still existing, so no transaction is needed to keep a reaction from
	// outliving its memo: a vanished memo yields no row.
	if err := d.db.QueryRowContext(ctx, `
		INSERT INTO reaction (creator_id, memo_id, reaction_type)
		SELECT ?, memo.id, ?
		FROM memo
		WHERE memo.id = ?
		RETURNING id, created_ts
	`, upsert.CreatorID, upsert.ReactionType, upsert.MemoID).Scan(
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
	if len(find.MemoIDList) == 0 {
		return reactionQuery(ctx, d.db, where, args)
	}

	// A memo id list can exceed D1's bind limit, so it is queried in chunks
	// and the union re-sorted to preserve the id order of a single query.
	list := []*store.Reaction{}
	for _, ids := range chunk(find.MemoIDList, inClauseBatchSize) {
		clause, memoArgs := inClause(ids)
		chunkWhere := append(append([]string{}, where...), "memo_id IN "+clause)
		chunkArgs := append(append([]any{}, args...), memoArgs...)
		reactions, err := reactionQuery(ctx, d.db, chunkWhere, chunkArgs)
		if err != nil {
			return nil, err
		}
		list = append(list, reactions...)
	}
	slices.SortFunc(list, func(a, b *store.Reaction) int { return int(a.ID) - int(b.ID) })
	return list, nil
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
