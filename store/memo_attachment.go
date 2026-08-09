package store

import (
	"context"
	"errors"
)

// ErrMemoMutationConflict indicates that memo or attachment state changed
// after an API request prepared its mutation.
var ErrMemoMutationConflict = errors.New("memo state changed")

// MemoAttachmentBinding describes one attachment that should be bound to a
// memo. WasBoundToMemo distinguishes an existing binding from a new one so the
// driver can reject ownership transfers while preserving legacy rows already
// attached to the memo.
type MemoAttachmentBinding struct {
	ID             int32
	UID            string
	UpdatedTs      int64
	WasBoundToMemo bool
}

// MemoMutation atomically updates a memo, its attachment bindings, and its
// reference relations. Removed attachment rows are detached in the transaction
// and are deleted from storage separately, so a storage failure remains
// retriable.
type MemoMutation struct {
	MemoID                    int32
	MemoCreatorID             int32
	ExpectedMemoContent       string
	MemoUpdate                *UpdateMemo
	Bindings                  []*MemoAttachmentBinding
	RemovedAttachmentIDs      []int32
	RequiredAttachmentIDs     []int32
	ReplaceReferenceRelations bool
	ReferenceRelations        []*MemoRelation
}

// ApplyMemoMutation atomically applies memo fields, attachment bindings, and
// reference relations after rechecking the state used by API validation.
func (s *Store) ApplyMemoMutation(ctx context.Context, mutation *MemoMutation) error {
	if mutation == nil {
		return errors.New("memo mutation is required")
	}
	return s.driver.ApplyMemoMutation(ctx, mutation)
}
