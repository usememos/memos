package store

import (
	"context"

	"github.com/pkg/errors"
)

// DeleteMemoWithPolicy identifies one memo to delete atomically on behalf of
// its author or an instance administrator. The memo's comment subtree
// (comments and their nested replies) is deleted with it; other relations do
// not confer lifecycle authority.
type DeleteMemoWithPolicy struct {
	MemoID      int32
	ActorUserID int32
}

// DeleteMemoWithPolicyResult contains authorization state captured by the
// deletion transaction.
type DeleteMemoWithPolicyResult struct {
	ActorCanRead bool
	Attachments  []*Attachment
}

// MemoDeleteActorCanRead applies the memo-local audience matrix after the
// deletion transaction has established that the actor is the active author or
// an instance administrator, who counts as a member everywhere. Invalid
// lifecycle or audience state fails closed. Placement validity matters only
// for the Space audience; it is not an extra read gate for other values.
func MemoDeleteActorCanRead(rowStatus RowStatus, visibility Visibility, spaceID *int32, spaceExists, actorMember bool) bool {
	if rowStatus != Normal && rowStatus != Archived {
		return false
	}
	switch visibility {
	case Public, Protected, Private:
		return true
	case SpaceAudience:
		return spaceID != nil && spaceExists && actorMember
	default:
		return false
	}
}

// DeleteMemoWithPolicy atomically deletes one memo, its whole comment
// subtree, their owned database resources, and relations for which any of
// them is an endpoint.
func (s *Store) DeleteMemoWithPolicy(ctx context.Context, delete *DeleteMemoWithPolicy) (*DeleteMemoWithPolicyResult, error) {
	if delete == nil || delete.MemoID <= 0 || delete.ActorUserID <= 0 {
		return nil, errors.New("memo deletion requires memo and actor")
	}
	result, err := s.driver.DeleteMemoWithPolicy(ctx, delete)
	if err != nil {
		return nil, err
	}
	if result == nil {
		return nil, errors.New("unexpected nil memo deletion result")
	}
	return result, nil
}
