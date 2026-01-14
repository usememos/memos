package sqlite

import (
	"context"
	"fmt"
	"strings"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateAIMessage(ctx context.Context, create *store.AIMessage) (*store.AIMessage, error) {
	fields := []string{"`uid`", "`conversation_id`", "`role`", "`content`", "`token_count`"}
	placeholder := []string{"?", "?", "?", "?", "?"}
	args := []any{create.UID, create.ConversationID, create.Role, create.Content, create.TokenCount}

	stmt := "INSERT INTO `ai_message` (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(placeholder, ", ") + ") RETURNING `id`, `created_ts`"
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(
		&create.ID,
		&create.CreatedTs,
	); err != nil {
		return nil, err
	}
	return create, nil
}

func (d *DB) ListAIMessages(ctx context.Context, find *store.FindAIMessage) ([]*store.AIMessage, error) {
	where, args := []string{"1 = 1"}, []any{}

	if find.ID != nil {
		where, args = append(where, "`id` = ?"), append(args, *find.ID)
	}
	if find.UID != nil {
		where, args = append(where, "`uid` = ?"), append(args, *find.UID)
	}
	if find.ConversationID != nil {
		where, args = append(where, "`conversation_id` = ?"), append(args, *find.ConversationID)
	}

	orderBy := "ASC"
	if find.OrderByCreated != nil && *find.OrderByCreated == "DESC" {
		orderBy = "DESC"
	}

	query := "SELECT `id`, `uid`, `conversation_id`, `role`, `content`, `created_ts`, `token_count` FROM `ai_message` WHERE " + strings.Join(where, " AND ") + " ORDER BY `created_ts` " + orderBy

	if find.Limit != nil {
		query += fmt.Sprintf(" LIMIT %d", *find.Limit)
		if find.Offset != nil {
			query += fmt.Sprintf(" OFFSET %d", *find.Offset)
		}
	}

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []*store.AIMessage{}
	for rows.Next() {
		var message store.AIMessage
		var role string
		if err := rows.Scan(
			&message.ID,
			&message.UID,
			&message.ConversationID,
			&role,
			&message.Content,
			&message.CreatedTs,
			&message.TokenCount,
		); err != nil {
			return nil, err
		}
		message.Role = store.AIMessageRole(role)
		list = append(list, &message)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

func (d *DB) DeleteAIMessage(ctx context.Context, delete *store.DeleteAIMessage) error {
	where, args := []string{}, []any{}

	if delete.ID != nil {
		where, args = append(where, "`id` = ?"), append(args, *delete.ID)
	}
	if delete.ConversationID != nil {
		where, args = append(where, "`conversation_id` = ?"), append(args, *delete.ConversationID)
	}

	if len(where) == 0 {
		return nil
	}

	stmt := "DELETE FROM `ai_message` WHERE " + strings.Join(where, " AND ")
	_, err := d.db.ExecContext(ctx, stmt, args...)
	return err
}
