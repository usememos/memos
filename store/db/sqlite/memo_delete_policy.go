package sqlite

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

	var actorStatus store.RowStatus
	if err := tx.QueryRowContext(ctx, "SELECT row_status FROM user WHERE id = ?", delete.ActorUserID).Scan(&actorStatus); errors.Is(err, sql.ErrNoRows) {
		return nil, store.ErrMemoPermissionDenied
	} else if err != nil {
		return nil, errors.Wrap(err, "failed to read memo deletion actor")
	} else if actorStatus != store.Normal {
		return nil, store.ErrMemoPermissionDenied
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
	} else if creatorID != delete.ActorUserID {
		return nil, store.ErrMemoPermissionDenied
	}
	spaceID := store.NullInt32Pointer(space)
	spaceExists := false
	actorMember := false
	if spaceID != nil {
		var existingSpaceID int32
		if err := tx.QueryRowContext(ctx, "SELECT id FROM space WHERE id = ?", *spaceID).Scan(&existingSpaceID); err == nil {
			spaceExists = true
		} else if !errors.Is(err, sql.ErrNoRows) {
			return nil, errors.Wrap(err, "failed to read memo space")
		}
		if spaceExists {
			actorMember, err = sqliteSpaceMemberActive(ctx, tx, *spaceID, delete.ActorUserID)
			if err != nil {
				return nil, errors.Wrap(err, "failed to read memo membership")
			}
		}
	}
	actorCanRead := store.MemoDeleteActorCanRead(rowStatus, visibility, spaceID, spaceExists, actorMember)

	attachments, err := deleteSQLiteMemoSetTx(ctx, tx, []int32{delete.MemoID})
	if err != nil {
		return nil, errors.Wrap(err, "failed to delete memo set")
	}
	if err := tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "failed to commit memo delete transaction")
	}
	return &store.DeleteMemoWithPolicyResult{ActorCanRead: actorCanRead, Attachments: attachments}, nil
}
