package store

import (
	"context"
)

type Tag struct {
	Name      string
	CreatorID int32
}

type FindTag struct {
	CreatorID int32
}

type DeleteTag struct {
	Name      string
	CreatorID int32
}

func (s *Store) UpsertTag(ctx context.Context, upsert *Tag) (*Tag, error) {
	return s.driver.UpsertTag(ctx, upsert)
}

func (s *Store) ListTags(ctx context.Context, find *FindTag) ([]*Tag, error) {
	return s.driver.ListTags(ctx, find)
}

func (s *Store) DeleteTag(ctx context.Context, delete *DeleteTag) error {
	return s.driver.DeleteTag(ctx, delete)
}
