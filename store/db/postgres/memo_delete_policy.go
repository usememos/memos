package postgres

import (
	"context"
	"database/sql"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func (d *DB) DeleteMemoWithPolicy(ctx context.Context, delete *store.DeleteMemoWithPolicy) (*store.DeleteMemoWithPolicyResult, error) {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, errors.Wrap(err, "failed to begin memo delete transaction")
	}
	defer func() { _ = tx.Rollback() }()

	actor, err := requirePostgresActiveMemoActor(ctx, tx, delete.ActorUserID)
	if err != nil {
		return nil, err
	}

	var creatorID int32
	var rowStatus store.RowStatus
	var visibility store.Visibility
	var memoSpace sql.NullInt64
	if err := tx.QueryRowContext(ctx, `SELECT creator_id, row_status, visibility, space_id FROM memo WHERE id = $1`, delete.MemoID).Scan(
		&creatorID, &rowStatus, &visibility, &memoSpace,
	); errors.Is(err, sql.ErrNoRows) {
		return nil, store.ErrMemoMutationConflict
	} else if err != nil {
		return nil, errors.Wrap(err, "failed to read memo")
	}
	if creatorID != delete.ActorUserID && !actor.Admin {
		return nil, store.ErrMemoPermissionDenied
	}
	memoSpaceID := store.NullInt32Pointer(memoSpace)
	spaceExists, actorMember := false, false
	if memoSpaceID != nil {
		spaceExists, actorMember, err = readPostgresMemoSpaceState(ctx, tx, *memoSpaceID, delete.ActorUserID)
		if err != nil {
			return nil, errors.Wrap(err, "failed to read memo space state")
		}
	}
	actorCanRead := store.MemoDeleteActorCanRead(rowStatus, visibility, memoSpaceID, spaceExists, actorMember || actor.Admin)

	deleteIDs, err := listPostgresCommentSubtreeMemoIDs(ctx, tx, delete.MemoID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to collect comment memos")
	}
	attachments, err := deletePostgresMemoSetTx(ctx, tx, deleteIDs)
	if err != nil {
		return nil, errors.Wrap(err, "failed to delete memo set")
	}
	if err := tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "failed to commit memo delete transaction")
	}
	return &store.DeleteMemoWithPolicyResult{ActorCanRead: actorCanRead, Attachments: attachments}, nil
}

// listPostgresCommentSubtreeMemoIDs returns the target memo plus every memo
// in its comment subtree (comments, replies to comments, and so on),
// following COMMENT relations from parent to child.
func listPostgresCommentSubtreeMemoIDs(ctx context.Context, tx *sql.Tx, rootMemoID int32) ([]int32, error) {
	ids := []int32{rootMemoID}
	seen := map[int32]struct{}{rootMemoID: {}}
	frontier := []int32{rootMemoID}
	for len(frontier) > 0 {
		var next []int32
		for _, batch := range deleteUserBatches(frontier, deleteUserBatchSize) {
			clause, args := deleteUserInClause(1, batch)
			if err := func() error {
				rows, err := tx.QueryContext(ctx, "SELECT memo_id FROM memo_relation WHERE type = 'COMMENT' AND related_memo_id IN "+clause, args...)
				if err != nil {
					return errors.Wrap(err, "failed to list comment memos")
				}
				defer rows.Close()
				for rows.Next() {
					var childID int32
					if err := rows.Scan(&childID); err != nil {
						return errors.Wrap(err, "failed to read comment memo id")
					}
					if _, ok := seen[childID]; ok {
						continue
					}
					seen[childID] = struct{}{}
					ids = append(ids, childID)
					next = append(next, childID)
				}
				return errors.Wrap(rows.Err(), "failed to list comment memos")
			}(); err != nil {
				return nil, err
			}
		}
		frontier = next
	}
	return ids, nil
}
