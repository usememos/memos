package postgres

import (
	"context"

	"github.com/Masterminds/squirrel"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (d *DB) CreateWebhook(ctx context.Context, create *storepb.Webhook) (*storepb.Webhook, error) {
	qb := squirrel.Insert("webhook").Columns("name", "url", "creator_id")
	values := []any{create.Name, create.Url, create.CreatorId}

	if create.Id != 0 {
		qb = qb.Columns("id")
		values = append(values, create.Id)
	}

	qb = qb.Values(values...).Suffix("RETURNING id")
	query, args, err := qb.PlaceholderFormat(squirrel.Dollar).ToSql()
	if err != nil {
		return nil, err
	}

	err = d.db.QueryRowContext(ctx, query, args...).Scan(&create.Id)
	if err != nil {
		return nil, err
	}

	create, err = d.GetWebhook(ctx, &store.FindWebhook{ID: &create.Id})
	if err != nil {
		return nil, err
	}

	return create, nil
}

func (d *DB) ListWebhooks(ctx context.Context, find *store.FindWebhook) ([]*storepb.Webhook, error) {
	qb := squirrel.Select("id", "created_ts", "updated_ts", "row_status", "creator_id", "name", "url").From("webhook").OrderBy("id DESC")

	if find.ID != nil {
		qb = qb.Where(squirrel.Eq{"id": *find.ID})
	}
	if find.CreatorID != nil {
		qb = qb.Where(squirrel.Eq{"creator_id": *find.CreatorID})
	}

	query, args, err := qb.PlaceholderFormat(squirrel.Dollar).ToSql()
	if err != nil {
		return nil, err
	}

	rows, err := d.db.QueryContext(ctx, query, args...)
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
	qb := squirrel.Update("webhook")

	if update.RowStatus != nil {
		qb = qb.Set("row_status", update.RowStatus.String())
	}
	if update.Name != nil {
		qb = qb.Set("name", *update.Name)
	}
	if update.URL != nil {
		qb = qb.Set("url", *update.URL)
	}

	qb = qb.Where(squirrel.Eq{"id": update.ID})

	query, args, err := qb.PlaceholderFormat(squirrel.Dollar).ToSql()
	if err != nil {
		return nil, err
	}

	_, err = d.db.ExecContext(ctx, query, args...)
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
	qb := squirrel.Delete("webhook").Where(squirrel.Eq{"id": delete.ID})

	query, args, err := qb.PlaceholderFormat(squirrel.Dollar).ToSql()
	if err != nil {
		return err
	}

	_, err = d.db.ExecContext(ctx, query, args...)
	return err
}
