package sqlite

import (
	"context"
	"database/sql"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func validateSQLiteReactionWritePolicy(ctx context.Context, tx dbExecutor, reaction *store.Reaction) error {
	policy := reaction.Policy
	participation, err := loadSQLiteMemoParticipation(ctx, tx, reaction.MemoID, policy.ActorUserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.ErrReactionMemoNotFound
		}
		return errors.Wrap(err, "failed to read reaction participation")
	}
	return store.ValidateReactionWriteParticipation(reaction, participation)
}

func sqliteSpaceMemberActive(ctx context.Context, tx dbExecutor, spaceID, userID int32) (bool, error) {
	var role store.SpaceMemberRole
	err := tx.QueryRowContext(ctx, `SELECT role FROM space_member
		WHERE space_id = ? AND user_id = ? AND role IN ('ADMIN', 'USER')`, spaceID, userID).Scan(&role)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return role.IsActiveMember(), nil
}
