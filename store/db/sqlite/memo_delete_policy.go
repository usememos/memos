package sqlite

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

	actor, err := requireSQLiteActiveMemoActor(ctx, tx, delete.ActorUserID)
	if err != nil {
		return nil, err
	}
	var creatorID int32
	var rowStatus store.RowStatus
	var visibility store.Visibility
	var space sql.NullInt64
	if err := tx.QueryRowContext(ctx, "SELECT creator_id, row_status, visibility, space_id FROM memo WHERE id = ?", delete.MemoID).Scan(
		&creatorID, &rowStatus, &visibility, &space,
	); errors.Is(err, sql.ErrNoRows) {
		return nil, store.ErrMemoMutationConflict
	} else if err != nil {
		return nil, errors.Wrap(err, "failed to read memo")
	} else if creatorID != delete.ActorUserID && !actor.Admin {
		return nil, store.ErrMemoPermissionDenied
	}
	spaceID := store.NullInt32Pointer(space)
	spaceExists := false
	actorMember := false
	if spaceID != nil {
		var existingSpaceID int32
		if err := tx.QueryRowContext(ctx, "SELECT id FROM space WHERE id = ?", *spaceID).Scan(&existingSpaceID); err == nil {
			spaceExists = true
		} else if !errors.Is(err, sql.ErrNoRows) {
			return nil, errors.Wrap(err, "failed to read memo space")
		}
		if spaceExists && !actor.Admin {
			actorMember, err = sqliteSpaceMemberActive(ctx, tx, *spaceID, delete.ActorUserID)
			if err != nil {
				return nil, errors.Wrap(err, "failed to read memo membership")
			}
		}
	}
	actorCanRead := store.MemoDeleteActorCanRead(rowStatus, visibility, spaceID, spaceExists, actorMember || actor.Admin)

	deleteIDs, err := listSQLiteCommentSubtreeMemoIDs(ctx, tx, delete.MemoID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to collect comment memos")
	}
	attachments, err := deleteSQLiteMemoSetTx(ctx, tx, deleteIDs)
	if err != nil {
		return nil, errors.Wrap(err, "failed to delete memo set")
	}
	if err := tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "failed to commit memo delete transaction")
	}
	return &store.DeleteMemoWithPolicyResult{ActorCanRead: actorCanRead, Attachments: attachments}, nil
}

// listSQLiteCommentSubtreeMemoIDs returns the target memo plus every memo in
// its comment subtree (comments, replies to comments, and so on), following
// COMMENT relations from parent to child.
func listSQLiteCommentSubtreeMemoIDs(ctx context.Context, tx dbExecutor, rootMemoID int32) ([]int32, error) {
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
