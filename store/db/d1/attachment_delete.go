package d1

import (
	"context"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

// DeleteAttachmentsWithPolicy authorizes the actor against every linked memo
// and then deletes the rows in one atomic batch. Each delete is preceded by a
// guard on the row's existence so a row that vanished after the validation
// reads aborts the whole batch as a conflict, mirroring the per-row
// RowsAffected check a transaction would perform.
func (d *DB) DeleteAttachmentsWithPolicy(ctx context.Context, policy *store.AttachmentDeletionPolicy, attachmentIDs []int32) error {
	if policy == nil || policy.ActorUserID <= 0 {
		return store.ErrMemoPermissionDenied
	}
	attachments, err := listAttachmentSnapshots(ctx, d.db, attachmentIDs)
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
	if err := authorizeAttachmentMutation(ctx, d.db, policy.ActorUserID, memoIDs, policy.ExpectedMemoContents); err != nil {
		return err
	}

	b := newBatch()
	b.guard(activeUserCondition, policy.ActorUserID)
	for _, attachmentID := range attachmentIDs {
		b.guard("EXISTS (SELECT 1 FROM attachment WHERE id = ?)", attachmentID)
		b.add("DELETE FROM attachment WHERE id = ?", attachmentID)
	}
	if _, err := b.commit(ctx, d); err != nil {
		return guardError(err, store.ErrMemoMutationConflict)
	}
	return nil
}
