package store

import (
	"context"

	storepb "github.com/usememos/memos/proto/gen/store"
)

type Reaction struct {
	ID        int32
	CreatedTs int64
	CreatorID int32
	// ContentID is the id of the content that the reaction is for.
	// This can be a memo. e.g. memos/101
	ContentID    string
	ReactionType storepb.ReactionType
}

type FindReaction struct {
	ID        *int32
	CreatorID *int32
	ContentID *string
}

type DeleteReaction struct {
	ID int32
}

func (s *Store) UpsertReaction(ctx context.Context, upsert *Reaction) (*Reaction, error) {
	return s.driver.UpsertReaction(ctx, upsert)
}

func (s *Store) ListReactions(ctx context.Context, find *FindReaction) ([]*Reaction, error) {
	return s.driver.ListReactions(ctx, find)
}

func (s *Store) DeleteReaction(ctx context.Context, delete *DeleteReaction) error {
	return s.driver.DeleteReaction(ctx, delete)
}
