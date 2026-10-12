package mysql

import (
	"context"
	"database/sql"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func (d *DB) DeleteMemoWithPolicy(ctx context.Context, delete *store.DeleteMemoWithPolicy) (*store.DeleteMemoWithPolicyResult, error) {
	// Later subtree and attachment reads must see writers that committed before
	// their memo locks became available.
	tx, err := d.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return nil, errors.Wrap(err, "failed to begin memo delete transaction")
	}
	defer func() { _ = tx.Rollback() }()

	actor, err := requireMySQLActiveMemoActor(ctx, tx, delete.ActorUserID)
	if err != nil {
		return nil, err
	}

	var creatorID int32
	var rowStatus store.RowStatus
	var visibility store.Visibility
	var space sql.NullInt64
	if err := tx.QueryRowContext(ctx, "SELECT creator_id, row_status, visibility, space_id FROM memo WHERE id = ? FOR UPDATE", delete.MemoID).Scan(
		&creatorID, &rowStatus, &visibility, &space,
	); errors.Is(err, sql.ErrNoRows) {
		return nil, store.ErrMemoMutationConflict
	} else if err != nil {
		return nil, errors.Wrap(err, "failed to read memo")
	}
	if creatorID != delete.ActorUserID && !actor.Admin {
		return nil, store.ErrMemoPermissionDenied
	}
	spaceID := store.NullInt32Pointer(space)
	spaceExists := false
	actorMember := false
	if spaceID != nil {
		spaceExists, err = mysqlSpaceExists(ctx, tx, *spaceID)
		if err != nil {
			return nil, errors.Wrap(err, "failed to read memo space")
		}
	}
	if spaceID != nil && spaceExists && !actor.Admin {
		actorMember, err = mysqlSpaceMemberActive(ctx, tx, *spaceID, delete.ActorUserID)
		if err != nil {
			return nil, errors.Wrap(err, "failed to read memo membership")
		}
	}
	actorCanRead := store.MemoDeleteActorCanRead(rowStatus, visibility, spaceID, spaceExists, actorMember || actor.Admin)

	deleteIDs, err := listMySQLCommentSubtreeMemoIDs(ctx, tx, delete.MemoID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to collect comment memos")
	}
	attachments, err := deleteMySQLMemoSetTx(ctx, tx, deleteIDs)
	if err != nil {
		return nil, errors.Wrap(err, "failed to delete memo set")
	}
	if err := tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "failed to commit memo delete transaction")
	}
	return &store.DeleteMemoWithPolicyResult{ActorCanRead: actorCanRead, Attachments: attachments}, nil
}

// listMySQLCommentSubtreeMemoIDs returns the target memo plus every memo in
// its comment subtree (comments, replies to comments, and so on), following
// COMMENT relations from parent to child.
func listMySQLCommentSubtreeMemoIDs(ctx context.Context, tx *sql.Tx, rootMemoID int32) ([]int32, error) {
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
					next = append(next, childID)
				}
				return errors.Wrap(rows.Err(), "failed to list comment memos")
			}(); err != nil {
				return nil, err
			}
		}
		// Comment creation takes the same memo locks before adding replies.
		locked, err := lockMySQLCommentMemoIDs(ctx, tx, next)
		if err != nil {
			return nil, err
		}
		ids = append(ids, locked...)
		frontier = locked
	}
	return ids, nil
}

func lockMySQLCommentMemoIDs(ctx context.Context, tx *sql.Tx, ids []int32) ([]int32, error) {
	locked := make([]int32, 0, len(ids))
	for _, batch := range deleteUserBatches(ids, deleteUserBatchSize) {
		clause, args := deleteUserInClause(1, batch)
		if err := func() error {
			rows, err := tx.QueryContext(ctx, "SELECT id FROM memo WHERE id IN "+clause+" ORDER BY id FOR UPDATE", args...)
			if err != nil {
				return err
			}
			defer rows.Close()
			for rows.Next() {
				var id int32
				if err := rows.Scan(&id); err != nil {
					return err
				}
				locked = append(locked, id)
			}
			return rows.Err()
		}(); err != nil {
			return nil, errors.Wrap(err, "failed to lock comment memos")
		}
	}
	return locked, nil
}
