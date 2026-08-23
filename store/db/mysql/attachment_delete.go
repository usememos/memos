package mysql

import (
	"context"
	"database/sql"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func (d *DB) DeleteAttachmentsWithPolicy(ctx context.Context, policy *store.AttachmentDeletionPolicy, attachmentIDs []int32) error {
	if policy == nil || policy.ActorUserID <= 0 {
		return store.ErrMemoPermissionDenied
	}
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return errors.Wrap(err, "failed to begin attachment delete transaction")
	}
	defer func() { _ = tx.Rollback() }()

	attachments, err := listMySQLAttachmentsByIDs(ctx, tx, attachmentIDs)
	if err != nil {
		return errors.Wrap(err, "failed to read attachment delete targets")
	}
	memoIDs, err := store.ValidateAttachmentMutationTargets(policy.ActorUserID, attachmentIDs, attachments)
	if err != nil {
		return err
	}
	if err := store.ValidateAttachmentDeletionMemoSnapshots(memoIDs, policy.ExpectedMemoContents); err != nil {
		return err
	}
	if err := authorizeMySQLAttachmentMutation(ctx, tx, policy.ActorUserID, memoIDs, policy.ExpectedMemoContents); err != nil {
		return err
	}

	for _, attachmentID := range attachmentIDs {
		result, err := tx.ExecContext(ctx, "DELETE FROM attachment WHERE id = ?", attachmentID)
		if err != nil {
			return errors.Wrap(err, "failed to delete attachment")
		}
		if rows, err := result.RowsAffected(); err != nil {
			return errors.Wrap(err, "failed to count deleted attachment")
		} else if rows != 1 {
			return store.ErrMemoMutationConflict
		}
	}
	if err := tx.Commit(); err != nil {
		return errors.Wrap(err, "failed to commit attachment deletion")
	}
	return nil
}

func authorizeMySQLAttachmentMutation(
	ctx context.Context,
	tx *sql.Tx,
	actorUserID int32,
	memoIDs []int32,
	expectedMemoContents map[int32]string,
) error {
	var actorStatus store.RowStatus
	if err := tx.QueryRowContext(ctx, "SELECT row_status FROM user WHERE id = ?", actorUserID).Scan(&actorStatus); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.ErrMemoPermissionDenied
		}
		return errors.Wrap(err, "failed to read attachment actor")
	}
	if actorStatus != store.Normal {
		return store.ErrMemoPermissionDenied
	}

	policy := &store.MemoWritePolicy{ActorUserID: actorUserID}
	for _, memoID := range memoIDs {
		snapshot := &store.MemoWriteSnapshot{}
		var spaceID sql.NullInt64
		var content string
		if err := tx.QueryRowContext(ctx, `SELECT creator_id, row_status, space_id, visibility, content
			FROM memo WHERE id = ?`, memoID).Scan(
			&snapshot.CreatorID, &snapshot.RowStatus, &spaceID, &snapshot.Visibility, &content,
		); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return store.ErrMemoMutationConflict
			}
			return errors.Wrap(err, "failed to read attachment memo")
		}
		snapshot.SpaceID = store.NullInt32Pointer(spaceID)
		if snapshot.SpaceID != nil {
			var err error
			snapshot.SourceSpaceExists, err = mysqlSpaceExists(ctx, tx, *snapshot.SpaceID)
			if err != nil {
				return errors.Wrap(err, "failed to read attachment memo space")
			}
			if snapshot.SourceSpaceExists {
				snapshot.SourceMemberActive, err = mysqlSpaceMemberActive(ctx, tx, *snapshot.SpaceID, actorUserID)
				if err != nil {
					return errors.Wrap(err, "failed to read attachment memo membership")
				}
			}
		}
		if err := store.ValidateMemoWriteSnapshot(policy, nil, snapshot); err != nil {
			return err
		}
		if expectedMemoContents != nil {
			expectedContent, ok := expectedMemoContents[memoID]
			if !ok || content != expectedContent {
				return store.ErrMemoMutationConflict
			}
		}
	}
	return nil
}
