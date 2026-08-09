package sqlite

import (
	"context"
	"database/sql"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"

	"github.com/usememos/memos/store"
)

// ApplyMemoAttachmentMutation atomically updates a memo and its attachment bindings.
func (d *DB) ApplyMemoAttachmentMutation(ctx context.Context, mutation *store.MemoAttachmentMutation) error {
	tx, err := d.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return errors.Wrap(err, "failed to begin memo attachment transaction")
	}
	defer func() {
		_ = tx.Rollback()
	}()

	var creatorID int32
	var content string
	if err := tx.QueryRowContext(ctx, `SELECT creator_id, content FROM memo WHERE id = ?`, mutation.MemoID).Scan(&creatorID, &content); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.Wrap(store.ErrMemoAttachmentConflict, "memo no longer exists")
		}
		return errors.Wrap(err, "failed to lock memo")
	}
	if creatorID != mutation.MemoCreatorID || content != mutation.ExpectedMemoContent {
		return errors.Wrap(store.ErrMemoAttachmentConflict, "memo changed while updating attachments")
	}

	for _, binding := range mutation.Bindings {
		var attachmentCreatorID int32
		var memoID sql.NullInt32
		if err := tx.QueryRowContext(ctx, `SELECT creator_id, memo_id FROM attachment WHERE id = ?`, binding.ID).Scan(&attachmentCreatorID, &memoID); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return errors.Wrapf(store.ErrMemoAttachmentConflict, "attachment %s no longer exists", binding.UID)
			}
			return errors.Wrap(err, "failed to lock attachment")
		}
		if binding.WasBoundToMemo {
			if !memoID.Valid || memoID.Int32 != mutation.MemoID {
				return errors.Wrapf(store.ErrMemoAttachmentConflict, "attachment %s is no longer bound to the memo", binding.UID)
			}
		} else if attachmentCreatorID != mutation.MemoCreatorID || memoID.Valid {
			return errors.Wrapf(store.ErrMemoAttachmentConflict, "attachment %s is no longer available", binding.UID)
		}
		if _, err := tx.ExecContext(ctx, `UPDATE attachment SET memo_id = ?, updated_ts = ? WHERE id = ?`, mutation.MemoID, binding.UpdatedTs, binding.ID); err != nil {
			return errors.Wrap(err, "failed to bind attachment")
		}
	}

	for _, attachmentID := range mutation.RemovedAttachmentIDs {
		result, err := tx.ExecContext(ctx, `UPDATE attachment SET memo_id = NULL WHERE id = ? AND memo_id = ?`, attachmentID, mutation.MemoID)
		if err != nil {
			return errors.Wrap(err, "failed to detach attachment")
		}
		if rows, err := result.RowsAffected(); err != nil || rows != 1 {
			return errors.Wrap(store.ErrMemoAttachmentConflict, "attachment is no longer bound to the memo")
		}
	}

	for _, attachmentID := range mutation.RequiredAttachmentIDs {
		var exists int
		if err := tx.QueryRowContext(ctx, `SELECT 1 FROM attachment WHERE id = ? AND memo_id = ?`, attachmentID, mutation.MemoID).Scan(&exists); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return errors.Wrap(store.ErrMemoAttachmentConflict, "a referenced attachment is no longer bound to the memo")
			}
			return errors.Wrap(err, "failed to verify referenced attachment")
		}
	}

	if mutation.MemoUpdate != nil {
		if mutation.MemoUpdate.ID != mutation.MemoID {
			return errors.New("memo update target does not match attachment mutation")
		}
		if err := applyMemoUpdate(ctx, tx, mutation.MemoUpdate); err != nil {
			return err
		}
	}
	if err := tx.Commit(); err != nil {
		return errors.Wrap(err, "failed to commit memo attachment transaction")
	}
	return nil
}

type memoUpdateExecer interface {
	ExecContext(context.Context, string, ...any) (sql.Result, error)
}

func applyMemoUpdate(ctx context.Context, executor memoUpdateExecer, update *store.UpdateMemo) error {
	set, args := []string{}, []any{}
	if v := update.UID; v != nil {
		set, args = append(set, "`uid` = ?"), append(args, *v)
	}
	if v := update.CreatedTs; v != nil {
		set, args = append(set, "`created_ts` = ?"), append(args, *v)
	}
	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "`updated_ts` = ?"), append(args, *v)
	}
	if v := update.RowStatus; v != nil {
		set, args = append(set, "`row_status` = ?"), append(args, *v)
	}
	if v := update.Content; v != nil {
		set, args = append(set, "`content` = ?"), append(args, *v)
	}
	if v := update.Visibility; v != nil {
		set, args = append(set, "`visibility` = ?"), append(args, *v)
	}
	if v := update.Pinned; v != nil {
		set, args = append(set, "`pinned` = ?"), append(args, *v)
	}
	if v := update.Payload; v != nil {
		payload, err := protojson.Marshal(v)
		if err != nil {
			return errors.Wrap(err, "failed to marshal memo payload")
		}
		set, args = append(set, "`payload` = ?"), append(args, string(payload))
	}
	if len(set) == 0 {
		return nil
	}
	args = append(args, update.ID)
	if _, err := executor.ExecContext(ctx, "UPDATE `memo` SET "+strings.Join(set, ", ")+" WHERE `id` = ?", args...); err != nil {
		return errors.Wrap(err, "failed to update memo")
	}
	return nil
}
