package d1

import (
	"context"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

const inboxColumns = "id, created_ts, sender_id, receiver_id, status, message"

// CreateInbox inserts an inbox message.
func (d *DB) CreateInbox(ctx context.Context, create *store.Inbox) (*store.Inbox, error) {
	messageString := "{}"
	if create.Message != nil {
		bytes, err := protojson.Marshal(create.Message)
		if err != nil {
			return nil, errors.Wrap(err, "failed to marshal inbox message")
		}
		messageString = string(bytes)
	}

	stmt := "INSERT INTO inbox (sender_id, receiver_id, status, message) VALUES (?, ?, ?, ?) RETURNING id, created_ts"
	if err := d.db.QueryRowContext(ctx, stmt, create.SenderID, create.ReceiverID, create.Status, messageString).Scan(
		&create.ID,
		&create.CreatedTs,
	); err != nil {
		return nil, err
	}
	return create, nil
}

// ListInboxes returns the inbox messages matching find.
func (d *DB) ListInboxes(ctx context.Context, find *store.FindInbox) ([]*store.Inbox, error) {
	where, args := []string{"1 = 1"}, []any{}

	if find.ID != nil {
		where, args = append(where, "id = ?"), append(args, *find.ID)
	}
	if find.SenderID != nil {
		where, args = append(where, "sender_id = ?"), append(args, *find.SenderID)
	}
	if find.ReceiverID != nil {
		where, args = append(where, "receiver_id = ?"), append(args, *find.ReceiverID)
	}
	if find.Status != nil {
		where, args = append(where, "status = ?"), append(args, *find.Status)
	}
	if find.MessageType != nil {
		// The message column stores protojson, whose type field is the enum
		// name; D1 ships SQLite's JSON functions so JSON_EXTRACT works here.
		if *find.MessageType == storepb.InboxMessage_TYPE_UNSPECIFIED {
			where, args = append(where, "(JSON_EXTRACT(message, '$.type') IS NULL OR JSON_EXTRACT(message, '$.type') = ?)"), append(args, find.MessageType.String())
		} else {
			where, args = append(where, "JSON_EXTRACT(message, '$.type') = ?"), append(args, find.MessageType.String())
		}
	}

	query := "SELECT " + inboxColumns + " FROM inbox WHERE " + strings.Join(where, " AND ") + " ORDER BY created_ts DESC"
	query = appendLimit(query, find.Limit, find.Offset)
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []*store.Inbox{}
	for rows.Next() {
		inbox, err := inboxScan(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, inbox)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

// inboxScanner is satisfied by *sql.Row and *sql.Rows.
type inboxScanner interface {
	Scan(dest ...any) error
}

// inboxScan reads one row selected with inboxColumns.
func inboxScan(scanner inboxScanner) (*store.Inbox, error) {
	inbox := &store.Inbox{}
	var messageBytes []byte
	if err := scanner.Scan(
		&inbox.ID,
		&inbox.CreatedTs,
		&inbox.SenderID,
		&inbox.ReceiverID,
		&inbox.Status,
		&messageBytes,
	); err != nil {
		return nil, err
	}
	message := &storepb.InboxMessage{}
	if err := protojsonUnmarshaler.Unmarshal(messageBytes, message); err != nil {
		return nil, err
	}
	inbox.Message = message
	return inbox, nil
}

// UpdateInbox changes the status of an inbox message.
func (d *DB) UpdateInbox(ctx context.Context, update *store.UpdateInbox) (*store.Inbox, error) {
	query := "UPDATE inbox SET status = ? WHERE id = ? RETURNING " + inboxColumns
	return inboxScan(d.db.QueryRowContext(ctx, query, update.Status.String(), update.ID))
}

// DeleteInbox removes an inbox message.
func (d *DB) DeleteInbox(ctx context.Context, delete *store.DeleteInbox) error {
	_, err := d.execOne(ctx, "DELETE FROM inbox WHERE id = ?", delete.ID)
	return err
}
