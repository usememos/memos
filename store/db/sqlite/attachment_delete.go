package sqlite

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
	attachments, err := listSQLiteAttachmentSnapshots(ctx, tx, attachmentIDs)
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
	if err := authorizeSQLiteAttachmentMutation(ctx, tx, policy.ActorUserID, memoIDs, policy.ExpectedMemoContents); err != nil {
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

func listSQLiteAttachmentSnapshots(ctx context.Context, tx dbExecutor, attachmentIDs []int32) ([]*store.Attachment, error) {
	attachments := make([]*store.Attachment, 0, len(attachmentIDs))
	seen := make(map[int32]struct{}, len(attachmentIDs))
	for _, batch := range deleteUserBatches(attachmentIDs, deleteUserBatchSize) {
		clause, args := deleteUserInClause(1, batch)
		if err := appendDeleteUserAttachments(ctx, tx, `SELECT id, uid, creator_id, memo_id, storage_type, reference, payload
			FROM attachment WHERE id IN `+clause+` ORDER BY id`, args, seen, &attachments); err != nil {
			return nil, err
		}
	}
	return attachments, nil
}

func authorizeSQLiteAttachmentMutation(
	ctx context.Context,
	tx dbExecutor,
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

	for _, memoID := range memoIDs {
		snapshot := &store.MemoWriteSnapshot{}
		var currentSpace sql.NullInt64
		var content string
		if err := tx.QueryRowContext(ctx, `SELECT creator_id, row_status, space_id, visibility, content
			FROM memo WHERE id = ?`, memoID).Scan(
			&snapshot.CreatorID, &snapshot.RowStatus, &currentSpace, &snapshot.Visibility, &content,
		); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return store.ErrMemoMutationConflict
			}
			return errors.Wrap(err, "failed to read attachment memo")
		}
		snapshot.SpaceID = store.NullInt32Pointer(currentSpace)
		if expectedMemoContents != nil && content != expectedMemoContents[memoID] {
			return store.ErrMemoMutationConflict
		}
		if snapshot.SpaceID != nil {
			var exists bool
			if err := tx.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM space WHERE id = ?)", *snapshot.SpaceID).Scan(&exists); err != nil {
				return errors.Wrap(err, "failed to read attachment memo space")
			}
			snapshot.SourceSpaceExists = exists
			if exists {
				active, err := sqliteSpaceMemberActive(ctx, tx, *snapshot.SpaceID, actorUserID)
				if err != nil {
					return errors.Wrap(err, "failed to read attachment memo membership")
				}
				snapshot.SourceMemberActive = active
			}
		}
		if err := store.ValidateMemoWriteSnapshot(&store.MemoWritePolicy{ActorUserID: actorUserID}, nil, snapshot); err != nil {
			return err
		}
	}
	return nil
}
