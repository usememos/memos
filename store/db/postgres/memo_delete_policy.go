package postgres

import (
	"context"
	"database/sql"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func (d *DB) DeleteMemoWithPolicy(ctx context.Context, delete *store.DeleteMemoWithPolicy) (*store.DeleteMemoWithPolicyResult, error) {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, errors.Wrap(err, "failed to begin memo delete transaction")
	}
	defer func() { _ = tx.Rollback() }()

	actor, err := requirePostgresActiveMemoActor(ctx, tx, delete.ActorUserID)
	if err != nil {
		return nil, err
	}

	var creatorID int32
	var rowStatus store.RowStatus
	var visibility store.Visibility
	var memoSpace sql.NullInt64
	if err := tx.QueryRowContext(ctx, `SELECT creator_id, row_status, visibility, space_id FROM memo WHERE id = $1`, delete.MemoID).Scan(
		&creatorID, &rowStatus, &visibility, &memoSpace,
	); errors.Is(err, sql.ErrNoRows) {
		return nil, store.ErrMemoMutationConflict
	} else if err != nil {
		return nil, errors.Wrap(err, "failed to read memo")
	}
	if creatorID != delete.ActorUserID && !actor.Admin {
		return nil, store.ErrMemoPermissionDenied
	}
	memoSpaceID := store.NullInt32Pointer(memoSpace)
	spaceExists, actorMember := false, false
	if memoSpaceID != nil {
		spaceExists, actorMember, err = readPostgresMemoSpaceState(ctx, tx, *memoSpaceID, delete.ActorUserID)
		if err != nil {
			return nil, errors.Wrap(err, "failed to read memo space state")
		}
	}
	actorCanRead := store.MemoDeleteActorCanRead(rowStatus, visibility, memoSpaceID, spaceExists, actorMember || actor.Admin)

	attachments, err := deletePostgresMemoSetTx(ctx, tx, []int32{delete.MemoID})
	if err != nil {
		return nil, errors.Wrap(err, "failed to delete memo set")
	}
	if err := tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "failed to commit memo delete transaction")
	}
	return &store.DeleteMemoWithPolicyResult{ActorCanRead: actorCanRead, Attachments: attachments}, nil
}
