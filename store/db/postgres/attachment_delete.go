package postgres

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

	attachments, err := listPostgresAttachmentSnapshots(ctx, tx, attachmentIDs)
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
	if err := authorizePostgresAttachmentMutation(ctx, tx, policy.ActorUserID, memoIDs, policy.ExpectedMemoContents); err != nil {
		return err
	}

	for _, attachmentID := range attachmentIDs {
		result, err := tx.ExecContext(ctx, "DELETE FROM attachment WHERE id = $1", attachmentID)
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

func listPostgresAttachmentSnapshots(ctx context.Context, tx *sql.Tx, attachmentIDs []int32) ([]*store.Attachment, error) {
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

func authorizePostgresAttachmentMutation(
	ctx context.Context,
	tx *sql.Tx,
	actorUserID int32,
	memoIDs []int32,
	expectedMemoContents map[int32]string,
) error {
	var actorStatus store.RowStatus
	if err := tx.QueryRowContext(ctx, `SELECT row_status FROM "user" WHERE id = $1`, actorUserID).Scan(&actorStatus); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return store.ErrMemoPermissionDenied
		}
		return errors.Wrap(err, "failed to read attachment actor")
	}
	if actorStatus != store.Normal {
		return store.ErrMemoPermissionDenied
	}

	writePolicy := &store.MemoWritePolicy{ActorUserID: actorUserID}
	for _, memoID := range memoIDs {
		snapshot := &store.MemoWriteSnapshot{}
		var memoSpace sql.NullInt64
		var content string
		if err := tx.QueryRowContext(ctx, `SELECT creator_id, row_status, space_id, visibility, content
			FROM memo WHERE id = $1`, memoID).Scan(
			&snapshot.CreatorID, &snapshot.RowStatus, &memoSpace, &snapshot.Visibility, &content,
		); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return store.ErrMemoMutationConflict
			}
			return errors.Wrap(err, "failed to read attachment memo")
		}
		snapshot.SpaceID = store.NullInt32Pointer(memoSpace)
		if snapshot.SpaceID != nil {
			var err error
			snapshot.SourceSpaceExists, snapshot.SourceMemberActive, err = readPostgresMemoSpaceState(ctx, tx, *snapshot.SpaceID, actorUserID)
			if err != nil {
				return errors.Wrap(err, "failed to read attachment memo space state")
			}
		}
		if err := store.ValidateMemoWriteSnapshot(writePolicy, nil, snapshot); err != nil {
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
