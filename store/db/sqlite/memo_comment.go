package sqlite

import (
	"context"
	"database/sql"
	stderrors "errors"

	"github.com/usememos/memos/store"
)

func authorizeSQLiteMemoComment(ctx context.Context, tx dbExecutor, contextMemoID, actorUserID int32) error {
	snapshot, err := loadSQLiteMemoParticipation(ctx, tx, contextMemoID, actorUserID)
	if err != nil {
		if stderrors.Is(err, sql.ErrNoRows) {
			return store.ErrMemoSpaceNotWritable
		}
		return err
	}
	return store.ValidateMemoCommentAuthorization(snapshot)
}

// loadSQLiteMemoParticipation resolves the current actor, Space, membership,
// and memo state shared by comment and reaction participation.
func loadSQLiteMemoParticipation(ctx context.Context, tx dbExecutor, memoID, actorUserID int32) (*store.MemoCommentAuthorizationSnapshot, error) {
	snapshot := &store.MemoCommentAuthorizationSnapshot{ActorUserID: actorUserID, ContextID: memoID}
	var actorStatus store.RowStatus
	if err := tx.QueryRowContext(ctx, "SELECT row_status FROM user WHERE id = ?", actorUserID).Scan(&actorStatus); err != nil {
		if stderrors.Is(err, sql.ErrNoRows) {
			return nil, store.ErrMemoPermissionDenied
		}
		return nil, err
	}
	snapshot.ActorActive = actorStatus == store.Normal

	var contextSpace sql.NullInt64
	err := tx.QueryRowContext(ctx, `SELECT creator_id, row_status, visibility, space_id FROM memo WHERE id = ?`, memoID).Scan(
		&snapshot.ContextCreatorID, &snapshot.ContextRowStatus, &snapshot.ContextVisibility, &contextSpace,
	)
	if err != nil {
		return nil, err
	}
	snapshot.ContextSpaceID = store.NullInt32Pointer(contextSpace)

	if snapshot.ContextSpaceID != nil {
		var exists bool
		if err := tx.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM space WHERE id = ?)", *snapshot.ContextSpaceID).Scan(&exists); err == nil {
			snapshot.ContextSpaceExists = exists
		} else if !stderrors.Is(err, sql.ErrNoRows) {
			return nil, err
		}
		if snapshot.ContextMemberActive, err = sqliteSpaceMemberActive(ctx, tx, *snapshot.ContextSpaceID, actorUserID); err != nil {
			return nil, err
		}
	}
	return snapshot, nil
}
