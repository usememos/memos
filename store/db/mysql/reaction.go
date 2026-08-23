package mysql

import (
	"context"
	"database/sql"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func (d *DB) UpsertReaction(ctx context.Context, upsert *store.Reaction) (*store.Reaction, error) {
	// MySQL has no INSERT ... RETURNING, so keep the insert and readback in one
	// transaction to match the other drivers' atomic operation.
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, errors.Wrap(err, "failed to start reaction upsert transaction")
	}
	defer func() {
		_ = tx.Rollback()
	}()
	if upsert.Policy != nil {
		if err := validateMySQLReactionWritePolicy(ctx, tx, upsert); err != nil {
			return nil, err
		}
	}

	result, err := tx.ExecContext(ctx, `
		INSERT INTO reaction (creator_id, memo_id, reaction_type)
		SELECT ?, memo.id, ?
		FROM memo
		WHERE memo.id = ?
		FOR SHARE
	`, upsert.CreatorID, upsert.ReactionType, upsert.MemoID)
	if err != nil {
		return nil, err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return nil, err
	}
	if rowsAffected == 0 {
		return nil, errors.Wrap(store.ErrReactionMemoNotFound, "failed to create reaction")
	}

	rawID, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	upsert.ID = int32(rawID)
	if err := tx.QueryRowContext(ctx, "SELECT UNIX_TIMESTAMP(created_ts) FROM reaction WHERE id = ?", upsert.ID).Scan(&upsert.CreatedTs); err != nil {
		return nil, errors.Wrap(err, "failed to read created reaction")
	}
	if err := tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "failed to commit reaction upsert transaction")
	}
	return upsert, nil
}

func (d *DB) ListReactions(ctx context.Context, find *store.FindReaction) ([]*store.Reaction, error) {
	where, args := []string{"1 = 1"}, []any{}

	if find.ID != nil {
		where, args = append(where, "`id` = ?"), append(args, *find.ID)
	}
	if find.CreatorID != nil {
		where, args = append(where, "`creator_id` = ?"), append(args, *find.CreatorID)
	}
	if find.MemoID != nil {
		where, args = append(where, "`memo_id` = ?"), append(args, *find.MemoID)
	}
	if len(find.MemoIDList) > 0 {
		placeholders := make([]string, 0, len(find.MemoIDList))
		for _, id := range find.MemoIDList {
			placeholders = append(placeholders, "?")
			args = append(args, id)
		}
		where = append(where, "`memo_id` IN ("+strings.Join(placeholders, ",")+")")
	}

	rows, err := d.db.QueryContext(ctx, `
		SELECT
			id,
			UNIX_TIMESTAMP(created_ts) AS created_ts,
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

func (d *DB) deleteReactionAsCreator(ctx context.Context, delete *store.DeleteReaction) error {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return errors.Wrap(err, "failed to begin authorized reaction delete transaction")
	}
	defer func() { _ = tx.Rollback() }()
	if delete.Policy != nil {
		if err := validateMySQLReactionWritePolicy(ctx, tx, &store.Reaction{
			CreatorID: *delete.ActorUserID,
			MemoID:    *delete.MemoID,
			Policy:    delete.Policy,
		}); err != nil {
			return err
		}
	}

	var creatorID, memoID int32
	if err := tx.QueryRowContext(ctx, "SELECT creator_id, memo_id FROM reaction WHERE id = ?", *delete.ID).Scan(&creatorID, &memoID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil
		}
		return errors.Wrap(err, "failed to read reaction for deletion")
	}
	if creatorID != *delete.ActorUserID || (delete.MemoID != nil && memoID != *delete.MemoID) {
		return store.ErrReactionPermissionDenied
	}
	if _, err := tx.ExecContext(ctx, "DELETE FROM reaction WHERE id = ?", *delete.ID); err != nil {
		return errors.Wrap(err, "failed to delete reaction")
	}
	if err := tx.Commit(); err != nil {
		return errors.Wrap(err, "failed to commit authorized reaction delete transaction")
	}
	return nil
}
