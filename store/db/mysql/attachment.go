package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"

	"github.com/usememos/memos/plugin/filter"
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

	for _, filterStr := range find.Filters {
		// Parse filter string and return the parsed expression.
		// The filter string should be a CEL expression.
		parsedExpr, err := filter.Parse(filterStr, filter.AttachmentFilterCELAttributes...)
		if err != nil {
			return nil, err
		}
		convertCtx := filter.NewConvertContext()
		// ConvertExprToSQL converts the parsed expression to a SQL condition string.
		converter := filter.NewCommonSQLConverter(&filter.MySQLDialect{})
		if err := converter.ConvertExprToSQL(convertCtx, parsedExpr.GetExpr()); err != nil {
			return nil, err
		}
		condition := convertCtx.Buffer.String()
		if condition != "" {
			where = append(where, fmt.Sprintf("(%s)", condition))
			args = append(args, convertCtx.Args...)
		}
	}

	if v := find.ID; v != nil {
		where, args = append(where, "`resource`.`id` = ?"), append(args, *v)
	}
	if v := find.UID; v != nil {
		where, args = append(where, "`resource`.`uid` = ?"), append(args, *v)
	}
	if v := find.CreatorID; v != nil {
		where, args = append(where, "`resource`.`creator_id` = ?"), append(args, *v)
	}
	if v := find.Filename; v != nil {
		where, args = append(where, "`resource`.`filename` = ?"), append(args, *v)
	}
	if v := find.FilenameSearch; v != nil {
		where, args = append(where, "`resource`.`filename` LIKE ?"), append(args, "%"+*v+"%")
	}
	if v := find.MemoID; v != nil {
		where, args = append(where, "`resource`.`memo_id` = ?"), append(args, *v)
	}
	if find.HasRelatedMemo {
		where = append(where, "`resource`.`memo_id` IS NOT NULL")
	}
	if find.StorageType != nil {
		where, args = append(where, "`resource`.`storage_type` = ?"), append(args, find.StorageType.String())
	}

	fields := []string{
		"`resource`.`id` AS `id`",
		"`resource`.`uid` AS `uid`",
		"`resource`.`filename` AS `filename`",
		"`resource`.`type` AS `type`",
		"`resource`.`size` AS `size`",
		"`resource`.`creator_id` AS `creator_id`",
		"UNIX_TIMESTAMP(`resource`.`created_ts`) AS `created_ts`",
		"UNIX_TIMESTAMP(`resource`.`updated_ts`) AS `updated_ts`",
		"`resource`.`memo_id` AS `memo_id`",
		"`resource`.`storage_type` AS `storage_type`",
		"`resource`.`reference` AS `reference`",
		"`resource`.`payload` AS `payload`",
		"CASE WHEN `memo`.`uid` IS NOT NULL THEN `memo`.`uid` ELSE NULL END AS `memo_uid`",
	}
	if find.GetBlob {
		fields = append(fields, "`resource`.`blob` AS `blob`")
	}

	query := "SELECT " + strings.Join(fields, ", ") + " FROM `resource`" + " " +
		"LEFT JOIN `memo` ON `resource`.`memo_id` = `memo`.`id`" + " " +
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
