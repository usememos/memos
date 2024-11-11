package mysql

import (
	"context"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func (d *DB) UpsertReaction(ctx context.Context, upsert *store.Reaction) (*store.Reaction, error) {
	fields := []string{"`creator_id`", "`content_id`", "`reaction_type`"}
	placeholder := []string{"?", "?", "?"}
	args := []interface{}{upsert.CreatorID, upsert.ContentID, upsert.ReactionType}
	stmt := "INSERT INTO `reaction` (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(placeholder, ", ") + ")"
	result, err := d.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return nil, err
	}

	rawID, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	id := int32(rawID)
	reaction, err := d.GetReaction(ctx, &store.FindReaction{ID: &id})
	if err != nil {
		return nil, err
	}
	if reaction == nil {
		return nil, errors.Errorf("failed to create reaction")
	}
	return reaction, nil
}

func (d *DB) ListReactions(ctx context.Context, find *store.FindReaction) ([]*store.Reaction, error) {
	where, args := []string{"1 = 1"}, []interface{}{}
	if find.ID != nil {
		where, args = append(where, "`id` = ?"), append(args, *find.ID)
	}
	if find.CreatorID != nil {
		where, args = append(where, "`creator_id` = ?"), append(args, *find.CreatorID)
	}
	if find.ContentID != nil {
		where, args = append(where, "`content_id` = ?"), append(args, *find.ContentID)
	}

	rows, err := d.db.QueryContext(ctx, `
		SELECT
			id,
			UNIX_TIMESTAMP(created_ts) AS created_ts,
			creator_id,
			content_id,
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
			&reaction.ContentID,
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
	_, err := d.db.ExecContext(ctx, "DELETE FROM `reaction` WHERE `id` = ?", delete.ID)
	return err
}
