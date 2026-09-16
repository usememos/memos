package d1

import (
	"context"
	"database/sql"
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"

	"github.com/usememos/memos/filter"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// CreateAttachment inserts an attachment, checking the memo write policy when one is set.
func (d *DB) CreateAttachment(ctx context.Context, create *store.Attachment) (*store.Attachment, error) {
	columns, values, args, err := attachmentInsertValues(create)
	if err != nil {
		return nil, err
	}
	if create.Policy == nil {
		stmt := "INSERT INTO attachment (" + strings.Join(columns, ", ") + ") VALUES (" + strings.Join(values, ", ") + ") RETURNING id, created_ts, updated_ts"
		if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(&create.ID, &create.CreatedTs, &create.UpdatedTs); err != nil {
			return nil, err
		}
		return create, nil
	}
	if create.MemoID == nil || create.CreatorID != create.Policy.ActorUserID {
		return nil, store.ErrMemoPermissionDenied
	}
	state, err := validateMemoWritePolicy(ctx, d.db, *create.MemoID, create.Policy, nil)
	if err != nil {
		return nil, err
	}
	// The guards re-assert the validated memo row and the actor's membership
	// at commit time, so a memo that vanished, was archived, or moved to a
	// Space the actor left yields a conflict instead of an orphaned or
	// unauthorized attachment.
	b := newBatch()
	b.guard(activeUserCondition, create.Policy.ActorUserID)
	memoGuardWritePolicy(b, state, create.Policy, nil)
	index := b.add("INSERT INTO attachment ("+strings.Join(columns, ", ")+") VALUES ("+strings.Join(values, ", ")+") RETURNING id, created_ts, updated_ts", args...)
	results, err := b.commit(ctx, d)
	if err != nil {
		return nil, guardError(err, store.ErrMemoMutationConflict)
	}
	if err := scanResultRow(results[index], &create.ID, &create.CreatedTs, &create.UpdatedTs); err != nil {
		return nil, err
	}
	return create, nil
}

// attachmentInsertValues renders the column list, the value expressions, and
// their bindings for an attachment insert. The blob travels as hex text
// through unhex(?) because the D1 JSON transport cannot carry raw bytes.
func attachmentInsertValues(create *store.Attachment) (columns []string, values []string, args []any, err error) {
	storageType := ""
	if create.StorageType != storepb.AttachmentStorageType_ATTACHMENT_STORAGE_TYPE_UNSPECIFIED {
		storageType = create.StorageType.String()
	}
	payloadString := "{}"
	if create.Payload != nil {
		bytes, err := protojson.Marshal(create.Payload)
		if err != nil {
			return nil, nil, nil, errors.Wrap(err, "failed to marshal attachment payload")
		}
		payloadString = string(bytes)
	}
	blobExpression, blobArg := "?", any(nil)
	if create.Blob != nil {
		blobExpression, blobArg = "unhex(?)", hex.EncodeToString(create.Blob)
	}
	columns = []string{"uid", "filename", "blob", "type", "size", "creator_id", "memo_id", "storage_type", "reference", "payload"}
	values = []string{"?", "?", blobExpression, "?", "?", "?", "?", "?", "?", "?"}
	args = []any{create.UID, create.Filename, blobArg, create.Type, create.Size, create.CreatorID, create.MemoID, storageType, create.Reference, payloadString}
	return columns, values, args, nil
}

// ListAttachments returns the attachments matching find.
func (d *DB) ListAttachments(ctx context.Context, find *store.FindAttachment) ([]*store.Attachment, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.ID; v != nil {
		where, args = append(where, "attachment.id = ?"), append(args, *v)
	}
	if v := find.UID; v != nil {
		where, args = append(where, "attachment.uid = ?"), append(args, *v)
	}
	if v := find.CreatorID; v != nil {
		where, args = append(where, "attachment.creator_id = ?"), append(args, *v)
	}
	if v := find.Filename; v != nil {
		where, args = append(where, "attachment.filename = ?"), append(args, *v)
	}
	if v := find.FilenameSearch; v != nil {
		where, args = append(where, "attachment.filename LIKE ?"), append(args, fmt.Sprintf("%%%s%%", *v))
	}
	if v := find.MemoID; v != nil {
		where, args = append(where, "attachment.memo_id = ?"), append(args, *v)
	}
	if len(find.MemoIDList) > 0 {
		clause, memoArg, err := jsonList(find.MemoIDList)
		if err != nil {
			return nil, err
		}
		where, args = append(where, "attachment.memo_id IN "+clause), append(args, memoArg)
	}
	if find.HasRelatedMemo {
		where = append(where, "attachment.memo_id IS NOT NULL")
	}
	if len(find.Filters) > 0 {
		engine, err := filter.DefaultAttachmentEngine()
		if err != nil {
			return nil, errors.Wrap(err, "failed to get filter engine")
		}
		if err := filter.AppendConditions(ctx, engine, find.Filters, filter.DialectD1, &where, &args); err != nil {
			return nil, errors.Wrap(err, "failed to append filter conditions")
		}
	}
	if access := find.Access; access != nil {
		scopeClauses := []string{}
		if access.UserID != nil {
			scopeClauses = append(scopeClauses, "(attachment.memo_id IS NULL AND EXISTS (SELECT 1 FROM user AS attachment_user WHERE attachment_user.id = ? AND attachment_user.row_status = 'NORMAL') AND attachment.creator_id = ?)")
			args = append(args, *access.UserID, *access.UserID)
		}
		scopeClauses = append(scopeClauses, "(attachment.memo_id IS NOT NULL AND "+memoAccessPredicate(access, "memo", "attachment_member", &args)+")")
		where = append(where, "("+strings.Join(scopeClauses, " OR ")+")")
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
		// hex(NULL) is the empty string, so keep NULL explicit to tell an
		// absent blob from an empty one.
		fields = append(fields, "CASE WHEN attachment.blob IS NULL THEN NULL ELSE hex(attachment.blob) END AS blob")
	}

	query := "SELECT " + strings.Join(fields, ", ") + " FROM attachment" +
		" LEFT JOIN memo ON attachment.memo_id = memo.id" +
		" LEFT JOIN space AS attachment_space ON memo.space_id = attachment_space.id" +
		" WHERE " + strings.Join(where, " AND ") +
		" ORDER BY attachment.updated_ts DESC"
	query = appendLimit(query, find.Limit, find.Offset)

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
		var blobHex sql.NullString
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
			dests = append(dests, &blobHex)
		}
		if err := rows.Scan(dests...); err != nil {
			return nil, err
		}
		if blobHex.Valid {
			blob, err := hex.DecodeString(blobHex.String)
			if err != nil {
				return nil, errors.Wrap(err, "failed to decode attachment blob")
			}
			attachment.Blob = blob
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

// UpdateAttachment applies the given attachment changes.
func (d *DB) UpdateAttachment(ctx context.Context, update *store.UpdateAttachment) error {
	set, args, err := attachmentUpdateSet(update)
	if err != nil {
		return err
	}
	if len(set) == 0 {
		return nil
	}
	stmt := "UPDATE attachment SET " + strings.Join(set, ", ") + " WHERE id = ?"
	args = append(args, update.ID)
	if update.Policy == nil {
		if _, err := d.execOne(ctx, stmt, args...); err != nil {
			return errors.Wrap(err, "failed to update attachment")
		}
		return nil
	}
	if update.MemoID != nil {
		return store.ErrMemoMutationConflict
	}
	attachmentIDs := []int32{update.ID}
	attachments, err := listAttachmentSnapshots(ctx, d.db, attachmentIDs)
	if err != nil {
		return err
	}
	memoIDs, err := store.ValidateAttachmentMutationTargets(update.Policy.ActorUserID, attachmentIDs, attachments)
	if err != nil {
		return err
	}
	states, err := authorizeAttachmentMutation(ctx, d.db, update.Policy.ActorUserID, memoIDs, nil)
	if err != nil {
		return err
	}
	b := newBatch()
	guardAttachmentMutation(b, update.Policy.ActorUserID, states, attachments, nil)
	b.add(stmt, args...)
	if _, err := b.commit(ctx, d); err != nil {
		return errors.Wrap(guardError(err, store.ErrMemoPermissionDenied), "failed to update attachment")
	}
	return nil
}

// attachmentUpdateSet renders the SET clauses and bindings of an attachment update.
func attachmentUpdateSet(update *store.UpdateAttachment) ([]string, []any, error) {
	set, args := []string{}, []any{}
	if v := update.UID; v != nil {
		set, args = append(set, "uid = ?"), append(args, *v)
	}
	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "updated_ts = ?"), append(args, *v)
	}
	if v := update.Filename; v != nil {
		set, args = append(set, "filename = ?"), append(args, *v)
	}
	if v := update.MemoID; v != nil {
		set, args = append(set, "memo_id = ?"), append(args, *v)
	}
	if v := update.Payload; v != nil {
		bytes, err := protojson.Marshal(v)
		if err != nil {
			return nil, nil, errors.Wrap(err, "failed to marshal attachment payload")
		}
		set, args = append(set, "payload = ?"), append(args, string(bytes))
	}
	return set, args, nil
}

// DeleteAttachment removes one attachment.
func (d *DB) DeleteAttachment(ctx context.Context, delete *store.DeleteAttachment) error {
	return d.DeleteAttachments(ctx, []*store.DeleteAttachment{delete})
}

// DeleteAttachments removes the rows in one atomic batch so a failure leaves
// either every attachment or none deleted, matching a transaction.
func (d *DB) DeleteAttachments(ctx context.Context, deletes []*store.DeleteAttachment) error {
	if len(deletes) == 0 {
		return nil
	}
	b := newBatch()
	for _, delete := range deletes {
		b.add("DELETE FROM attachment WHERE id = ?", delete.ID)
	}
	if _, err := b.commit(ctx, d); err != nil {
		return errors.Wrap(err, "failed to delete attachments")
	}
	return nil
}

// GetAttachmentStorageUsage returns the total persisted attachment size for a creator in bytes.
func (d *DB) GetAttachmentStorageUsage(ctx context.Context, creatorID int32) (int64, error) {
	var size int64
	if err := d.db.QueryRowContext(ctx, "SELECT COALESCE(SUM(size), 0) FROM attachment WHERE creator_id = ?", creatorID).Scan(&size); err != nil {
		return 0, errors.Wrap(err, "failed to sum attachment sizes")
	}
	return size, nil
}
