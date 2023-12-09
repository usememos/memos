package postgres

import (
	"context"

	"github.com/Masterminds/squirrel"
	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (d *DB) CreateInbox(ctx context.Context, create *store.Inbox) (*store.Inbox, error) {
	messageString := "{}"
	if create.Message != nil {
		bytes, err := protojson.Marshal(create.Message)
		if err != nil {
			return nil, errors.Wrap(err, "failed to marshal inbox message")
		}
		messageString = string(bytes)
	}

	qb := squirrel.Insert("inbox").
		Columns("sender_id", "receiver_id", "status", "message").
		Values(create.SenderID, create.ReceiverID, create.Status, messageString).
		Suffix("RETURNING id").
		PlaceholderFormat(squirrel.Dollar)

	stmt, args, err := qb.ToSql()
	if err != nil {
		return nil, err
	}

	var id int32
	err = d.db.QueryRowContext(ctx, stmt, args...).Scan(&id)
	if err != nil {
		return nil, err
	}

	return d.GetInbox(ctx, &store.FindInbox{ID: &id})
}

func (d *DB) ListInboxes(ctx context.Context, find *store.FindInbox) ([]*store.Inbox, error) {
	qb := squirrel.Select("id", "created_ts", "sender_id", "receiver_id", "status", "message").
		From("inbox").
		Where("1 = 1").
		PlaceholderFormat(squirrel.Dollar)

	if find.ID != nil {
		qb = qb.Where(squirrel.Eq{"id": *find.ID})
	}
	if find.SenderID != nil {
		qb = qb.Where(squirrel.Eq{"sender_id": *find.SenderID})
	}
	if find.ReceiverID != nil {
		qb = qb.Where(squirrel.Eq{"receiver_id": *find.ReceiverID})
	}
	if find.Status != nil {
		qb = qb.Where(squirrel.Eq{"status": *find.Status})
	}

	query, args, err := qb.ToSql()
	if err != nil {
		return nil, err
	}

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*store.Inbox
	for rows.Next() {
		inbox := &store.Inbox{}
		var messageBytes []byte
		if err := rows.Scan(&inbox.ID, &inbox.CreatedTs, &inbox.SenderID, &inbox.ReceiverID, &inbox.Status, &messageBytes); err != nil {
			return nil, err
		}

		message := &storepb.InboxMessage{}
		if err := protojsonUnmarshaler.Unmarshal(messageBytes, message); err != nil {
			return nil, err
		}
		inbox.Message = message
		list = append(list, inbox)
	}

	return list, rows.Err()
}

func (d *DB) GetInbox(ctx context.Context, find *store.FindInbox) (*store.Inbox, error) {
	list, err := d.ListInboxes(ctx, find)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get inbox")
	}
	if len(list) != 1 {
		return nil, errors.Wrapf(nil, "unexpected inbox count: %d", len(list))
	}
	return list[0], nil
}

func (d *DB) UpdateInbox(ctx context.Context, update *store.UpdateInbox) (*store.Inbox, error) {
	qb := squirrel.Update("inbox").
		Set("status", update.Status.String()).
		Where(squirrel.Eq{"id": update.ID}).
		PlaceholderFormat(squirrel.Dollar)

	stmt, args, err := qb.ToSql()
	if err != nil {
		return nil, err
	}

	_, err = d.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return nil, err
	}

	return d.GetInbox(ctx, &store.FindInbox{ID: &update.ID})
}

func (d *DB) DeleteInbox(ctx context.Context, delete *store.DeleteInbox) error {
	qb := squirrel.Delete("inbox").
		Where(squirrel.Eq{"id": delete.ID}).
		PlaceholderFormat(squirrel.Dollar)

	stmt, args, err := qb.ToSql()
	if err != nil {
		return err
	}

	result, err := d.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return err
	}

	_, err = result.RowsAffected()
	return err
}
