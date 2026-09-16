package d1

import (
	"context"
	"database/sql"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

// errSpaceDeleteConflict reports that memos or attachments were added to or
// removed from the space between the validation reads and the batch. The
// caller can simply retry.
var errSpaceDeleteConflict = errors.New("space contents changed during deletion")

// spaceValidateDelete checks that the actor is an active administrator of an
// existing space.
func spaceValidateDelete(ctx context.Context, q querier, delete *store.DeleteSpace) error {
	if err := requireActiveUser(ctx, q, delete.ActorUserID, store.ErrSpacePermissionDenied); err != nil {
		return err
	}
	exists, err := spaceExists(ctx, q, delete.ID)
	if err != nil {
		return err
	}
	if !exists {
		return store.ErrSpaceNotFound
	}
	var role store.SpaceMemberRole
	err = q.QueryRowContext(ctx, "SELECT role FROM space_member WHERE space_id = ? AND user_id = ? AND status = 'ACTIVE'", delete.ID, delete.ActorUserID).Scan(&role)
	if errors.Is(err, sql.ErrNoRows) {
		return store.ErrSpacePermissionDenied
	}
	if err != nil {
		return errors.Wrap(err, "failed to read space administrator membership")
	}
	if role != store.SpaceMemberRoleAdmin {
		return store.ErrSpacePermissionDenied
	}
	return nil
}

// DeleteSpace hard-deletes only memos directly placed in the Space. Relations
// are removed when either endpoint is deleted, but are never traversed.
func (d *DB) DeleteSpace(ctx context.Context, delete *store.DeleteSpace) (*store.DeleteSpaceResult, error) {
	validate := func() error { return spaceValidateDelete(ctx, d.db, delete) }
	if err := validate(); err != nil {
		return nil, err
	}
	memoIDs, err := listMemoIDs(ctx, d.db, "SELECT id FROM memo WHERE space_id = ? ORDER BY id", delete.ID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to collect assigned memos")
	}
	attachments, err := listMemoSetAttachments(ctx, d.db, memoIDs)
	if err != nil {
		return nil, errors.Wrap(err, "failed to collect memo attachments")
	}

	b := newBatch()
	b.guard(activeUserCondition, delete.ActorUserID)
	b.guard("EXISTS (SELECT 1 FROM space WHERE id = ?)", delete.ID)
	b.guard("EXISTS (SELECT 1 FROM space_member WHERE space_id = ? AND user_id = ? AND status = 'ACTIVE' AND role = 'ADMIN')", delete.ID, delete.ActorUserID)
	// The memo set was read outside the batch; abort when it changed so no
	// memo or attachment is left pointing at a deleted space.
	b.guardIDSet("memo WHERE space_id = ?", []any{delete.ID}, memoIDs)
	b.guardIDSet("attachment WHERE memo_id IN (SELECT id FROM memo WHERE space_id = ?)", []any{delete.ID}, attachmentIDs(attachments))
	addMemoSetDeletes(b, memoIDs, attachmentIDs(attachments))
	b.add("DELETE FROM space_member WHERE space_id = ?", delete.ID)
	b.add("DELETE FROM space WHERE id = ?", delete.ID)
	if _, err := b.commit(ctx, d); err != nil {
		if isGuardFailure(err) {
			return nil, spaceRecheck(validate, errSpaceDeleteConflict)
		}
		return nil, errors.Wrap(err, "failed to delete space")
	}
	return &store.DeleteSpaceResult{Attachments: attachments}, nil
}
