package postgres

import (
	"context"
	"strings"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateWebhook(ctx context.Context, create *store.Webhook) (*store.Webhook, error) {
	fields := []string{"name", "url", "creator_id"}
	args := []any{create.Name, create.URL, create.CreatorID}
	stmt := "INSERT INTO webhook (" + strings.Join(fields, ", ") + ") VALUES (" + placeholders(len(args)) + ") RETURNING id, created_ts, updated_ts"
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(
		&create.ID,
		&create.CreatedTs,
		&create.UpdatedTs,
	); err != nil {
		return nil, err
	}
	webhook := create
	return webhook, nil
}

func (d *DB) ListWebhooks(ctx context.Context, find *store.FindWebhook) ([]*store.Webhook, error) {
	where, args := []string{"1 = 1"}, []any{}
	if find.ID != nil {
		where, args = append(where, "id = "+placeholder(len(args)+1)), append(args, *find.ID)
	}
	if find.CreatorID != nil {
		where, args = append(where, "creator_id = "+placeholder(len(args)+1)), append(args, *find.CreatorID)
	}

	rows, err := d.db.QueryContext(ctx, `
		SELECT
			id,
			created_ts,
			updated_ts,
			creator_id,
			name,
			url
		FROM webhook
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY id DESC`,
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

func (d *DB) UpdateWebhook(ctx context.Context, update *store.UpdateWebhook) (*store.Webhook, error) {
	set, args := []string{}, []any{}
	if update.Name != nil {
		set, args = append(set, "name = "+placeholder(len(args)+1)), append(args, *update.Name)
	}
	if update.URL != nil {
		set, args = append(set, "url = "+placeholder(len(args)+1)), append(args, *update.URL)
	}

	stmt := "UPDATE webhook SET " + strings.Join(set, ", ") + " WHERE id = " + placeholder(len(args)+1) + " RETURNING id, created_ts, updated_ts, creator_id, name, url"
	args = append(args, update.ID)
	webhook := &store.Webhook{}
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(
		&webhook.ID,
		&webhook.CreatedTs,
		&webhook.UpdatedTs,
		&webhook.CreatorID,
		&webhook.Name,
		&webhook.URL,
	); err != nil {
		return nil, err
	}
	return webhook, nil
}

func (d *DB) DeleteWebhook(ctx context.Context, delete *store.DeleteWebhook) error {
	_, err := d.db.ExecContext(ctx, "DELETE FROM webhook WHERE id = $1", delete.ID)
	return err
}
