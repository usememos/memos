package d1

import (
	"context"
	"database/sql"
	"slices"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

// memoValidateRelationEndpoints authorizes every memo a mutation links to:
// the comment context or the mutated memo itself, plus each referenced memo.
// It returns the endpoint states so the batch can re-assert them.
func memoValidateRelationEndpoints(ctx context.Context, q querier, mutation *store.MemoMutation) ([]*memoState, error) {
	if !mutation.ReplaceReferenceRelations && mutation.CommentContextMemoID == nil {
		return nil, nil
	}

	var actorStatus store.RowStatus
	err := q.QueryRowContext(ctx, "SELECT row_status FROM user WHERE id = ?", mutation.MemoCreatorID).Scan(&actorStatus)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, store.ErrMemoPermissionDenied
	}
	if err != nil {
		return nil, err
	}

	endpointIDs := memoRelationEndpointIDs(mutation)
	endpoints := make([]*memoState, 0, len(endpointIDs))
	for _, endpointID := range endpointIDs {
		state, err := loadMemoState(ctx, q, endpointID)
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.ErrMemoMutationConflict
		}
		if err != nil {
			return nil, err
		}
		snapshot := &store.MemoRelationEndpointSnapshot{
			ActorUserID:        mutation.MemoCreatorID,
			ActorActive:        actorStatus == store.Normal,
			EndpointID:         state.id,
			EndpointCreatorID:  state.creatorID,
			EndpointRowStatus:  state.rowStatus,
			EndpointVisibility: state.visibility,
			EndpointSpaceID:    state.spaceID,
		}
		if state.spaceID != nil {
			exists, member, err := spaceState(ctx, q, *state.spaceID, mutation.MemoCreatorID)
			if err != nil {
				return nil, err
			}
			snapshot.EndpointSpaceExists = exists
			snapshot.EndpointMemberActive = member
		}
		if err := store.ValidateMemoRelationEndpointRead(snapshot); err != nil {
			return nil, err
		}
		endpoints = append(endpoints, state)
	}
	return endpoints, nil
}

// memoGuardRelationEndpoints re-asserts inside the batch that each endpoint
// still has the state that passed memoValidateRelationEndpoints. Membership is
// only part of the read policy for the SPACE audience.
func memoGuardRelationEndpoints(b *batch, actorUserID int32, endpoints []*memoState) {
	for _, endpoint := range endpoints {
		condition, args := endpoint.unchangedCondition()
		b.guard(condition, args...)
		if endpoint.visibility == store.SpaceAudience && endpoint.spaceID != nil {
			b.guard(activeSpaceMemberCondition, *endpoint.spaceID, actorUserID)
		}
	}
}

// memoRelationEndpointIDs lists the distinct memos whose read authorization
// the mutation depends on, in ascending order.
func memoRelationEndpointIDs(mutation *store.MemoMutation) []int32 {
	unique := make(map[int32]struct{}, len(mutation.ReferenceRelations)+1)
	if mutation.MemoCreate == nil && mutation.MemoID > 0 {
		unique[mutation.MemoID] = struct{}{}
	} else if mutation.CommentContextMemoID != nil {
		unique[*mutation.CommentContextMemoID] = struct{}{}
	}
	for _, relation := range mutation.ReferenceRelations {
		if relation != nil {
			unique[relation.RelatedMemoID] = struct{}{}
		}
	}
	ids := make([]int32, 0, len(unique))
	for id := range unique {
		ids = append(ids, id)
	}
	slices.Sort(ids)
	return ids
}
