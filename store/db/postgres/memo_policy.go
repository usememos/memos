package postgres

import (
	"context"
	"database/sql"
	stderrors "errors"

	"github.com/usememos/memos/store"
)

// readPostgresMemoActor reads the actor's lifecycle state and instance role
// inside the mutation transaction. A missing user is the zero state.
func readPostgresMemoActor(ctx context.Context, tx *sql.Tx, userID int32) (store.MemoActorState, error) {
	var rowStatus store.RowStatus
	var role store.Role
	err := tx.QueryRowContext(ctx, `SELECT row_status, role FROM "user" WHERE id = $1`, userID).Scan(&rowStatus, &role)
	if stderrors.Is(err, sql.ErrNoRows) {
		return store.MemoActorState{}, nil
	}
	if err != nil {
		return store.MemoActorState{}, err
	}
	return store.NewMemoActorState(rowStatus, role), nil
}

// requirePostgresActiveMemoActor resolves an actor that must be active;
// anything else is a permission denial.
func requirePostgresActiveMemoActor(ctx context.Context, tx *sql.Tx, userID int32) (store.MemoActorState, error) {
	actor, err := readPostgresMemoActor(ctx, tx, userID)
	if err != nil {
		return store.MemoActorState{}, err
	}
	if !actor.Active {
		return store.MemoActorState{}, store.ErrMemoPermissionDenied
	}
	return actor, nil
}

// validatePostgresMemoWritePolicy authorizes a transport-facing memo mutation
// against current database state and returns the validated snapshot.
func validatePostgresMemoWritePolicy(ctx context.Context, tx *sql.Tx, memoID int32, policy *store.MemoWritePolicy, update *store.UpdateMemo) (*store.MemoWriteSnapshot, error) {
	actor, err := readPostgresMemoActor(ctx, tx, policy.ActorUserID)
	if err != nil {
		return nil, err
	}
	if !actor.Active {
		return nil, store.ErrMemoSpaceMembershipRequired
	}

	snapshot := &store.MemoWriteSnapshot{ActorIsAdmin: actor.Admin}
	var sourceSpace sql.NullInt64
	if err := tx.QueryRowContext(ctx, `SELECT creator_id, row_status, space_id, visibility FROM memo WHERE id = $1`, memoID).Scan(
		&snapshot.CreatorID, &snapshot.RowStatus, &sourceSpace, &snapshot.Visibility,
	); err != nil {
		if stderrors.Is(err, sql.ErrNoRows) {
			return nil, store.ErrMemoMutationConflict
		}
		return nil, err
	}
	snapshot.SpaceID = store.NullInt32Pointer(sourceSpace)
	if err := populatePostgresMemoPolicySpaceState(ctx, tx, policy.ActorUserID, update, snapshot); err != nil {
		return nil, err
	}

	if update != nil && update.Visibility != nil && *update.Visibility == store.SpaceAudience {
		var shareID int32
		err := tx.QueryRowContext(ctx, `SELECT id FROM memo_share
			WHERE memo_id = $1 AND (expires_ts IS NULL OR expires_ts > EXTRACT(EPOCH FROM NOW()))
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

// readPostgresMemoSpaceState reports whether the Space exists and whether the
// actor is an active member, in one round trip.
func readPostgresMemoSpaceState(ctx context.Context, tx *sql.Tx, spaceID, actorUserID int32) (bool, bool, error) {
	var spaceExists, memberActive bool
	if err := tx.QueryRowContext(ctx, `SELECT
		EXISTS(SELECT 1 FROM space WHERE id = $1),
		EXISTS(SELECT 1 FROM space_member WHERE space_id = $1 AND user_id = $2
			AND status = 'ACTIVE' AND role IN ('ADMIN', 'USER'))`,
		spaceID, actorUserID).Scan(&spaceExists, &memberActive); err != nil {
		return false, false, err
	}
	return spaceExists, memberActive, nil
}

func postgresSpaceExists(ctx context.Context, tx *sql.Tx, spaceID int32) (bool, error) {
	var exists bool
	if err := tx.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM space WHERE id = $1)", spaceID).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}
