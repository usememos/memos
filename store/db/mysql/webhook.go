package mysql

import (
	"context"
	"strings"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateWebhook(ctx context.Context, create *store.Webhook) (*store.Webhook, error) {
	fields := []string{"`name`", "`url`", "`creator_id`"}
	placeholder := []string{"?", "?", "?"}
	args := []any{create.Name, create.URL, create.CreatorID}

	stmt := "INSERT INTO `webhook` (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(placeholder, ", ") + ")"
	result, err := d.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	create.ID = int32(id)
	return d.GetWebhook(ctx, &store.FindWebhook{ID: &create.ID})
}

func (d *DB) ListWebhooks(ctx context.Context, find *store.FindWebhook) ([]*store.Webhook, error) {
	where, args := []string{"1 = 1"}, []any{}
	if find.ID != nil {
		where, args = append(where, "`id` = ?"), append(args, *find.ID)
	}
	if find.CreatorID != nil {
		where, args = append(where, "`creator_id` = ?"), append(args, *find.CreatorID)
	}

	rows, err := d.db.QueryContext(ctx, "SELECT `id`, UNIX_TIMESTAMP(`created_ts`), UNIX_TIMESTAMP(`updated_ts`),  `creator_id`, `name`, `url` FROM `webhook` WHERE "+strings.Join(where, " AND ")+" ORDER BY `id` DESC",
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []*store.Webhook{}
	for rows.Next() {
		webhook := &store.Webhook{}
		if err := rows.Scan(
			&webhook.ID,
			&webhook.CreatedTs,
			&webhook.UpdatedTs,
			&webhook.CreatorID,
			&webhook.Name,
			&webhook.URL,
		); err != nil {
			return nil, err
		}
		list = append(list, webhook)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (d *DB) GetWebhook(ctx context.Context, find *store.FindWebhook) (*store.Webhook, error) {
	list, err := d.ListWebhooks(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}
	return list[0], nil
}

func (d *DB) UpdateWebhook(ctx context.Context, update *store.UpdateWebhook) (*store.Webhook, error) {
	set, args := []string{}, []any{}
	if update.Name != nil {
		set, args = append(set, "`name` = ?"), append(args, *update.Name)
	}
	if update.URL != nil {
		set, args = append(set, "`url` = ?"), append(args, *update.URL)
	}
	args = append(args, update.ID)

	stmt := "UPDATE `webhook` SET " + strings.Join(set, ", ") + " WHERE `id` = ?"
	_, err := d.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return nil, err
	}

	webhook, err := d.GetWebhook(ctx, &store.FindWebhook{ID: &update.ID})
	if err != nil {
		return nil, err
	}

	return webhook, nil
}

func (d *DB) DeleteWebhook(ctx context.Context, delete *store.DeleteWebhook) error {
	_, err := d.db.ExecContext(ctx, "DELETE FROM `webhook` WHERE `id` = ?", delete.ID)
	return err
}
