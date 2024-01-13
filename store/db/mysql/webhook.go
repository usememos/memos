package mysql

import (
	"context"
	"strings"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (d *DB) CreateWebhook(ctx context.Context, create *storepb.Webhook) (*storepb.Webhook, error) {
	fields := []string{"`name`", "`url`", "`creator_id`"}
	placeholder := []string{"?", "?", "?"}
	args := []any{create.Name, create.Url, create.CreatorId}

	stmt := "INSERT INTO `webhook` (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(placeholder, ", ") + ")"
	result, err := d.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	create.Id = int32(id)
	return d.GetWebhook(ctx, &store.FindWebhook{ID: &create.Id})
}

func (d *DB) ListWebhooks(ctx context.Context, find *store.FindWebhook) ([]*storepb.Webhook, error) {
	where, args := []string{"1 = 1"}, []any{}
	if find.ID != nil {
		where, args = append(where, "`id` = ?"), append(args, *find.ID)
	}
	if find.CreatorID != nil {
		where, args = append(where, "`creator_id` = ?"), append(args, *find.CreatorID)
	}

	rows, err := d.db.QueryContext(ctx, "SELECT `id`, UNIX_TIMESTAMP(`created_ts`), UNIX_TIMESTAMP(`updated_ts`), `row_status`, `creator_id`, `name`, `url` FROM `webhook` WHERE "+strings.Join(where, " AND ")+" ORDER BY `id` DESC",
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []*storepb.Webhook{}
	for rows.Next() {
		webhook := &storepb.Webhook{}
		var rowStatus string
		if err := rows.Scan(
			&webhook.Id,
			&webhook.CreatedTs,
			&webhook.UpdatedTs,
			&rowStatus,
			&webhook.CreatorId,
			&webhook.Name,
			&webhook.Url,
		); err != nil {
			return nil, err
		}
		webhook.RowStatus = storepb.RowStatus(storepb.RowStatus_value[rowStatus])
		list = append(list, webhook)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (d *DB) GetWebhook(ctx context.Context, find *store.FindWebhook) (*storepb.Webhook, error) {
	list, err := d.ListWebhooks(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}
	return list[0], nil
}

func (d *DB) UpdateWebhook(ctx context.Context, update *store.UpdateWebhook) (*storepb.Webhook, error) {
	set, args := []string{}, []any{}
	if update.RowStatus != nil {
		set, args = append(set, "`row_status` = ?"), append(args, update.RowStatus.String())
	}
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
