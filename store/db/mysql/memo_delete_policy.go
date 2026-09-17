package mysql

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

	actor, err := requireMySQLActiveMemoActor(ctx, tx, delete.ActorUserID)
	if err != nil {
		return nil, err
	}

	var creatorID int32
	var rowStatus store.RowStatus
	var visibility store.Visibility
	var space sql.NullInt64
	if err := tx.QueryRowContext(ctx, "SELECT creator_id, row_status, visibility, space_id FROM memo WHERE id = ?", delete.MemoID).Scan(
		&creatorID, &rowStatus, &visibility, &space,
	); errors.Is(err, sql.ErrNoRows) {
		return nil, store.ErrMemoMutationConflict
	} else if err != nil {
		return nil, errors.Wrap(err, "failed to read memo")
	}
	if creatorID != delete.ActorUserID && !actor.Admin {
		return nil, store.ErrMemoPermissionDenied
	}
	spaceID := store.NullInt32Pointer(space)
	spaceExists := false
	actorMember := false
	if spaceID != nil {
		spaceExists, err = mysqlSpaceExists(ctx, tx, *spaceID)
		if err != nil {
			return nil, errors.Wrap(err, "failed to read memo space")
		}
	}
	if spaceID != nil && spaceExists && !actor.Admin {
		actorMember, err = mysqlSpaceMemberActive(ctx, tx, *spaceID, delete.ActorUserID)
		if err != nil {
			return nil, errors.Wrap(err, "failed to read memo membership")
		}
	}
	actorCanRead := store.MemoDeleteActorCanRead(rowStatus, visibility, spaceID, spaceExists, actorMember || actor.Admin)

	attachments, err := deleteMySQLMemoSetTx(ctx, tx, []int32{delete.MemoID})
	if err != nil {
		return nil, errors.Wrap(err, "failed to delete memo set")
	}
	if err := tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "failed to commit memo delete transaction")
	}
	return &store.DeleteMemoWithPolicyResult{ActorCanRead: actorCanRead, Attachments: attachments}, nil
}
