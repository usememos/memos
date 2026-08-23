package mysql

import (
	"context"
	"database/sql"
	stderrors "errors"

	"github.com/usememos/memos/store"
)

func authorizeMySQLMemoComment(ctx context.Context, tx *sql.Tx, contextMemoID, actorUserID int32) error {
	snapshot, err := loadMySQLMemoParticipation(ctx, tx, contextMemoID, actorUserID)
	if err != nil {
		if stderrors.Is(err, sql.ErrNoRows) || stderrors.Is(err, store.ErrMemoMutationConflict) {
			return store.ErrMemoSpaceNotWritable
		}
		return err
	}
	return store.ValidateMemoCommentAuthorization(snapshot)
}

// loadMySQLMemoParticipation resolves the current actor, Space, membership,
// and memo state shared by comment and reaction participation.
func loadMySQLMemoParticipation(ctx context.Context, tx *sql.Tx, memoID, actorUserID int32) (*store.MemoCommentAuthorizationSnapshot, error) {
	var actorStatus store.RowStatus
	actorErr := tx.QueryRowContext(ctx, "SELECT row_status FROM user WHERE id = ?", actorUserID).Scan(&actorStatus)
	if actorErr != nil && !stderrors.Is(actorErr, sql.ErrNoRows) {
		return nil, actorErr
	}
	snapshot := &store.MemoCommentAuthorizationSnapshot{
		ActorUserID: actorUserID,
		ActorActive: actorErr == nil && actorStatus == store.Normal,
		ContextID:   memoID,
	}
	var contextSpace sql.NullInt64
	err := tx.QueryRowContext(ctx, `SELECT creator_id, row_status, visibility, space_id
		FROM memo WHERE id = ?`, memoID).Scan(
		&snapshot.ContextCreatorID, &snapshot.ContextRowStatus, &snapshot.ContextVisibility, &contextSpace,
	)
	if err != nil {
		return nil, err
	}
	snapshot.ContextSpaceID = store.NullInt32Pointer(contextSpace)
	if snapshot.ContextSpaceID != nil {
		snapshot.ContextSpaceExists, err = mysqlSpaceExists(ctx, tx, *snapshot.ContextSpaceID)
		if err != nil {
			return nil, err
		}
		if snapshot.ContextSpaceExists {
			snapshot.ContextMemberActive, err = mysqlSpaceMemberActive(ctx, tx, *snapshot.ContextSpaceID, actorUserID)
			if err != nil {
				return nil, err
			}
		}
	}
	return snapshot, nil
}
