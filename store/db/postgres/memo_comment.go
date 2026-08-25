package postgres

import (
	"context"
	"database/sql"
	stderrors "errors"

	"github.com/usememos/memos/store"
)

func authorizePostgresMemoComment(ctx context.Context, tx *sql.Tx, contextMemoID, actorUserID int32) error {
	snapshot, err := readPostgresMemoParticipation(ctx, tx, contextMemoID, actorUserID)
	if err != nil {
		if stderrors.Is(err, sql.ErrNoRows) || stderrors.Is(err, store.ErrMemoMutationConflict) {
			return store.ErrMemoSpaceNotWritable
		}
		return err
	}
	return store.ValidateMemoCommentAuthorization(snapshot)
}

// readPostgresMemoParticipation resolves the current actor, Space, membership,
// and memo state shared by comment and reaction participation.
func readPostgresMemoParticipation(ctx context.Context, tx *sql.Tx, memoID, actorUserID int32) (*store.MemoCommentAuthorizationSnapshot, error) {
	userStatuses, err := readPostgresUserStatuses(ctx, tx, actorUserID)
	if err != nil {
		return nil, err
	}

	snapshot := &store.MemoCommentAuthorizationSnapshot{
		ActorUserID: actorUserID,
		ActorActive: userStatuses[actorUserID] == store.Normal,
		ContextID:   memoID,
	}
	var contextSpace sql.NullInt64
	err = tx.QueryRowContext(ctx, `SELECT creator_id, row_status, visibility, space_id
		FROM memo WHERE id = $1`, memoID).Scan(
		&snapshot.ContextCreatorID, &snapshot.ContextRowStatus, &snapshot.ContextVisibility, &contextSpace,
	)
	if err != nil {
		return nil, err
	}
	snapshot.ContextSpaceID = store.NullInt32Pointer(contextSpace)
	if snapshot.ContextSpaceID != nil {
		if err := tx.QueryRowContext(ctx, `SELECT
			EXISTS(SELECT 1 FROM space WHERE id = $1),
			EXISTS(SELECT 1 FROM space_member WHERE space_id = $1 AND user_id = $2
				AND status = 'ACTIVE' AND role IN ('ADMIN', 'USER'))`,
			*snapshot.ContextSpaceID, actorUserID).Scan(&snapshot.ContextSpaceExists, &snapshot.ContextMemberActive); err != nil {
			return nil, err
		}
	}
	return snapshot, nil
}
