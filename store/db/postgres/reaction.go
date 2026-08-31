package postgres

import (
	"context"
	"database/sql"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func (d *DB) UpsertReaction(ctx context.Context, upsert *store.Reaction) (*store.Reaction, error) {
	if upsert.Policy == nil {
		return upsertPostgresReaction(ctx, d.db, upsert)
	}
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, errors.Wrap(err, "failed to begin reaction upsert transaction")
	}
	defer func() { _ = tx.Rollback() }()
	if err := validatePostgresReactionWritePolicy(ctx, tx, upsert); err != nil {
		return nil, err
	}
	reaction, err := upsertPostgresReaction(ctx, tx, upsert)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "failed to commit reaction upsert transaction")
	}
	return reaction, nil
}

type postgresReactionUpsertQuerier interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

func upsertPostgresReaction(ctx context.Context, querier postgresReactionUpsertQuerier, upsert *store.Reaction) (*store.Reaction, error) {
	if err := querier.QueryRowContext(ctx, `
		INSERT INTO reaction (creator_id, memo_id, reaction_type)
		SELECT $1, memo.id, $2
		FROM memo
		WHERE memo.id = $3
		FOR KEY SHARE OF memo
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
		where, args = append(where, "id = "+placeholder(len(args)+1)), append(args, *find.ID)
	}
	if find.CreatorID != nil {
		where, args = append(where, "creator_id = "+placeholder(len(args)+1)), append(args, *find.CreatorID)
	}
	if find.MemoID != nil {
		where, args = append(where, "memo_id = "+placeholder(len(args)+1)), append(args, *find.MemoID)
	}
	if len(find.MemoIDList) > 0 {
		holders := make([]string, 0, len(find.MemoIDList))
		for _, id := range find.MemoIDList {
			holders = append(holders, placeholder(len(args)+1))
			args = append(args, id)
		}
		where = append(where, "memo_id IN ("+strings.Join(holders, ", ")+")")
	}

	rows, err := d.db.QueryContext(ctx, `
		SELECT
			id,
			created_ts,
			creator_id,
			memo_id,
			reaction_type
		FROM reaction
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY id ASC`,
		args...,
	)
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

	reaction := list[0]
	return reaction, nil
}

func (d *DB) DeleteReaction(ctx context.Context, delete *store.DeleteReaction) error {
	if delete.ActorUserID != nil {
		return d.deleteReactionAsCreator(ctx, delete)
	}
	where, args := []string{}, []any{}
	if delete.ID != nil {
		where, args = append(where, "id = "+placeholder(len(args)+1)), append(args, *delete.ID)
	}
	if delete.MemoID != nil {
		where, args = append(where, "memo_id = "+placeholder(len(args)+1)), append(args, *delete.MemoID)
	}
	if len(where) == 0 {
		return nil
	}

	_, err := d.db.ExecContext(ctx, "DELETE FROM reaction WHERE "+strings.Join(where, " AND "), args...)
	return err
}

func (d *DB) deleteReactionAsCreator(ctx context.Context, delete *store.DeleteReaction) error {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return errors.Wrap(err, "failed to begin authorized reaction delete transaction")
	}
	defer func() { _ = tx.Rollback() }()
	if delete.Policy != nil {
		if err := validatePostgresReactionWritePolicy(ctx, tx, &store.Reaction{
			CreatorID: *delete.ActorUserID,
			MemoID:    *delete.MemoID,
			Policy:    delete.Policy,
		}); err != nil {
			return err
		}
	}

	var creatorID, memoID int32
	if err := tx.QueryRowContext(ctx, "SELECT creator_id, memo_id FROM reaction WHERE id = $1", *delete.ID).Scan(&creatorID, &memoID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil
		}
		return errors.Wrap(err, "failed to read reaction for deletion")
	}
	if creatorID != *delete.ActorUserID || (delete.MemoID != nil && memoID != *delete.MemoID) {
		return store.ErrReactionPermissionDenied
	}
	if _, err := tx.ExecContext(ctx, "DELETE FROM reaction WHERE id = $1", *delete.ID); err != nil {
		return errors.Wrap(err, "failed to delete reaction")
	}
	if err := tx.Commit(); err != nil {
		return errors.Wrap(err, "failed to commit authorized reaction delete transaction")
	}
	return nil
}
