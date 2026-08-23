package store

import (
	"context"
	"maps"
	"slices"

	"github.com/pkg/errors"
)

// AttachmentDeletionPolicy captures the caller and the memo content observed
// while validating a transport-facing attachment deletion. Drivers compare the
// snapshots with current memo state in the deletion transaction.
type AttachmentDeletionPolicy struct {
	ActorUserID          int32
	ExpectedMemoContents map[int32]string
}

// DeleteAttachmentsWithPolicy atomically authorizes and removes the selected
// attachment rows. External object cleanup remains the caller's responsibility
// after the transaction commits.
func (s *Store) DeleteAttachmentsWithPolicy(ctx context.Context, policy *AttachmentDeletionPolicy, attachmentIDs []int32) error {
	normalizedPolicy, normalizedIDs, err := normalizeAttachmentDelete(policy, attachmentIDs)
	if err != nil {
		return err
	}
	return s.driver.DeleteAttachmentsWithPolicy(ctx, normalizedPolicy, normalizedIDs)
}

func normalizeAttachmentDelete(policy *AttachmentDeletionPolicy, attachmentIDs []int32) (*AttachmentDeletionPolicy, []int32, error) {
	if policy == nil || policy.ActorUserID <= 0 || len(attachmentIDs) == 0 {
		return nil, nil, errors.New("attachment deletion requires policy and attachment IDs")
	}
	ids := slices.Clone(attachmentIDs)
	slices.Sort(ids)
	for index, id := range ids {
		if id <= 0 {
			return nil, nil, errors.New("attachment deletion IDs must be positive")
		}
		if index > 0 && ids[index-1] == id {
			return nil, nil, errors.New("duplicate attachment deletion ID")
		}
	}
	expectedMemoContents := maps.Clone(policy.ExpectedMemoContents)
	for memoID := range expectedMemoContents {
		if memoID <= 0 {
			return nil, nil, errors.New("attachment deletion memo IDs must be positive")
		}
	}
	return &AttachmentDeletionPolicy{
		ActorUserID:          policy.ActorUserID,
		ExpectedMemoContents: expectedMemoContents,
	}, ids, nil
}

// ValidateAttachmentDeletionMemoSnapshots requires exactly one expected
// content snapshot for every memo currently bound to the selected attachments.
func ValidateAttachmentDeletionMemoSnapshots(memoIDs []int32, expectedMemoContents map[int32]string) error {
	if len(memoIDs) != len(expectedMemoContents) {
		return ErrMemoMutationConflict
	}
	for _, memoID := range memoIDs {
		if _, ok := expectedMemoContents[memoID]; !ok {
			return ErrMemoMutationConflict
		}
	}
	return nil
}

// ValidateAttachmentMutationTargets verifies attachment rows used by a
// transport-facing mutation and returns their distinct memo bindings in
// ascending order.
func ValidateAttachmentMutationTargets(actorUserID int32, attachmentIDs []int32, attachments []*Attachment) ([]int32, error) {
	if actorUserID <= 0 || len(attachmentIDs) == 0 || len(attachments) != len(attachmentIDs) {
		return nil, ErrMemoMutationConflict
	}
	expectedIDs := make(map[int32]struct{}, len(attachmentIDs))
	for _, id := range attachmentIDs {
		if id <= 0 {
			return nil, ErrMemoMutationConflict
		}
		expectedIDs[id] = struct{}{}
	}
	memoIDs := make(map[int32]struct{})
	seen := make(map[int32]struct{}, len(attachments))
	for _, attachment := range attachments {
		if attachment == nil || attachment.ID <= 0 {
			return nil, ErrMemoMutationConflict
		}
		if _, expected := expectedIDs[attachment.ID]; !expected {
			return nil, ErrMemoMutationConflict
		}
		if _, duplicate := seen[attachment.ID]; duplicate {
			return nil, ErrMemoMutationConflict
		}
		seen[attachment.ID] = struct{}{}
		if attachment.CreatorID != actorUserID {
			return nil, ErrMemoPermissionDenied
		}
		if attachment.MemoID != nil {
			if *attachment.MemoID <= 0 {
				return nil, ErrMemoMutationConflict
			}
			memoIDs[*attachment.MemoID] = struct{}{}
		}
	}
	result := make([]int32, 0, len(memoIDs))
	for memoID := range memoIDs {
		result = append(result, memoID)
	}
	slices.Sort(result)
	return result, nil
}
