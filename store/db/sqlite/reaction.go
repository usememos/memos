package sqlite

import (
	"context"
	"database/sql"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func (d *DB) UpsertReaction(ctx context.Context, upsert *store.Reaction) (*store.Reaction, error) {
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

	reaction := upsert
	return reaction, nil
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
	if len(find.MemoIDList) > 0 {
		placeholders := make([]string, 0, len(find.MemoIDList))
		for _, id := range find.MemoIDList {
			placeholders = append(placeholders, "?")
			args = append(args, id)
		}
		where = append(where, "memo_id IN ("+strings.Join(placeholders, ",")+")")
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

	return list[0], nil
}

func (d *DB) DeleteReaction(ctx context.Context, delete *store.DeleteReaction) error {
	where, args := []string{}, []any{}
	if delete.ID != nil {
		where, args = append(where, "`id` = ?"), append(args, *delete.ID)
	}
	if delete.MemoID != nil {
		where, args = append(where, "`memo_id` = ?"), append(args, *delete.MemoID)
	}
	if len(where) == 0 {
		return nil
	}

	_, err := d.db.ExecContext(ctx, "DELETE FROM `reaction` WHERE "+strings.Join(where, " AND "), args...)
	return err
}
