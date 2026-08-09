package postgres

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
	if err := tx.QueryRowContext(ctx, `SELECT creator_id, content FROM memo WHERE id = $1 FOR UPDATE`, mutation.MemoID).Scan(&creatorID, &content); err != nil {
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
		if err := tx.QueryRowContext(ctx, `SELECT creator_id, memo_id FROM attachment WHERE id = $1 FOR UPDATE`, binding.ID).Scan(&attachmentCreatorID, &memoID); err != nil {
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
		if _, err := tx.ExecContext(ctx, `UPDATE attachment SET memo_id = $1, updated_ts = $2 WHERE id = $3`, mutation.MemoID, binding.UpdatedTs, binding.ID); err != nil {
			return errors.Wrap(err, "failed to bind attachment")
		}
	}

	for _, attachmentID := range mutation.RemovedAttachmentIDs {
		result, err := tx.ExecContext(ctx, `UPDATE attachment SET memo_id = NULL WHERE id = $1 AND memo_id = $2`, attachmentID, mutation.MemoID)
		if err != nil {
			return errors.Wrap(err, "failed to detach attachment")
		}
		if rows, err := result.RowsAffected(); err != nil || rows != 1 {
			return errors.Wrap(store.ErrMemoAttachmentConflict, "attachment is no longer bound to the memo")
		}
	}

	for _, attachmentID := range mutation.RequiredAttachmentIDs {
		var exists int
		if err := tx.QueryRowContext(ctx, `SELECT 1 FROM attachment WHERE id = $1 AND memo_id = $2 FOR UPDATE`, attachmentID, mutation.MemoID).Scan(&exists); err != nil {
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
	appendValue := func(column string, value any) {
		args = append(args, value)
		set = append(set, column+" = "+placeholder(len(args)))
	}
	if v := update.UID; v != nil {
		appendValue("uid", *v)
	}
	if v := update.CreatedTs; v != nil {
		appendValue("created_ts", *v)
	}
	if v := update.UpdatedTs; v != nil {
		appendValue("updated_ts", *v)
	}
	if v := update.RowStatus; v != nil {
		appendValue("row_status", *v)
	}
	if v := update.Content; v != nil {
		appendValue("content", *v)
	}
	if v := update.Visibility; v != nil {
		appendValue("visibility", *v)
	}
	if v := update.Pinned; v != nil {
		appendValue("pinned", *v)
	}
	if v := update.Payload; v != nil {
		payload, err := protojson.Marshal(v)
		if err != nil {
			return errors.Wrap(err, "failed to marshal memo payload")
		}
		appendValue("payload", string(payload))
	}
	if len(set) == 0 {
		return nil
	}
	args = append(args, update.ID)
	if _, err := executor.ExecContext(ctx, "UPDATE memo SET "+strings.Join(set, ", ")+" WHERE id = "+placeholder(len(args)), args...); err != nil {
		return errors.Wrap(err, "failed to update memo")
	}
	return nil
}
