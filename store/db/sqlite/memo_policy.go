package sqlite

import (
	"context"
	"database/sql"
	stderrors "errors"

	"github.com/usememos/memos/store"
)

// readSQLiteMemoActor reads the actor's lifecycle state and instance role
// inside the mutation transaction. A missing user is the zero state.
func readSQLiteMemoActor(ctx context.Context, executor dbExecutor, userID int32) (store.MemoActorState, error) {
	var rowStatus store.RowStatus
	var role store.Role
	err := executor.QueryRowContext(ctx, "SELECT row_status, role FROM user WHERE id = ?", userID).Scan(&rowStatus, &role)
	if stderrors.Is(err, sql.ErrNoRows) {
		return store.MemoActorState{}, nil
	}
	if err != nil {
		return store.MemoActorState{}, err
	}
	return store.NewMemoActorState(rowStatus, role), nil
}

// requireSQLiteActiveMemoActor resolves an actor that must be active;
// anything else is a permission denial.
func requireSQLiteActiveMemoActor(ctx context.Context, executor dbExecutor, userID int32) (store.MemoActorState, error) {
	actor, err := readSQLiteMemoActor(ctx, executor, userID)
	if err != nil {
		return store.MemoActorState{}, err
	}
	if !actor.Active {
		return store.MemoActorState{}, store.ErrMemoPermissionDenied
	}
	return actor, nil
}

// validateSQLiteMemoWritePolicy authorizes a transport-facing memo mutation
// against current database state and returns the validated snapshot.
func validateSQLiteMemoWritePolicy(ctx context.Context, executor dbExecutor, memoID int32, policy *store.MemoWritePolicy, update *store.UpdateMemo) (*store.MemoWriteSnapshot, error) {
	actor, err := readSQLiteMemoActor(ctx, executor, policy.ActorUserID)
	if err != nil {
		return nil, err
	}
	if !actor.Active {
		return nil, store.ErrMemoSpaceMembershipRequired
	}

	snapshot := &store.MemoWriteSnapshot{ActorIsAdmin: actor.Admin}
	var spaceID sql.NullInt64
	if err := executor.QueryRowContext(ctx, `SELECT creator_id, row_status, space_id, visibility FROM memo WHERE id = ?`, memoID).Scan(
		&snapshot.CreatorID, &snapshot.RowStatus, &spaceID, &snapshot.Visibility,
	); err != nil {
		if stderrors.Is(err, sql.ErrNoRows) {
			return nil, store.ErrMemoMutationConflict
		}
		return nil, err
	}
	snapshot.SpaceID = store.NullInt32Pointer(spaceID)
	if err := populateSQLiteMemoPolicySpaceState(ctx, executor, policy.ActorUserID, actor, update, snapshot); err != nil {
		return nil, err
	}

	if update != nil && update.Visibility != nil && *update.Visibility == store.SpaceAudience {
		var shareID int32
		err := executor.QueryRowContext(ctx, `SELECT id FROM memo_share
			WHERE memo_id = ? AND (expires_ts IS NULL OR expires_ts > CAST(strftime('%s', 'now') AS INTEGER))
			LIMIT 1`, memoID).Scan(&shareID)
		snapshot.HasActiveShare = err == nil
		if err != nil && !stderrors.Is(err, sql.ErrNoRows) {
			return nil, err
		}
	}
	if err := store.ValidateMemoWriteSnapshot(policy, update, snapshot); err != nil {
		return nil, err
	}
	return snapshot, nil
}

func populateSQLiteMemoPolicySpaceState(
	ctx context.Context,
	executor dbExecutor,
	actorUserID int32,
	actor store.MemoActorState,
	update *store.UpdateMemo,
	snapshot *store.MemoWriteSnapshot,
) error {
	if snapshot.SpaceID != nil {
		exists, member, err := sqliteMemoPolicySpaceState(ctx, executor, *snapshot.SpaceID, actorUserID, actor)
		if err != nil {
			return err
		}
		snapshot.SourceSpaceExists = exists
		snapshot.SourceMemberActive = member
	}
	if update != nil && update.SpaceID != nil {
		exists, member, err := sqliteMemoPolicySpaceState(ctx, executor, *update.SpaceID, actorUserID, actor)
		if err != nil {
			return err
		}
		snapshot.TargetSpaceExists = exists
		snapshot.TargetMemberActive = member
	}
	return nil
}

// sqliteMemoPolicySpaceState reports whether the Space exists and whether the
// actor is an active member. Membership is not consulted for an instance
// administrator, so it is not queried.
func sqliteMemoPolicySpaceState(ctx context.Context, executor dbExecutor, spaceID, actorUserID int32, actor store.MemoActorState) (bool, bool, error) {
	exists, err := sqliteSpaceExists(ctx, executor, spaceID)
	if err != nil || !exists || actor.Admin {
		return exists, false, err
	}
	member, err := sqliteSpaceMemberActive(ctx, executor, spaceID, actorUserID)
	return true, member, err
}

func sqliteSpaceExists(ctx context.Context, executor dbExecutor, spaceID int32) (bool, error) {
	var exists bool
	if err := executor.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM space WHERE id = ?)", spaceID).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}
