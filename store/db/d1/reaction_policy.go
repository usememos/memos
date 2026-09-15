package d1

import (
	"context"
	"database/sql"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

// reactionValidateWritePolicy checks that the policy actor may react to the
// reaction's memo, reading the participation state through q.
func reactionValidateWritePolicy(ctx context.Context, q querier, reaction *store.Reaction) error {
	participation, err := reactionLoadParticipation(ctx, q, reaction)
	if err != nil {
		return err
	}
	return store.ValidateReactionWriteParticipation(reaction, participation)
}

// reactionValidateDeletePolicy checks that the policy actor may withdraw the
// reaction from its memo.
func reactionValidateDeletePolicy(ctx context.Context, q querier, reaction *store.Reaction) error {
	participation, err := reactionLoadParticipation(ctx, q, reaction)
	if err != nil {
		return err
	}
	return store.ValidateReactionWithdrawal(reaction, participation)
}

// reactionLoadParticipation resolves the actor's participation in the
// reaction's memo, mapping a missing memo to ErrReactionMemoNotFound.
func reactionLoadParticipation(ctx context.Context, q querier, reaction *store.Reaction) (*store.MemoCommentAuthorizationSnapshot, error) {
	participation, err := loadMemoParticipation(ctx, q, reaction.MemoID, reaction.Policy.ActorUserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.ErrReactionMemoNotFound
		}
		return nil, errors.Wrap(err, "failed to read reaction participation")
	}
	return participation, nil
}
