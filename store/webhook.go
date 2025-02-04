package store

import (
	"context"
)

type Webhook struct {
	ID        int32
	CreatedTs int64
	UpdatedTs int64
	CreatorID int32
	Name      string
	URL       string
}

type FindWebhook struct {
	ID        *int32
	CreatorID *int32
}

type UpdateWebhook struct {
	ID   int32
	Name *string
	URL  *string
}

type DeleteWebhook struct {
	ID int32
}

func (s *Store) CreateWebhook(ctx context.Context, create *Webhook) (*Webhook, error) {
	return s.driver.CreateWebhook(ctx, create)
}

func (s *Store) ListWebhooks(ctx context.Context, find *FindWebhook) ([]*Webhook, error) {
	return s.driver.ListWebhooks(ctx, find)
}

func (s *Store) GetWebhook(ctx context.Context, find *FindWebhook) (*Webhook, error) {
	list, err := s.ListWebhooks(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}
	return list[0], nil
}

func (s *Store) UpdateWebhook(ctx context.Context, update *UpdateWebhook) (*Webhook, error) {
	return s.driver.UpdateWebhook(ctx, update)
}

func (s *Store) DeleteWebhook(ctx context.Context, delete *DeleteWebhook) error {
	return s.driver.DeleteWebhook(ctx, delete)
}
