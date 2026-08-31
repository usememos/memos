package sqlite

import (
	"context"
	"database/sql"
	stderrors "errors"

	"github.com/usememos/memos/store"
)

func validateSQLiteMemoWritePolicy(ctx context.Context, executor dbExecutor, memoID int32, policy *store.MemoWritePolicy, update *store.UpdateMemo) error {
	var actorStatus store.RowStatus
	if err := executor.QueryRowContext(ctx, "SELECT row_status FROM user WHERE id = ?", policy.ActorUserID).Scan(&actorStatus); stderrors.Is(err, sql.ErrNoRows) {
		return store.ErrMemoSpaceMembershipRequired
	} else if err != nil {
		return err
	} else if actorStatus != store.Normal {
		return store.ErrMemoSpaceMembershipRequired
	}

	snapshot := new(store.MemoWriteSnapshot)
	var spaceID sql.NullInt64
	if err := executor.QueryRowContext(ctx, `SELECT creator_id, row_status, space_id, visibility FROM memo WHERE id = ?`, memoID).Scan(
		&snapshot.CreatorID, &snapshot.RowStatus, &spaceID, &snapshot.Visibility,
	); err != nil {
		if stderrors.Is(err, sql.ErrNoRows) {
			return store.ErrMemoMutationConflict
		}
		return err
	}
	snapshot.SpaceID = store.NullInt32Pointer(spaceID)
	if err := populateSQLiteMemoPolicySpaceState(ctx, executor, policy.ActorUserID, update, snapshot); err != nil {
		return err
	}

	if update != nil && update.Visibility != nil && *update.Visibility == store.SpaceAudience {
		var shareID int32
		err := executor.QueryRowContext(ctx, `SELECT id FROM memo_share
			WHERE memo_id = ? AND (expires_ts IS NULL OR expires_ts > CAST(strftime('%s', 'now') AS INTEGER))
			LIMIT 1`, memoID).Scan(&shareID)
		snapshot.HasActiveShare = err == nil
		if err != nil && !stderrors.Is(err, sql.ErrNoRows) {
			return err
		}
	}
	return store.ValidateMemoWriteSnapshot(policy, update, snapshot)
}

func populateSQLiteMemoPolicySpaceState(
	ctx context.Context,
	executor dbExecutor,
	actorUserID int32,
	update *store.UpdateMemo,
	snapshot *store.MemoWriteSnapshot,
) error {
	if snapshot.SpaceID != nil {
		exists, member, err := sqliteMemoPolicySpaceState(ctx, executor, *snapshot.SpaceID, actorUserID)
		if err != nil {
			return err
		}
		snapshot.SourceSpaceExists = exists
		snapshot.SourceMemberActive = member
	}
	if update != nil && update.SpaceID != nil {
		exists, member, err := sqliteMemoPolicySpaceState(ctx, executor, *update.SpaceID, actorUserID)
		if err != nil {
			return err
		}
		snapshot.TargetSpaceExists = exists
		snapshot.TargetMemberActive = member
	}
	return nil
}

func sqliteMemoPolicySpaceState(ctx context.Context, executor dbExecutor, spaceID, actorUserID int32) (bool, bool, error) {
	var exists bool
	if err := executor.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM space WHERE id = ?)", spaceID).Scan(&exists); err != nil {
		return false, false, err
	}
	if !exists {
		return false, false, nil
	}
	member, err := sqliteSpaceMemberActive(ctx, executor, spaceID, actorUserID)
	return true, member, err
}
