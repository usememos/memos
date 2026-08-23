package postgres

import (
	"context"
	"database/sql"
	stderrors "errors"

	"github.com/usememos/memos/store"
)

func validatePostgresMemoWritePolicy(ctx context.Context, tx *sql.Tx, memoID int32, policy *store.MemoWritePolicy, update *store.UpdateMemo) error {
	var actorStatus store.RowStatus
	if err := tx.QueryRowContext(ctx, `SELECT row_status FROM "user" WHERE id = $1`, policy.ActorUserID).Scan(&actorStatus); stderrors.Is(err, sql.ErrNoRows) {
		return store.ErrMemoSpaceMembershipRequired
	} else if err != nil {
		return err
	} else if actorStatus != store.Normal {
		return store.ErrMemoSpaceMembershipRequired
	}

	snapshot := new(store.MemoWriteSnapshot)
	var sourceSpace sql.NullInt64
	if err := tx.QueryRowContext(ctx, `SELECT creator_id, row_status, space_id, visibility FROM memo WHERE id = $1`, memoID).Scan(
		&snapshot.CreatorID, &snapshot.RowStatus, &sourceSpace, &snapshot.Visibility,
	); err != nil {
		if stderrors.Is(err, sql.ErrNoRows) {
			return store.ErrMemoMutationConflict
		}
		return err
	}
	snapshot.SpaceID = store.NullInt32Pointer(sourceSpace)
	if err := populatePostgresMemoPolicySpaceState(ctx, tx, policy.ActorUserID, update, snapshot); err != nil {
		return err
	}

	if update != nil && update.Visibility != nil && *update.Visibility == store.SpaceAudience {
		var shareID int32
		err := tx.QueryRowContext(ctx, `SELECT id FROM memo_share
			WHERE memo_id = $1 AND (expires_ts IS NULL OR expires_ts > EXTRACT(EPOCH FROM NOW()))
			LIMIT 1`, memoID).Scan(&shareID)
		snapshot.HasActiveShare = err == nil
		if err != nil && !stderrors.Is(err, sql.ErrNoRows) {
			return err
		}
	}
	return store.ValidateMemoWriteSnapshot(policy, update, snapshot)
}

func populatePostgresMemoPolicySpaceState(
	ctx context.Context,
	tx *sql.Tx,
	actorUserID int32,
	update *store.UpdateMemo,
	snapshot *store.MemoWriteSnapshot,
) error {
	if snapshot.SpaceID != nil {
		var err error
		snapshot.SourceSpaceExists, snapshot.SourceMemberActive, err = readPostgresMemoSpaceState(ctx, tx, *snapshot.SpaceID, actorUserID)
		if err != nil {
			return err
		}
	}
	if update != nil && update.SpaceID != nil {
		if snapshot.SpaceID != nil && *snapshot.SpaceID == *update.SpaceID {
			snapshot.TargetSpaceExists = snapshot.SourceSpaceExists
			snapshot.TargetMemberActive = snapshot.SourceMemberActive
			return nil
		}
		var err error
		snapshot.TargetSpaceExists, snapshot.TargetMemberActive, err = readPostgresMemoSpaceState(ctx, tx, *update.SpaceID, actorUserID)
		if err != nil {
			return err
		}
	}
	return nil
}

func readPostgresMemoSpaceState(ctx context.Context, tx *sql.Tx, spaceID, actorUserID int32) (bool, bool, error) {
	var spaceExists, memberActive bool
	if err := tx.QueryRowContext(ctx, `SELECT
		EXISTS(SELECT 1 FROM space WHERE id = $1),
		EXISTS(SELECT 1 FROM space_member WHERE space_id = $1 AND user_id = $2 AND role IN ('ADMIN', 'USER'))`,
		spaceID, actorUserID).Scan(&spaceExists, &memberActive); err != nil {
		return false, false, err
	}
	return spaceExists, memberActive, nil
}
