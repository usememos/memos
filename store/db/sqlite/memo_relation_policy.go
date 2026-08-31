package sqlite

import (
	"context"
	"database/sql"
	stderrors "errors"
	"slices"

	"github.com/usememos/memos/store"
)

type sqliteRelationMemoState struct {
	id         int32
	creatorID  int32
	rowStatus  store.RowStatus
	visibility store.Visibility
	spaceID    *int32
}

func validateSQLiteMemoRelationEndpoints(ctx context.Context, executor dbExecutor, mutation *store.MemoMutation) error {
	if !mutation.ReplaceReferenceRelations && mutation.CommentContextMemoID == nil {
		return nil
	}

	var actorStatus store.RowStatus
	if err := executor.QueryRowContext(ctx, "SELECT row_status FROM user WHERE id = ?", mutation.MemoCreatorID).Scan(&actorStatus); err != nil {
		if stderrors.Is(err, sql.ErrNoRows) {
			return store.ErrMemoPermissionDenied
		}
		return err
	}

	endpointIDs := sqliteRelationAuthorizationEndpointIDs(mutation)
	for _, endpointID := range endpointIDs {
		state, err := getSQLiteRelationMemoState(ctx, executor, endpointID)
		if err != nil {
			if stderrors.Is(err, sql.ErrNoRows) {
				return store.ErrMemoMutationConflict
			}
			return err
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
			if err := executor.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM space WHERE id = ?)", *state.spaceID).Scan(&snapshot.EndpointSpaceExists); err != nil {
				return err
			}
			if snapshot.EndpointSpaceExists {
				active, err := sqliteSpaceMemberActive(ctx, executor, *state.spaceID, mutation.MemoCreatorID)
				if err != nil {
					return err
				}
				snapshot.EndpointMemberActive = active
			}
		}
		if err := store.ValidateMemoRelationEndpointRead(snapshot); err != nil {
			return err
		}
	}
	return nil
}

func getSQLiteRelationMemoState(ctx context.Context, executor dbExecutor, memoID int32) (*sqliteRelationMemoState, error) {
	state := &sqliteRelationMemoState{}
	var spaceID sql.NullInt64
	if err := executor.QueryRowContext(ctx, `SELECT id, creator_id, row_status, visibility, space_id
		FROM memo WHERE id = ?`, memoID).Scan(
		&state.id, &state.creatorID, &state.rowStatus, &state.visibility, &spaceID,
	); err != nil {
		return nil, err
	}
	state.spaceID = store.NullInt32Pointer(spaceID)
	return state, nil
}

func sqliteRelationAuthorizationEndpointIDs(mutation *store.MemoMutation) []int32 {
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
