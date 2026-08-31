package mysql

import (
	"context"
	"database/sql"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func validateMySQLReactionWritePolicy(ctx context.Context, tx *sql.Tx, reaction *store.Reaction) error {
	policy := reaction.Policy
	participation, err := loadMySQLMemoParticipation(ctx, tx, reaction.MemoID, policy.ActorUserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.ErrReactionMemoNotFound
		}
		return errors.Wrap(err, "failed to read reaction participation")
	}
	return store.ValidateReactionWriteParticipation(reaction, participation)
}

func mysqlSpaceMemberActive(ctx context.Context, tx *sql.Tx, spaceID, userID int32) (bool, error) {
	var role store.SpaceMemberRole
	err := tx.QueryRowContext(ctx, `SELECT role FROM space_member
		WHERE space_id = ? AND user_id = ? AND status = 'ACTIVE' AND role IN ('ADMIN', 'USER')`, spaceID, userID).Scan(&role)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return role.IsActiveMember(), nil
}
