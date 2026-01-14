package mysql

import (
	"context"
	"fmt"
	"strings"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateAIConversation(ctx context.Context, create *store.AIConversation) (*store.AIConversation, error) {
	fields := []string{"`uid`", "`user_id`", "`title`", "`model`", "`provider`"}
	placeholder := []string{"?", "?", "?", "?", "?"}
	args := []any{create.UID, create.UserID, create.Title, create.Model, create.Provider}

	stmt := "INSERT INTO `ai_conversation` (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(placeholder, ", ") + ")"
	result, err := d.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	create.ID = int32(id)

	// Fetch the created record to get timestamps
	row := d.db.QueryRowContext(ctx, "SELECT `created_ts`, `updated_ts`, `row_status` FROM `ai_conversation` WHERE `id` = ?", create.ID)
	var rowStatus string
	if err := row.Scan(&create.CreatedTs, &create.UpdatedTs, &rowStatus); err != nil {
		return nil, err
	}
	create.RowStatus = store.RowStatus(rowStatus)
	return create, nil
}

func (d *DB) ListAIConversations(ctx context.Context, find *store.FindAIConversation) ([]*store.AIConversation, error) {
	where, args := []string{"1 = 1"}, []any{}

	if find.ID != nil {
		where, args = append(where, "`id` = ?"), append(args, *find.ID)
	}
	if find.UID != nil {
		where, args = append(where, "`uid` = ?"), append(args, *find.UID)
	}
	if find.UserID != nil {
		where, args = append(where, "`user_id` = ?"), append(args, *find.UserID)
	}
	if find.RowStatus != nil {
		where, args = append(where, "`row_status` = ?"), append(args, *find.RowStatus)
	}

	query := "SELECT `id`, `uid`, `user_id`, `title`, UNIX_TIMESTAMP(`created_ts`), UNIX_TIMESTAMP(`updated_ts`), `row_status`, `model`, `provider` FROM `ai_conversation` WHERE " + strings.Join(where, " AND ") + " ORDER BY `updated_ts` DESC"

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

	list := []*store.AIConversation{}
	for rows.Next() {
		var conversation store.AIConversation
		var rowStatus string
		if err := rows.Scan(
			&conversation.ID,
			&conversation.UID,
			&conversation.UserID,
			&conversation.Title,
			&conversation.CreatedTs,
			&conversation.UpdatedTs,
			&rowStatus,
			&conversation.Model,
			&conversation.Provider,
		); err != nil {
			return nil, err
		}
		conversation.RowStatus = store.RowStatus(rowStatus)
		list = append(list, &conversation)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

func (d *DB) UpdateAIConversation(ctx context.Context, update *store.UpdateAIConversation) error {
	set, args := []string{}, []any{}

	if update.Title != nil {
		set, args = append(set, "`title` = ?"), append(args, *update.Title)
	}
	if update.Model != nil {
		set, args = append(set, "`model` = ?"), append(args, *update.Model)
	}
	if update.Provider != nil {
		set, args = append(set, "`provider` = ?"), append(args, *update.Provider)
	}
	if update.RowStatus != nil {
		set, args = append(set, "`row_status` = ?"), append(args, *update.RowStatus)
	}
	if update.UpdatedTs != nil {
		set, args = append(set, "`updated_ts` = FROM_UNIXTIME(?)"), append(args, *update.UpdatedTs)
	}

	if len(set) == 0 {
		return nil
	}

	args = append(args, update.ID)
	stmt := "UPDATE `ai_conversation` SET " + strings.Join(set, ", ") + " WHERE `id` = ?"
	_, err := d.db.ExecContext(ctx, stmt, args...)
	return err
}

func (d *DB) DeleteAIConversation(ctx context.Context, delete *store.DeleteAIConversation) error {
	stmt := "DELETE FROM `ai_conversation` WHERE `id` = ?"
	_, err := d.db.ExecContext(ctx, stmt, delete.ID)
	return err
}
