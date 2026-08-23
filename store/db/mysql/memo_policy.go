package mysql

import (
	"context"
	"database/sql"
	stderrors "errors"

	"github.com/usememos/memos/store"
)

func validateMySQLMemoWritePolicy(ctx context.Context, tx *sql.Tx, memoID int32, policy *store.MemoWritePolicy, update *store.UpdateMemo) error {
	var actorStatus store.RowStatus
	if err := tx.QueryRowContext(ctx, "SELECT row_status FROM user WHERE id = ?", policy.ActorUserID).Scan(&actorStatus); stderrors.Is(err, sql.ErrNoRows) {
		return store.ErrMemoSpaceMembershipRequired
	} else if err != nil {
		return err
	} else if actorStatus != store.Normal {
		return store.ErrMemoSpaceMembershipRequired
	}

	snapshot := new(store.MemoWriteSnapshot)
	var spaceID sql.NullInt64
	if err := tx.QueryRowContext(ctx, `SELECT creator_id, row_status, space_id, visibility FROM memo WHERE id = ?`, memoID).Scan(
		&snapshot.CreatorID, &snapshot.RowStatus, &spaceID, &snapshot.Visibility,
	); err != nil {
		if stderrors.Is(err, sql.ErrNoRows) {
			return store.ErrMemoMutationConflict
		}
		return err
	}
	snapshot.SpaceID = store.NullInt32Pointer(spaceID)
	if snapshot.SpaceID != nil {
		var err error
		snapshot.SourceSpaceExists, err = mysqlSpaceExists(ctx, tx, *snapshot.SpaceID)
		if err != nil {
			return err
		}
		if snapshot.SourceSpaceExists {
			snapshot.SourceMemberActive, err = mysqlSpaceMemberActive(ctx, tx, *snapshot.SpaceID, policy.ActorUserID)
			if err != nil {
				return err
			}
		}
	}
	if update != nil && update.SpaceID != nil {
		var err error
		snapshot.TargetSpaceExists, err = mysqlSpaceExists(ctx, tx, *update.SpaceID)
		if err != nil {
			return err
		}
		if snapshot.TargetSpaceExists {
			snapshot.TargetMemberActive, err = mysqlSpaceMemberActive(ctx, tx, *update.SpaceID, policy.ActorUserID)
			if err != nil {
				return err
			}
		}
	}

	if update != nil && update.Visibility != nil && *update.Visibility == store.SpaceAudience {
		var shareID int32
		err := tx.QueryRowContext(ctx, `SELECT id FROM memo_share
			WHERE memo_id = ? AND (expires_ts IS NULL OR expires_ts > UNIX_TIMESTAMP())
			LIMIT 1`, memoID).Scan(&shareID)
		snapshot.HasActiveShare = err == nil
		if err != nil && !stderrors.Is(err, sql.ErrNoRows) {
			return err
		}
	}
	return store.ValidateMemoWriteSnapshot(policy, update, snapshot)
}

func mysqlSpaceExists(ctx context.Context, tx *sql.Tx, spaceID int32) (bool, error) {
	var exists bool
	if err := tx.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM space WHERE id = ?)", spaceID).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}
