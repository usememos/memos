package store

import (
	"context"

	storepb "github.com/usememos/memos/proto/gen/store"
)

type FindReaction struct {
	ID        *int32
	CreatorID *int32
	ContentID *string
}

type DeleteReaction struct {
	ID int32
}

func (s *Store) UpsertReaction(ctx context.Context, upsert *storepb.Reaction) (*storepb.Reaction, error) {
	return s.driver.UpsertReaction(ctx, upsert)
}

func (s *Store) ListReactions(ctx context.Context, find *FindReaction) ([]*storepb.Reaction, error) {
	return s.driver.ListReactions(ctx, find)
}

func (s *Store) DeleteReaction(ctx context.Context, delete *DeleteReaction) error {
	return s.driver.DeleteReaction(ctx, delete)
}
