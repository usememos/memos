package postgres

import (
	"context"
	"database/sql"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func validatePostgresReactionWritePolicy(ctx context.Context, tx *sql.Tx, reaction *store.Reaction) error {
	policy := reaction.Policy
	participation, err := readPostgresMemoParticipation(ctx, tx, reaction.MemoID, policy.ActorUserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.ErrReactionMemoNotFound
		}
		return errors.Wrap(err, "failed to read reaction participation")
	}
	return store.ValidateReactionWriteParticipation(reaction, participation)
}

// validatePostgresReactionDeletePolicy authorizes a withdrawal and returns the
// participation snapshot so the caller can honour an administrator actor.
func validatePostgresReactionDeletePolicy(ctx context.Context, tx *sql.Tx, reaction *store.Reaction) (*store.MemoCommentAuthorizationSnapshot, error) {
	policy := reaction.Policy
	participation, err := readPostgresMemoParticipation(ctx, tx, reaction.MemoID, policy.ActorUserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.ErrReactionMemoNotFound
		}
		return nil, errors.Wrap(err, "failed to read reaction participation")
	}
	if err := store.ValidateReactionWithdrawal(reaction, participation); err != nil {
		return nil, err
	}
	return participation, nil
}
