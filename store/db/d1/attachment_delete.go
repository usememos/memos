package d1

import (
	"context"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

// DeleteAttachmentsWithPolicy authorizes the actor against every linked memo
// and then deletes the rows in one atomic batch. The batch re-asserts the
// memo states and bindings the authorization read, including the memo
// content the caller expects, so a row or memo that changed after the
// validation reads aborts the whole batch as a conflict.
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
	states, err := authorizeAttachmentMutation(ctx, d.db, policy.ActorUserID, memoIDs, policy.ExpectedMemoContents)
	if err != nil {
		return err
	}

	b := newBatch()
	guardAttachmentMutation(b, policy.ActorUserID, states, attachments, policy.ExpectedMemoContents)
	for _, attachment := range attachments {
		b.add("DELETE FROM attachment WHERE id = ?", attachment.ID)
	}
	if _, err := b.commit(ctx, d); err != nil {
		return guardError(err, store.ErrMemoMutationConflict)
	}
	return nil
}
