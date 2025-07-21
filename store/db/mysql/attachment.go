package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (d *DB) CreateAttachment(ctx context.Context, create *store.Attachment) (*store.Attachment, error) {
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
			return nil, errors.Wrap(err, "failed to marshal attachment payload")
		}
		payloadString = string(bytes)
	}
	args := []any{create.UID, create.Filename, create.Blob, create.Type, create.Size, create.CreatorID, create.MemoID, storageType, create.Reference, payloadString}

	stmt := "INSERT INTO `resource` (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(placeholder, ", ") + ")"
	result, err := d.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	id32 := int32(id)
	return d.GetAttachment(ctx, &store.FindAttachment{ID: &id32})
}

func (d *DB) ListAttachments(ctx context.Context, find *store.FindAttachment) ([]*store.Attachment, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.ID; v != nil {
		where, args = append(where, "`id` = ?"), append(args, *v)
	}
	if v := find.UID; v != nil {
		where, args = append(where, "`uid` = ?"), append(args, *v)
	}
	if v := find.CreatorID; v != nil {
		where, args = append(where, "`creator_id` = ?"), append(args, *v)
	}
	if v := find.Filename; v != nil {
		where, args = append(where, "`filename` = ?"), append(args, *v)
	}
	if v := find.FilenameSearch; v != nil {
		where, args = append(where, "`filename` LIKE ?"), append(args, "%"+*v+"%")
	}
	if v := find.MemoID; v != nil {
		where, args = append(where, "`memo_id` = ?"), append(args, *v)
	}
	if find.HasRelatedMemo {
		where = append(where, "`memo_id` IS NOT NULL")
	}
	if find.StorageType != nil {
		where, args = append(where, "`storage_type` = ?"), append(args, find.StorageType.String())
	}

	fields := []string{"`id`", "`uid`", "`filename`", "`type`", "`size`", "`creator_id`", "UNIX_TIMESTAMP(`created_ts`)", "UNIX_TIMESTAMP(`updated_ts`)", "`memo_id`", "`storage_type`", "`reference`", "`payload`"}
	if find.GetBlob {
		fields = append(fields, "`blob`")
	}

	query := fmt.Sprintf("SELECT %s FROM `resource` WHERE %s ORDER BY `updated_ts` DESC", strings.Join(fields, ", "), strings.Join(where, " AND "))
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
	if v := update.Reference; v != nil {
		set, args = append(set, "`reference` = ?"), append(args, *v)
	}
	if v := update.Payload; v != nil {
		bytes, err := protojson.Marshal(v)
		if err != nil {
			return errors.Wrap(err, "failed to marshal attachment payload")
		}
		set, args = append(set, "`payload` = ?"), append(args, string(bytes))
	}

	args = append(args, update.ID)
	stmt := "UPDATE `resource` SET " + strings.Join(set, ", ") + " WHERE `id` = ?"
	result, err := d.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return err
	}
	if _, err := result.RowsAffected(); err != nil {
		return err
	}
	return nil
}

func (d *DB) DeleteAttachment(ctx context.Context, delete *store.DeleteAttachment) error {
	stmt := "DELETE FROM `resource` WHERE `id` = ?"
	result, err := d.db.ExecContext(ctx, stmt, delete.ID)
	if err != nil {
		return err
	}
	if _, err := result.RowsAffected(); err != nil {
		return err
	}

	return nil
}
