package store

import (
	"context"
	"errors"
)

// ErrReactionMemoNotFound indicates that a reaction's memo no longer exists.
var ErrReactionMemoNotFound = errors.New("reaction memo not found")

// Reaction is a reaction attached to a memo.
type Reaction struct {
	ID        int32
	CreatedTs int64
	CreatorID int32
	// MemoID is the ID of the memo that the reaction is for.
	MemoID       int32
	ReactionType string
}

type FindReaction struct {
	ID         *int32
	CreatorID  *int32
	MemoID     *int32
	MemoIDList []int32
}

type DeleteReaction struct {
	ID     *int32
	MemoID *int32
}

func (s *Store) UpsertReaction(ctx context.Context, upsert *Reaction) (*Reaction, error) {
	return s.driver.UpsertReaction(ctx, upsert)
}

func (s *Store) ListReactions(ctx context.Context, find *FindReaction) ([]*Reaction, error) {
	return s.driver.ListReactions(ctx, find)
}

func (s *Store) GetReaction(ctx context.Context, find *FindReaction) (*Reaction, error) {
	return s.driver.GetReaction(ctx, find)
}

func (s *Store) DeleteReaction(ctx context.Context, delete *DeleteReaction) error {
	return s.driver.DeleteReaction(ctx, delete)
}
