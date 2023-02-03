package store

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
)

type webhookRaw struct {
	ID          int
	CreatorID   int
	CreatedTs   int64
	Name        string
	Description string
	Enabled     bool
	Type        api.WebhookTriggerType
	Headers     string
	Body        string
}

func (raw *webhookRaw) toWebhook() *api.Webhook {
	return &api.Webhook{
		ID:          raw.ID,
		CreatorID:   raw.CreatorID,
		CreatedTs:   raw.CreatedTs,
		Name:        raw.Name,
		Description: raw.Description,
		Enabled:     raw.Enabled,
		Type:        raw.Type,
		Headers:     raw.Headers,
		Body:        raw.Body,
	}
}

func (s *Store) CreateWebhook(ctx context.Context, create *api.WebhookCreate) (*api.Webhook, error) {

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	webhookRaw, err := createWebhook(ctx, tx, create)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, FormatError(err)
	}

	webhook := webhookRaw.toWebhook()
	return webhook, nil
}

func (s *Store) PatchWebhook(ctx context.Context, patch *api.WebhookPatch) (*api.Webhook, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	webhookRaw, err := patchWebhookRaw(ctx, tx, patch)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, FormatError(err)
	}

	if err := s.cache.UpsertCache(api.WebhookCache, webhookRaw.ID, webhookRaw); err != nil {
		return nil, err
	}

	webhook := webhookRaw.toWebhook()
	return webhook, nil
}

func (s *Store) FindWebhookList(ctx context.Context, find *api.WebhookFind) ([]*api.Webhook, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	webhookRawList, err := findWebhookRawList(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	list := []*api.Webhook{}
	for _, raw := range webhookRawList {
		webhook := raw.toWebhook()
		list = append(list, webhook)
	}

	return list, nil
}

func (s *Store) DeleteWebhook(ctx context.Context, delete *api.WebhookDelete) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return FormatError(err)
	}
	defer tx.Rollback()

	if err := deleteWebhook(ctx, tx, delete); err != nil {
		return FormatError(err)
	}

	if err := tx.Commit(); err != nil {
		return FormatError(err)
	}

	s.cache.DeleteCache(api.WebhookCache, delete.ID)

	return nil
}

func createWebhook(ctx context.Context, tx *sql.Tx, create *api.WebhookCreate) (*webhookRaw, error) {
	query := `
		INSERT INTO webhook (
        	creator_id,
            name,
            description,
            enabled,
            type,
            headers,
            body) 
		VALUES (?,?,?,?,?,?,?) 
		RETURNING id,creator_id,created_ts,name,description,enabled,type,headers,body
	`
	var webhookRaw webhookRaw
	if err := tx.QueryRowContext(ctx, query, create.CreatorID, create.Name, create.Description, create.Enabled, create.Type, create.Headers, create.Body).Scan(
		&webhookRaw.ID,
		&webhookRaw.CreatorID,
		&webhookRaw.CreatedTs,
		&webhookRaw.Name,
		&webhookRaw.Description,
		&webhookRaw.Enabled,
		&webhookRaw.Type,
		&webhookRaw.Headers,
		&webhookRaw.Body,
	); err != nil {
		return nil, FormatError(err)
	}

	return &webhookRaw, nil
}

func patchWebhookRaw(ctx context.Context, tx *sql.Tx, patch *api.WebhookPatch) (*webhookRaw, error) {
	set, args := []string{}, []interface{}{}

	if v := patch.Name; v != nil {
		set, args = append(set, "name = ?"), append(args, *v)
	}
	if v := patch.Description; v != nil {
		set, args = append(set, "description = ?"), append(args, *v)
	}
	if v := patch.Enabled; v != nil {
		set, args = append(set, "enabled = ?"), append(args, *v)
	}
	if v := patch.Type; v != nil {
		set, args = append(set, "type = ?"), append(args, *v)
	}
	if v := patch.Headers; v != nil {
		set, args = append(set, "headers = ?"), append(args, *v)
	}
	if v := patch.Body; v != nil {
		set, args = append(set, "body = ?"), append(args, *v)
	}

	args = append(args, patch.ID)

	query := `
		UPDATE webhook
		SET ` + strings.Join(set, ", ") + `
		WHERE id = ?
		RETURNING id,creator_id,created_ts,name,description,enabled,type,headers,body
	`

	var webhookRaw webhookRaw
	if err := tx.QueryRowContext(ctx, query, args...).Scan(
		&webhookRaw.ID,
		&webhookRaw.CreatorID,
		&webhookRaw.CreatedTs,
		&webhookRaw.Name,
		&webhookRaw.Description,
		&webhookRaw.Enabled,
		&webhookRaw.Type,
		&webhookRaw.Headers,
		&webhookRaw.Body,
	); err != nil {
		return nil, FormatError(err)
	}

	return &webhookRaw, nil
}

func findWebhookRawList(ctx context.Context, tx *sql.Tx, find *api.WebhookFind) ([]*webhookRaw, error) {
	where, args := []string{"1 = 1"}, []interface{}{}

	if v := find.ID; v != nil {
		where, args = append(where, "id = ?"), append(args, *v)
	}
	if v := find.CreatorID; v != nil {
		where, args = append(where, "creator_id = ?"), append(args, *v)
	}
	if v := find.Name; v != nil {
		where, args = append(where, "name = ?"), append(args, *v)
	}
	if v := find.Enabled; v != nil {
		where, args = append(where, "enabled = ?"), append(args, *v)
	}
	query := `
		SELECT
			id,
			creator_id,
		    created_ts,
            name,
            description,
            enabled,
            type,
            headers,
            body
		FROM webhook
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_ts DESC
	`
	rows, err := tx.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, FormatError(err)
	}
	defer rows.Close()

	webhookRawList := make([]*webhookRaw, 0)
	for rows.Next() {
		var webhookRaw webhookRaw
		if err := rows.Scan(
			&webhookRaw.ID,
			&webhookRaw.CreatorID,
			&webhookRaw.CreatedTs,
			&webhookRaw.Name,
			&webhookRaw.Description,
			&webhookRaw.Enabled,
			&webhookRaw.Type,
			&webhookRaw.Headers,
			&webhookRaw.Body,
		); err != nil {
			return nil, FormatError(err)
		}

		webhookRawList = append(webhookRawList, &webhookRaw)
	}

	if err := rows.Err(); err != nil {
		return nil, FormatError(err)
	}

	return webhookRawList, nil
}

func deleteWebhook(ctx context.Context, tx *sql.Tx, delete *api.WebhookDelete) error {
	where, args := []string{"id = ?"}, []interface{}{delete.ID}

	stmt := `DELETE FROM webhook WHERE ` + strings.Join(where, " AND ")
	result, err := tx.ExecContext(ctx, stmt, args...)
	if err != nil {
		return FormatError(err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return &common.Error{Code: common.NotFound, Err: fmt.Errorf("webhook not found")}
	}

	return nil
}
