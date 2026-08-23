package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"

	"github.com/usememos/memos/internal/filter"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (d *DB) CreateAttachment(ctx context.Context, create *store.Attachment) (*store.Attachment, error) {
	if create.Policy == nil {
		id, err := insertMySQLAttachment(ctx, d.db, create)
		if err != nil {
			return nil, err
		}
		return d.GetAttachment(ctx, &store.FindAttachment{ID: &id})
	}
	if create.MemoID == nil || create.CreatorID != create.Policy.ActorUserID {
		return nil, store.ErrMemoPermissionDenied
	}
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()
	if err := validateMySQLMemoWritePolicy(ctx, tx, *create.MemoID, create.Policy, nil); err != nil {
		return nil, err
	}
	id, err := insertMySQLAttachment(ctx, tx, create)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return d.GetAttachment(ctx, &store.FindAttachment{ID: &id})
}

func insertMySQLAttachment(ctx context.Context, executor memoUpdateExecer, create *store.Attachment) (int32, error) {
	fields := []string{"`uid`", "`filename`", "`blob`", "`type`", "`size`", "`creator_id`", "`memo_id`", "`storage_type`", "`reference`", "`payload`"}
	placeholder := []string{"?", "?", "?", "?", "?", "?", "?", "?", "?", "?"}
	storageType := ""
	if create.StorageType != storepb.AttachmentStorageType_ATTACHMENT_STORAGE_TYPE_UNSPECIFIED {
		storageType = create.StorageType.String()
	}
	payloadString := "{}"
	if create.Payload != nil {
		bytes, err := protojson.Marshal(create.Payload)
		if err != nil {
			return 0, errors.Wrap(err, "failed to marshal attachment payload")
		}
		payloadString = string(bytes)
	}
	args := []any{create.UID, create.Filename, create.Blob, create.Type, create.Size, create.CreatorID, create.MemoID, storageType, create.Reference, payloadString}

	stmt := "INSERT INTO `attachment` (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(placeholder, ", ") + ")"
	result, err := executor.ExecContext(ctx, stmt, args...)
	if err != nil {
		return 0, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}
	return int32(id), nil
}

func (d *DB) ListAttachments(ctx context.Context, find *store.FindAttachment) ([]*store.Attachment, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.ID; v != nil {
		where, args = append(where, "`attachment`.`id` = ?"), append(args, *v)
	}
	if v := find.UID; v != nil {
		where, args = append(where, "`attachment`.`uid` = ?"), append(args, *v)
	}
	if v := find.CreatorID; v != nil {
		where, args = append(where, "`attachment`.`creator_id` = ?"), append(args, *v)
	}
	if v := find.Filename; v != nil {
		where, args = append(where, "`attachment`.`filename` = ?"), append(args, *v)
	}
	if v := find.FilenameSearch; v != nil {
		where, args = append(where, "`attachment`.`filename` LIKE ?"), append(args, "%"+*v+"%")
	}
	if v := find.MemoID; v != nil {
		where, args = append(where, "`attachment`.`memo_id` = ?"), append(args, *v)
	}
	if len(find.MemoIDList) > 0 {
		placeholders := make([]string, 0, len(find.MemoIDList))
		for range find.MemoIDList {
			placeholders = append(placeholders, "?")
		}
		where = append(where, "`attachment`.`memo_id` IN ("+strings.Join(placeholders, ",")+")")
		for _, id := range find.MemoIDList {
			args = append(args, id)
		}
	}
	if find.HasRelatedMemo {
		where = append(where, "`attachment`.`memo_id` IS NOT NULL")
	}
	if len(find.Filters) > 0 {
		engine, err := filter.DefaultAttachmentEngine()
		if err != nil {
			return nil, errors.Wrap(err, "failed to get filter engine")
		}
		if err := filter.AppendConditions(ctx, engine, find.Filters, filter.DialectMySQL, &where, &args); err != nil {
			return nil, errors.Wrap(err, "failed to append filter conditions")
		}
	}
	if access := find.Access; access != nil {
		scopeClauses := []string{}
		if access.UserID != nil {
			scopeClauses = append(scopeClauses, "(`attachment`.`memo_id` IS NULL AND EXISTS (SELECT 1 FROM `user` AS `attachment_user` WHERE `attachment_user`.`id` = ? AND `attachment_user`.`row_status` = 'NORMAL') AND `attachment`.`creator_id` = ?)")
			args = append(args, *access.UserID, *access.UserID)
		}
		scopeClauses = append(scopeClauses, "(`attachment`.`memo_id` IS NOT NULL AND "+mysqlMemoAccessPredicate(access, "`memo`", "`attachment_member`", &args)+")")
		if len(scopeClauses) == 0 {
			where = append(where, "1 = 0")
		} else {
			where = append(where, "("+strings.Join(scopeClauses, " OR ")+")")
		}
	}

	fields := []string{
		"`attachment`.`id` AS `id`",
		"`attachment`.`uid` AS `uid`",
		"`attachment`.`filename` AS `filename`",
		"`attachment`.`type` AS `type`",
		"`attachment`.`size` AS `size`",
		"`attachment`.`creator_id` AS `creator_id`",
		"UNIX_TIMESTAMP(`attachment`.`created_ts`) AS `created_ts`",
		"UNIX_TIMESTAMP(`attachment`.`updated_ts`) AS `updated_ts`",
		"`attachment`.`memo_id` AS `memo_id`",
		"`attachment`.`storage_type` AS `storage_type`",
		"`attachment`.`reference` AS `reference`",
		"`attachment`.`payload` AS `payload`",
		"CASE WHEN `memo`.`uid` IS NOT NULL THEN `memo`.`uid` ELSE NULL END AS `memo_uid`",
	}
	if find.GetBlob {
		fields = append(fields, "`attachment`.`blob` AS `blob`")
	}

	query := "SELECT " + strings.Join(fields, ", ") + " FROM `attachment`" + " " +
		"LEFT JOIN `memo` ON `attachment`.`memo_id` = `memo`.`id`" + " " +
		"WHERE " + strings.Join(where, " AND ") + " " +
		"ORDER BY `updated_ts` DESC"
	if find.Limit != nil {
		query = fmt.Sprintf("%s LIMIT %d", query, *find.Limit)
		if find.Offset != nil {
			query = fmt.Sprintf("%s OFFSET %d", query, *find.Offset)
		}
	}

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]*store.Attachment, 0)
	for rows.Next() {
		attachment := store.Attachment{}
		var memoID sql.NullInt32
		var storageType string
		var payloadBytes []byte
		dests := []any{
			&attachment.ID,
			&attachment.UID,
			&attachment.Filename,
			&attachment.Type,
			&attachment.Size,
			&attachment.CreatorID,
			&attachment.CreatedTs,
			&attachment.UpdatedTs,
			&memoID,
			&storageType,
			&attachment.Reference,
			&payloadBytes,
			&attachment.MemoUID,
		}
		if find.GetBlob {
			dests = append(dests, &attachment.Blob)
		}
		if err := rows.Scan(dests...); err != nil {
			return nil, err
		}

		if memoID.Valid {
			attachment.MemoID = &memoID.Int32
		}
		attachment.StorageType = storepb.AttachmentStorageType(storepb.AttachmentStorageType_value[storageType])
		payload := &storepb.AttachmentPayload{}
		if err := protojsonUnmarshaler.Unmarshal(payloadBytes, payload); err != nil {
			return nil, err
		}
		attachment.Payload = payload
		list = append(list, &attachment)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (d *DB) GetAttachment(ctx context.Context, find *store.FindAttachment) (*store.Attachment, error) {
	list, err := d.ListAttachments(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}

	return list[0], nil
}

func (d *DB) UpdateAttachment(ctx context.Context, update *store.UpdateAttachment) error {
	if update.Policy == nil {
		return applyMySQLAttachmentUpdate(ctx, d.db, update)
	}
	if update.MemoID != nil {
		return store.ErrMemoMutationConflict
	}
	attachmentIDs := []int32{update.ID}
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	attachments, err := listMySQLAttachmentsByIDs(ctx, tx, attachmentIDs)
	if err != nil {
		return err
	}
	memoIDs, err := store.ValidateAttachmentMutationTargets(update.Policy.ActorUserID, attachmentIDs, attachments)
	if err != nil {
		return err
	}
	if err := authorizeMySQLAttachmentMutation(ctx, tx, update.Policy.ActorUserID, memoIDs, nil); err != nil {
		return err
	}
	if err := applyMySQLAttachmentUpdate(ctx, tx, update); err != nil {
		return err
	}
	return tx.Commit()
}

func applyMySQLAttachmentUpdate(ctx context.Context, executor memoUpdateExecer, update *store.UpdateAttachment) error {
	set, args := []string{}, []any{}

	if v := update.UID; v != nil {
		set, args = append(set, "`uid` = ?"), append(args, *v)
	}
	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "`updated_ts` = FROM_UNIXTIME(?)"), append(args, *v)
	}
	if v := update.Filename; v != nil {
		set, args = append(set, "`filename` = ?"), append(args, *v)
	}
	if v := update.MemoID; v != nil {
		set, args = append(set, "`memo_id` = ?"), append(args, *v)
	}
	if v := update.Payload; v != nil {
		bytes, err := protojson.Marshal(v)
		if err != nil {
			return errors.Wrap(err, "failed to marshal attachment payload")
		}
		set, args = append(set, "`payload` = ?"), append(args, string(bytes))
	}

	if len(set) == 0 {
		return nil
	}
	args = append(args, update.ID)
	stmt := "UPDATE `attachment` SET " + strings.Join(set, ", ") + " WHERE `id` = ?"
	result, err := executor.ExecContext(ctx, stmt, args...)
	if err != nil {
		return err
	}
	if _, err := result.RowsAffected(); err != nil {
		return err
	}
	return nil
}

func (d *DB) DeleteAttachment(ctx context.Context, delete *store.DeleteAttachment) error {
	return d.DeleteAttachments(ctx, []*store.DeleteAttachment{delete})
}

func (d *DB) DeleteAttachments(ctx context.Context, deletes []*store.DeleteAttachment) error {
	if len(deletes) == 0 {
		return nil
	}

	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return errors.Wrap(err, "failed to start attachment delete transaction")
	}
	defer func() { _ = tx.Rollback() }()

	stmt := "DELETE FROM `attachment` WHERE `id` = ?"
	for _, delete := range deletes {
		if delete == nil {
			continue
		}
		result, err := tx.ExecContext(ctx, stmt, delete.ID)
		if err != nil {
			return err
		}
		if _, err := result.RowsAffected(); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func listMySQLAttachmentsByIDs(ctx context.Context, tx *sql.Tx, attachmentIDs []int32) ([]*store.Attachment, error) {
	attachments := make([]*store.Attachment, 0, len(attachmentIDs))
	seen := make(map[int32]struct{}, len(attachmentIDs))
	for _, batch := range deleteUserBatches(attachmentIDs, deleteUserBatchSize) {
		clause, args := deleteUserInClause(1, batch)
		if err := appendDeleteUserAttachments(ctx, tx, `SELECT id, uid, creator_id, memo_id, storage_type, reference, payload
			FROM attachment WHERE id IN `+clause+` ORDER BY id`, args, seen, &attachments); err != nil {
			return nil, err
		}
	}
	return attachments, nil
}
