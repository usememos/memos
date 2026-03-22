package postgres

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
	fields := []string{"uid", "filename", "blob", "type", "size", "creator_id", "memo_id", "storage_type", "reference", "payload"}
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

	stmt := "INSERT INTO attachment (" + strings.Join(fields, ", ") + ") VALUES (" + placeholders(len(args)) + ") RETURNING id, created_ts, updated_ts"
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(&create.ID, &create.CreatedTs, &create.UpdatedTs); err != nil {
		return nil, err
	}
	return create, nil
}

func (d *DB) ListAttachments(ctx context.Context, find *store.FindAttachment) ([]*store.Attachment, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.ID; v != nil {
		where, args = append(where, "attachment.id = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.UID; v != nil {
		where, args = append(where, "attachment.uid = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.CreatorID; v != nil {
		where, args = append(where, "attachment.creator_id = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.Filename; v != nil {
		where, args = append(where, "attachment.filename = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.FilenameSearch; v != nil {
		where, args = append(where, "attachment.filename LIKE "+placeholder(len(args)+1)), append(args, fmt.Sprintf("%%%s%%", *v))
	}
	if v := find.MemoID; v != nil {
		where, args = append(where, "attachment.memo_id = "+placeholder(len(args)+1)), append(args, *v)
	}
	if len(find.MemoIDList) > 0 {
		holders := make([]string, 0, len(find.MemoIDList))
		for _, id := range find.MemoIDList {
			holders = append(holders, placeholder(len(args)+1))
			args = append(args, id)
		}
		where = append(where, "attachment.memo_id IN ("+strings.Join(holders, ", ")+")")
	}
	if find.HasRelatedMemo {
		where = append(where, "attachment.memo_id IS NOT NULL")
	}
	if v := find.StorageType; v != nil {
		where, args = append(where, "attachment.storage_type = "+placeholder(len(args)+1)), append(args, v.String())
	}

	if len(find.Filters) > 0 {
		engine, err := filter.DefaultAttachmentEngine()
		if err != nil {
			return nil, errors.Wrap(err, "failed to get filter engine")
		}
		if err := filter.AppendConditions(ctx, engine, find.Filters, filter.DialectPostgres, &where, &args); err != nil {
			return nil, errors.Wrap(err, "failed to append filter conditions")
		}
	}

	fields := []string{
		"attachment.id AS id",
		"attachment.uid AS uid",
		"attachment.filename AS filename",
		"attachment.type AS type",
		"attachment.size AS size",
		"attachment.creator_id AS creator_id",
		"attachment.created_ts AS created_ts",
		"attachment.updated_ts AS updated_ts",
		"attachment.memo_id AS memo_id",
		"attachment.storage_type AS storage_type",
		"attachment.reference AS reference",
		"attachment.payload AS payload",
		"CASE WHEN memo.uid IS NOT NULL THEN memo.uid ELSE NULL END AS memo_uid",
	}
	if find.GetBlob {
		fields = append(fields, "attachment.blob AS blob")
	}

	query := fmt.Sprintf(`
		SELECT
			%s
		FROM attachment
		LEFT JOIN memo ON attachment.memo_id = memo.id
		WHERE %s
		ORDER BY attachment.updated_ts DESC
	`, strings.Join(fields, ", "), strings.Join(where, " AND "))
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

func (d *DB) UpdateAttachment(ctx context.Context, update *store.UpdateAttachment) error {
	set, args := []string{}, []any{}

	if v := update.UID; v != nil {
		set, args = append(set, "uid = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "updated_ts = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.Filename; v != nil {
		set, args = append(set, "filename = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.MemoID; v != nil {
		set, args = append(set, "memo_id = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.Reference; v != nil {
		set, args = append(set, "reference = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.Payload; v != nil {
		bytes, err := protojson.Marshal(v)
		if err != nil {
			return errors.Wrap(err, "failed to marshal attachment payload")
		}
		set, args = append(set, "payload = "+placeholder(len(args)+1)), append(args, string(bytes))
	}

	stmt := `UPDATE attachment SET ` + strings.Join(set, ", ") + ` WHERE id = ` + placeholder(len(args)+1)
	args = append(args, update.ID)
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
	stmt := `DELETE FROM attachment WHERE id = $1`
	result, err := d.db.ExecContext(ctx, stmt, delete.ID)
	if err != nil {
		return err
	}
	if _, err := result.RowsAffected(); err != nil {
		return err
	}
	return nil
}
