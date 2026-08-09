package store

import (
	"context"
	"errors"
)

// ErrMemoAttachmentConflict indicates that memo or attachment state changed
// after an API request prepared its mutation.
var ErrMemoAttachmentConflict = errors.New("memo attachment state changed")

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

// MemoAttachmentMutation atomically updates a memo and its attachment
// bindings. Removed attachment rows are detached in the transaction and are
// deleted from storage separately, so a storage failure remains retriable.
type MemoAttachmentMutation struct {
	MemoID                int32
	MemoCreatorID         int32
	ExpectedMemoContent   string
	MemoUpdate            *UpdateMemo
	Bindings              []*MemoAttachmentBinding
	RemovedAttachmentIDs  []int32
	RequiredAttachmentIDs []int32
}

// ApplyMemoAttachmentMutation atomically applies memo fields and attachment
// binding changes after rechecking the state used by API validation.
func (s *Store) ApplyMemoAttachmentMutation(ctx context.Context, mutation *MemoAttachmentMutation) error {
	if mutation == nil {
		return errors.New("memo attachment mutation is required")
	}
	return s.driver.ApplyMemoAttachmentMutation(ctx, mutation)
}
