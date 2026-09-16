package d1

import (
	"context"
	"database/sql"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

// DeleteMemoWithPolicy removes a memo on behalf of an actor together with its shares, reactions, attachments, and relations.
func (d *DB) DeleteMemoWithPolicy(ctx context.Context, delete *store.DeleteMemoWithPolicy) (*store.DeleteMemoWithPolicyResult, error) {
	if err := requireActiveUser(ctx, d.db, delete.ActorUserID, store.ErrMemoPermissionDenied); err != nil {
		return nil, err
	}
	state, err := loadMemoState(ctx, d.db, delete.MemoID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, store.ErrMemoMutationConflict
	}
	if err != nil {
		return nil, errors.Wrap(err, "failed to read memo")
	}
	if state.creatorID != delete.ActorUserID {
		return nil, store.ErrMemoPermissionDenied
	}
	spaceExists, actorMember := false, false
	if state.spaceID != nil {
		spaceExists, actorMember, err = spaceState(ctx, d.db, *state.spaceID, delete.ActorUserID)
		if err != nil {
			return nil, errors.Wrap(err, "failed to read memo space")
		}
	}
	actorCanRead := store.MemoDeleteActorCanRead(state.rowStatus, state.visibility, state.spaceID, spaceExists, actorMember)

	memoIDs := []int32{delete.MemoID}
	attachments, err := listMemoSetAttachments(ctx, d.db, memoIDs)
	if err != nil {
		return nil, errors.Wrap(err, "failed to collect memo attachments")
	}

	b := newBatch()
	b.guard(activeUserCondition, delete.ActorUserID)
	b.guard("EXISTS (SELECT 1 FROM memo WHERE id = ? AND creator_id = ?)", delete.MemoID, delete.ActorUserID)
	// The attachments were listed before the batch and are returned for
	// storage cleanup; abort if the bound set changed so none is orphaned in
	// the database or missed by the caller.
	b.guardIDSet("attachment WHERE memo_id = ?", []any{delete.MemoID}, attachmentIDs(attachments))
	addMemoSetDeletes(b, memoIDs, attachmentIDs(attachments))
	if _, err := b.commit(ctx, d); err != nil {
		return nil, guardError(err, errors.Wrap(store.ErrMemoMutationConflict, "memo changed while deleting"))
	}
	return &store.DeleteMemoWithPolicyResult{ActorCanRead: actorCanRead, Attachments: attachments}, nil
}
