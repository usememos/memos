package mysql

import (
	"context"
	"database/sql"
	stderrors "errors"

	"github.com/usememos/memos/store"
)

type mysqlRelationMemoState struct {
	id         int32
	creatorID  int32
	rowStatus  store.RowStatus
	visibility store.Visibility
	spaceID    *int32
}

func validateMySQLMemoRelationEndpoints(ctx context.Context, tx *sql.Tx, mutation *store.MemoMutation) error {
	if !mutation.ReplaceReferenceRelations && mutation.CommentContextMemoID == nil {
		return nil
	}

	var actorStatus store.RowStatus
	actorErr := tx.QueryRowContext(ctx, "SELECT row_status FROM user WHERE id = ?", mutation.MemoCreatorID).Scan(&actorStatus)
	if actorErr != nil && !stderrors.Is(actorErr, sql.ErrNoRows) {
		return actorErr
	}
	actorActive := actorErr == nil && actorStatus == store.Normal

	endpointIDs := mysqlRelationAuthorizationEndpointIDs(mutation)
	for _, endpointID := range endpointIDs {
		state, err := getMySQLRelationMemoState(ctx, tx, endpointID)
		if err != nil {
			if stderrors.Is(err, sql.ErrNoRows) {
				return store.ErrMemoMutationConflict
			}
			return err
		}
		snapshot := &store.MemoRelationEndpointSnapshot{
			ActorUserID:        mutation.MemoCreatorID,
			ActorActive:        actorActive,
			EndpointID:         state.id,
			EndpointCreatorID:  state.creatorID,
			EndpointRowStatus:  state.rowStatus,
			EndpointVisibility: state.visibility,
			EndpointSpaceID:    state.spaceID,
		}
		if state.spaceID != nil {
			snapshot.EndpointSpaceExists, err = mysqlSpaceExists(ctx, tx, *state.spaceID)
			if err != nil {
				return err
			}
			if snapshot.EndpointSpaceExists {
				snapshot.EndpointMemberActive, err = mysqlSpaceMemberActive(ctx, tx, *state.spaceID, mutation.MemoCreatorID)
				if err != nil {
					return err
				}
			}
		}
		if err := store.ValidateMemoRelationEndpointRead(snapshot); err != nil {
			return err
		}
	}
	return nil
}

func getMySQLRelationMemoState(ctx context.Context, tx *sql.Tx, memoID int32) (*mysqlRelationMemoState, error) {
	state := &mysqlRelationMemoState{}
	var spaceID sql.NullInt64
	if err := tx.QueryRowContext(ctx, `SELECT id, creator_id, row_status, visibility, space_id FROM memo WHERE id = ?`, memoID).Scan(
		&state.id, &state.creatorID, &state.rowStatus, &state.visibility, &spaceID,
	); err != nil {
		return nil, err
	}
	state.spaceID = store.NullInt32Pointer(spaceID)
	return state, nil
}

func mysqlRelationAuthorizationEndpointIDs(mutation *store.MemoMutation) []int32 {
	ids := make([]int32, 0, len(mutation.ReferenceRelations)+1)
	seen := make(map[int32]struct{}, len(mutation.ReferenceRelations)+1)
	add := func(id int32) {
		if _, ok := seen[id]; ok {
			return
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	if mutation.MemoCreate == nil && mutation.MemoID > 0 {
		add(mutation.MemoID)
	} else if mutation.CommentContextMemoID != nil {
		add(*mutation.CommentContextMemoID)
	}
	for _, relation := range mutation.ReferenceRelations {
		if relation != nil {
			add(relation.RelatedMemoID)
		}
	}
	return ids
}
