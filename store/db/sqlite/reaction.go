package sqlite

import (
	"context"
	"fmt"
	"strings"

	"github.com/usememos/memos/plugin/filter"
	"github.com/usememos/memos/store"
)

func (d *DB) UpsertReaction(ctx context.Context, upsert *store.Reaction) (*store.Reaction, error) {
	fields := []string{"`creator_id`", "`content_id`", "`reaction_type`"}
	placeholder := []string{"?", "?", "?"}
	args := []interface{}{upsert.CreatorID, upsert.ContentID, upsert.ReactionType}
	stmt := "INSERT INTO `reaction` (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(placeholder, ", ") + ") RETURNING `id`, `created_ts`"
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(
		&upsert.ID,
		&upsert.CreatedTs,
	); err != nil {
		return nil, err
	}

	reaction := upsert
	return reaction, nil
}

func (d *DB) ListReactions(ctx context.Context, find *store.FindReaction) ([]*store.Reaction, error) {
	where, args := []string{"1 = 1"}, []interface{}{}

	for _, filterStr := range find.Filters {
		// Parse filter string and return the parsed expression.
		// The filter string should be a CEL expression.
		parsedExpr, err := filter.Parse(filterStr, filter.ReactionFilterCELAttributes...)
		if err != nil {
			return nil, err
		}
		convertCtx := filter.NewConvertContext()
		// ConvertExprToSQL converts the parsed expression to a SQL condition string.
		converter := filter.NewCommonSQLConverter(&filter.SQLiteDialect{})
		if err := converter.ConvertExprToSQL(convertCtx, parsedExpr.GetExpr()); err != nil {
			return nil, err
		}
		condition := convertCtx.Buffer.String()
		if condition != "" {
			where = append(where, fmt.Sprintf("(%s)", condition))
			args = append(args, convertCtx.Args...)
		}
	}

	if find.ID != nil {
		where, args = append(where, "id = ?"), append(args, *find.ID)
	}
	if find.CreatorID != nil {
		where, args = append(where, "creator_id = ?"), append(args, *find.CreatorID)
	}
	if find.ContentID != nil {
		where, args = append(where, "content_id = ?"), append(args, *find.ContentID)
	}

	rows, err := d.db.QueryContext(ctx, `
		SELECT
			id,
			created_ts,
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

func (d *DB) DeleteReaction(ctx context.Context, delete *store.DeleteReaction) error {
	_, err := d.db.ExecContext(ctx, "DELETE FROM `reaction` WHERE `id` = ?", delete.ID)
	return err
}
