package store

import (
	"context"
	stderrors "errors"

	"github.com/pkg/errors"
)

// ErrReactionMemoNotFound indicates that a reaction's memo no longer exists.
var ErrReactionMemoNotFound = stderrors.New("reaction memo not found")

// ErrReactionPermissionDenied indicates that an actor cannot mutate the
// reaction.
var ErrReactionPermissionDenied = stderrors.New("reaction mutation permission denied")

// Reaction is a reaction attached to a memo.
type Reaction struct {
	ID        int32
	CreatedTs int64
	CreatorID int32
	// MemoID is the ID of the memo that the reaction is for.
	MemoID       int32
	ReactionType string
	// Policy is required for transport-facing participation mutations. A nil
	// policy preserves trusted internal and migration callers.
	Policy *ReactionWritePolicy
}

type FindReaction struct {
	ID         *int32
	CreatorID  *int32
	MemoID     *int32
	MemoIDList []int32
}

type DeleteReaction struct {
	ID          *int32
	MemoID      *int32
	ActorUserID *int32
	// Policy is required for transport-facing participation mutations. It is
	// revalidated in the same transaction before the reaction row is deleted.
	Policy *ReactionWritePolicy
}

func (s *Store) UpsertReaction(ctx context.Context, upsert *Reaction) (*Reaction, error) {
	if upsert == nil {
		return nil, errors.New("reaction is required")
	}
	if err := validateReactionWritePolicy(upsert); err != nil {
		return nil, err
	}
	if upsert.Policy == nil {
		return s.driver.UpsertReaction(ctx, upsert)
	}

	return s.driver.UpsertReaction(ctx, upsert)
}

func (s *Store) ListReactions(ctx context.Context, find *FindReaction) ([]*Reaction, error) {
	return s.driver.ListReactions(ctx, find)
}

func (s *Store) GetReaction(ctx context.Context, find *FindReaction) (*Reaction, error) {
	return s.driver.GetReaction(ctx, find)
}

func (s *Store) DeleteReaction(ctx context.Context, delete *DeleteReaction) error {
	if delete == nil {
		return errors.New("reaction deletion is required")
	}
	if delete.ActorUserID == nil {
		return s.driver.DeleteReaction(ctx, delete)
	}
	if *delete.ActorUserID <= 0 || delete.ID == nil || *delete.ID <= 0 {
		return errors.New("authorized reaction deletion requires reaction and actor")
	}
	if delete.Policy != nil {
		if delete.MemoID == nil || *delete.MemoID <= 0 {
			return errors.New("authorized reaction deletion policy requires memo")
		}
		if err := validateReactionWritePolicy(&Reaction{
			CreatorID: *delete.ActorUserID,
			MemoID:    *delete.MemoID,
			Policy:    delete.Policy,
		}); err != nil {
			return err
		}
	}

	return s.driver.DeleteReaction(ctx, delete)
}
