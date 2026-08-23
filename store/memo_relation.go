package store

import (
	"context"
	"errors"
)

type MemoRelationType string

const (
	// MemoRelationReference is the type for a reference memo relation.
	MemoRelationReference MemoRelationType = "REFERENCE"
	// MemoRelationComment is the type for a comment memo relation.
	MemoRelationComment MemoRelationType = "COMMENT"
)

type MemoRelation struct {
	MemoID        int32
	RelatedMemoID int32
	Type          MemoRelationType
}

// MemoRelationEndpointSnapshot is the memo-local database state used to
// authorize one endpoint during a reference-relation mutation.
type MemoRelationEndpointSnapshot struct {
	ActorUserID int32
	ActorActive bool

	EndpointID         int32
	EndpointCreatorID  int32
	EndpointRowStatus  RowStatus
	EndpointVisibility Visibility
	EndpointSpaceID    *int32

	EndpointSpaceExists  bool
	EndpointMemberActive bool
}

// ValidateMemoRelationEndpointRead applies authenticated memo-local read
// policy to an endpoint. Application roles are deliberately absent: an
// instance administrator has no relation-specific read bypass.
func ValidateMemoRelationEndpointRead(snapshot *MemoRelationEndpointSnapshot) error {
	if snapshot == nil || !snapshot.ActorActive {
		return ErrMemoPermissionDenied
	}
	if snapshot.EndpointID <= 0 {
		return ErrMemoMutationConflict
	}
	if snapshot.EndpointRowStatus != Normal && snapshot.EndpointRowStatus != Archived {
		return ErrMemoMutationConflict
	}
	if snapshot.EndpointRowStatus == Archived && snapshot.EndpointCreatorID != snapshot.ActorUserID {
		return ErrMemoPermissionDenied
	}
	if !isValidVisibility(snapshot.EndpointVisibility) {
		return ErrMemoMutationConflict
	}
	if snapshot.EndpointVisibility == SpaceAudience &&
		(snapshot.EndpointSpaceID == nil || !snapshot.EndpointSpaceExists) {
		return ErrMemoMutationConflict
	}

	switch snapshot.EndpointVisibility {
	case Public, Protected:
		return nil
	case Private:
		if snapshot.EndpointCreatorID != snapshot.ActorUserID {
			return ErrMemoPermissionDenied
		}
		return nil
	case SpaceAudience:
		if !snapshot.EndpointMemberActive {
			return ErrMemoPermissionDenied
		}
		return nil
	default:
		return ErrMemoMutationConflict
	}
}

type FindMemoRelation struct {
	MemoID        *int32
	RelatedMemoID *int32
	Type          *MemoRelationType
	MemoFilter    *string
	// SourceMemoRowStatus filters the relation source memo before pagination.
	SourceMemoRowStatus *RowStatus
	// MemoIDList matches relations where memo_id OR related_memo_id is in the list.
	MemoIDList []int32
	// SourceMemoIDList matches relations where memo_id is in the list.
	SourceMemoIDList []int32
	// RelatedMemoIDList matches relations where related_memo_id is in the list.
	RelatedMemoIDList []int32
	Limit             *int
	Offset            *int
}

type DeleteMemoRelation struct {
	MemoID        *int32
	RelatedMemoID *int32
	Type          *MemoRelationType
}

// ValidateMemoRelationDelete ensures the generic deletion path can only
// mutate reference relations. COMMENT relations are immutable context and are
// removed only as part of the lifecycle of an incident memo.
func ValidateMemoRelationDelete(delete *DeleteMemoRelation) error {
	if delete == nil {
		return errors.New("memo relation deletion is required")
	}
	if delete.Type == nil || *delete.Type != MemoRelationReference {
		return errors.New("only REFERENCE memo relations may be deleted")
	}
	if delete.MemoID == nil && delete.RelatedMemoID == nil {
		return errors.New("memo relation deletion requires an endpoint")
	}
	if (delete.MemoID != nil && *delete.MemoID <= 0) || (delete.RelatedMemoID != nil && *delete.RelatedMemoID <= 0) {
		return errors.New("memo relation deletion has an invalid endpoint")
	}
	return nil
}

func (s *Store) UpsertMemoRelation(ctx context.Context, create *MemoRelation) (*MemoRelation, error) {
	if create == nil || create.Type != MemoRelationReference {
		return nil, errors.New("only REFERENCE memo relations may be persisted")
	}
	return s.driver.UpsertMemoRelation(ctx, create)
}

func (s *Store) ListMemoRelations(ctx context.Context, find *FindMemoRelation) ([]*MemoRelation, error) {
	return s.driver.ListMemoRelations(ctx, find)
}

func (s *Store) DeleteMemoRelation(ctx context.Context, delete *DeleteMemoRelation) error {
	if err := ValidateMemoRelationDelete(delete); err != nil {
		return err
	}
	return s.driver.DeleteMemoRelation(ctx, delete)
}
