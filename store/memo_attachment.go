package store

import (
	"context"
	"errors"
	"slices"
)

// ErrMemoMutationConflict indicates that memo or attachment state changed
// after an API request prepared its mutation.
var ErrMemoMutationConflict = errors.New("memo state changed")

// MemoAttachmentBinding describes one attachment that should be bound to a
// memo. WasBoundToMemo distinguishes an existing binding from a new one so the
// driver can reject ownership transfers while preserving legacy rows already
// attached to the memo. A new binding must be owned by the memo author, or by
// the acting instance administrator.
type MemoAttachmentBinding struct {
	ID             int32
	UID            string
	UpdatedTs      int64
	WasBoundToMemo bool
}

// MemoMutation atomically updates a memo, its attachment bindings, and its
// reference relations. Removed attachment rows are deleted in the same
// transaction; callers may clean up external objects after the commit.
type MemoMutation struct {
	// MemoCreate requests that the memo row be created in this same transaction
	// before attachments and relations are applied. CommentContextMemoID creates
	// one immutable COMMENT relation from the new memo to the named context memo.
	MemoCreate                *Memo
	CommentContextMemoID      *int32
	MemoID                    int32
	MemoCreatorID             int32
	ExpectedMemoContent       string
	MemoUpdate                *UpdateMemo
	Bindings                  []*MemoAttachmentBinding
	RemovedAttachmentIDs      []int32
	RequiredAttachmentIDs     []int32
	ReplaceReferenceRelations bool
	ReferenceRelations        []*MemoRelation
	Policy                    *MemoWritePolicy
}

// MemoAttachmentBindingOwnerAllowed reports whether an unbound attachment may
// be bound to a memo: it must be owned by the memo author, or by the acting
// instance administrator. Ownership is never transferred between accounts.
func MemoAttachmentBindingOwnerAllowed(attachmentCreatorID, memoCreatorID, actorUserID int32, actorIsAdmin bool) bool {
	if attachmentCreatorID == memoCreatorID {
		return true
	}
	return actorIsAdmin && attachmentCreatorID == actorUserID
}

// MemoAttachmentRemovalAllowed reports whether an attachment may be removed
// from a memo. Removal deletes the attachment, so it must be bound to that
// memo and owned by the actor unless the actor is an instance administrator.
func MemoAttachmentRemovalAllowed(attachment *Attachment, memoID, actorUserID int32, actorIsAdmin bool) bool {
	if attachment == nil || attachment.MemoID == nil || *attachment.MemoID != memoID {
		return false
	}
	return actorIsAdmin || attachment.CreatorID == actorUserID
}

// WritePolicy returns the transport-facing policy governing the mutation, if
// any: the mutation's own policy, else the one carried by its memo update.
func (m *MemoMutation) WritePolicy() *MemoWritePolicy {
	if m.Policy != nil {
		return m.Policy
	}
	if m.MemoUpdate != nil {
		return m.MemoUpdate.Policy
	}
	return nil
}

// ActorUserID returns the user performing the mutation. Transport-facing
// updates carry the actor in their policy, which may differ from the memo
// author when an instance administrator acts; creations act as the author.
func (m *MemoMutation) ActorUserID() int32 {
	if policy := m.WritePolicy(); policy != nil {
		return policy.ActorUserID
	}
	return m.MemoCreatorID
}

// ApplyMemoMutation atomically applies memo fields, attachment bindings, and
// reference relations after rechecking the state used by API validation.
func (s *Store) ApplyMemoMutation(ctx context.Context, mutation *MemoMutation) error {
	if mutation == nil {
		return errors.New("memo mutation is required")
	}
	if mutation.MemoCreate != nil {
		if mutation.MemoUpdate != nil || mutation.Policy != nil || len(mutation.RemovedAttachmentIDs) != 0 {
			return errors.New("memo creation mutation cannot update or remove existing state")
		}
		create := mutation.MemoCreate
		if create.CreatorID <= 0 {
			return errors.New("memo creation mutation requires creator")
		}
		if err := validateMemoCreate(create); err != nil {
			return err
		}
		if mutation.CommentContextMemoID != nil && *mutation.CommentContextMemoID <= 0 {
			return errors.New("comment creation mutation requires a valid context memo")
		}
		mutation.MemoCreatorID = create.CreatorID
		mutation.ExpectedMemoContent = create.Content
	}
	if err := validateMemoWritePolicy(mutation.Policy); err != nil {
		return err
	}
	mutation.RemovedAttachmentIDs = slices.Clone(mutation.RemovedAttachmentIDs)
	slices.Sort(mutation.RemovedAttachmentIDs)
	removedAttachmentIDs := make(map[int32]struct{}, len(mutation.RemovedAttachmentIDs))
	for index, attachmentID := range mutation.RemovedAttachmentIDs {
		if attachmentID <= 0 {
			return errors.New("removed attachment IDs must be positive")
		}
		if index > 0 && mutation.RemovedAttachmentIDs[index-1] == attachmentID {
			return errors.New("duplicate removed attachment ID")
		}
		removedAttachmentIDs[attachmentID] = struct{}{}
	}
	for _, binding := range mutation.Bindings {
		if binding != nil {
			if _, removed := removedAttachmentIDs[binding.ID]; removed {
				return errors.New("attachment cannot be both bound and removed")
			}
		}
	}
	for _, attachmentID := range mutation.RequiredAttachmentIDs {
		if _, removed := removedAttachmentIDs[attachmentID]; removed {
			return errors.New("attachment cannot be both required and removed")
		}
	}
	if mutation.Policy != nil && mutation.Policy.LifecycleOnly &&
		(len(mutation.Bindings) != 0 || len(mutation.RemovedAttachmentIDs) != 0 || len(mutation.RequiredAttachmentIDs) != 0 || mutation.ReplaceReferenceRelations) {
		return ErrMemoSpaceMembershipRequired
	}
	if mutation.ReplaceReferenceRelations {
		if mutation.MemoCreatorID <= 0 {
			return errors.New("reference relation mutation requires an actor")
		}
		seenRelatedMemoIDs := make(map[int32]struct{}, len(mutation.ReferenceRelations))
		for _, relation := range mutation.ReferenceRelations {
			if relation == nil || relation.RelatedMemoID <= 0 || relation.Type != MemoRelationReference {
				return errors.New("only REFERENCE memo relations may be mutated")
			}
			if mutation.MemoCreate == nil && relation.MemoID != mutation.MemoID {
				return errors.New("reference relation source does not match memo mutation")
			}
			if mutation.MemoID > 0 && relation.RelatedMemoID == mutation.MemoID {
				return errors.New("reflexive memo relations are not allowed")
			}
			if _, ok := seenRelatedMemoIDs[relation.RelatedMemoID]; ok {
				return errors.New("duplicate memo reference relation")
			}
			seenRelatedMemoIDs[relation.RelatedMemoID] = struct{}{}
		}
	}
	return s.driver.ApplyMemoMutation(ctx, mutation)
}
