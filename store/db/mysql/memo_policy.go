package mysql

import (
	"context"
	"database/sql"
	stderrors "errors"

	"github.com/usememos/memos/store"
)

// readMySQLMemoActor reads the actor's lifecycle state and instance role
// inside the mutation transaction. A missing user is the zero state.
func readMySQLMemoActor(ctx context.Context, tx *sql.Tx, userID int32) (store.MemoActorState, error) {
	var rowStatus store.RowStatus
	var role store.Role
	err := tx.QueryRowContext(ctx, "SELECT row_status, role FROM user WHERE id = ?", userID).Scan(&rowStatus, &role)
	if stderrors.Is(err, sql.ErrNoRows) {
		return store.MemoActorState{}, nil
	}
	if err != nil {
		return store.MemoActorState{}, err
	}
	return store.NewMemoActorState(rowStatus, role), nil
}

// requireMySQLActiveMemoActor resolves an actor that must be active; anything
// else is a permission denial.
func requireMySQLActiveMemoActor(ctx context.Context, tx *sql.Tx, userID int32) (store.MemoActorState, error) {
	actor, err := readMySQLMemoActor(ctx, tx, userID)
	if err != nil {
		return store.MemoActorState{}, err
	}
	if !actor.Active {
		return store.MemoActorState{}, store.ErrMemoPermissionDenied
	}
	return actor, nil
}

// validateMySQLMemoWritePolicy authorizes a transport-facing memo mutation
// against current database state and returns the validated snapshot.
func validateMySQLMemoWritePolicy(ctx context.Context, tx *sql.Tx, memoID int32, policy *store.MemoWritePolicy, update *store.UpdateMemo) (*store.MemoWriteSnapshot, error) {
	actor, err := readMySQLMemoActor(ctx, tx, policy.ActorUserID)
	if err != nil {
		return nil, err
	}
	if !actor.Active {
		return nil, store.ErrMemoSpaceMembershipRequired
	}

	snapshot := &store.MemoWriteSnapshot{ActorIsAdmin: actor.Admin}
	var spaceID sql.NullInt64
	if err := tx.QueryRowContext(ctx, `SELECT creator_id, row_status, space_id, visibility FROM memo WHERE id = ?`, memoID).Scan(
		&snapshot.CreatorID, &snapshot.RowStatus, &spaceID, &snapshot.Visibility,
	); err != nil {
		if stderrors.Is(err, sql.ErrNoRows) {
			return nil, store.ErrMemoMutationConflict
		}
		return nil, err
	}
	snapshot.SpaceID = store.NullInt32Pointer(spaceID)
	if snapshot.SpaceID != nil {
		var err error
		snapshot.SourceSpaceExists, snapshot.SourceMemberActive, err = mysqlMemoPolicySpaceState(ctx, tx, *snapshot.SpaceID, policy.ActorUserID, actor)
		if err != nil {
			return nil, err
		}
	}
	if update != nil && update.SpaceID != nil {
		var err error
		snapshot.TargetSpaceExists, snapshot.TargetMemberActive, err = mysqlMemoPolicySpaceState(ctx, tx, *update.SpaceID, policy.ActorUserID, actor)
		if err != nil {
			return nil, err
		}
	}

	if update != nil && update.Visibility != nil && *update.Visibility == store.SpaceAudience {
		var shareID int32
		err := tx.QueryRowContext(ctx, `SELECT id FROM memo_share
			WHERE memo_id = ? AND (expires_ts IS NULL OR expires_ts > UNIX_TIMESTAMP())
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

// mysqlMemoPolicySpaceState reports whether the Space exists and whether the
// actor is an active member. Membership is not consulted for an instance
// administrator, so it is not queried.
func mysqlMemoPolicySpaceState(ctx context.Context, tx *sql.Tx, spaceID, actorUserID int32, actor store.MemoActorState) (bool, bool, error) {
	exists, err := mysqlSpaceExists(ctx, tx, spaceID)
	if err != nil || !exists || actor.Admin {
		return exists, false, err
	}
	member, err := mysqlSpaceMemberActive(ctx, tx, spaceID, actorUserID)
	return true, member, err
}

func mysqlSpaceExists(ctx context.Context, tx *sql.Tx, spaceID int32) (bool, error) {
	var exists bool
	if err := tx.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM space WHERE id = ?)", spaceID).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}
