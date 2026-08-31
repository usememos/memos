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
