package store

import (
	"context"

	storepb "github.com/usememos/memos/proto/gen/store"
)

// InboxStatus represents the status of an inbox notification.
type InboxStatus string

const (
	// UNREAD indicates the notification has not been read by the user.
	UNREAD InboxStatus = "UNREAD"
	// ARCHIVED indicates the notification has been archived/dismissed by the user.
	ARCHIVED InboxStatus = "ARCHIVED"
)

func (s InboxStatus) String() string {
	return string(s)
}

// Inbox represents a notification in a user's inbox.
// It connects activities to users who should be notified.
type Inbox struct {
	ID         int32
	CreatedTs  int64
	SenderID   int32                 // The user who triggered the notification
	ReceiverID int32                 // The user who receives the notification
	Status     InboxStatus           // Current status (unread/archived)
	Message    *storepb.InboxMessage // The notification message content
}

// UpdateInbox contains fields that can be updated for an inbox item.
type UpdateInbox struct {
	ID     int32
	Status InboxStatus
}

// FindInbox specifies filter criteria for querying inbox items.
type FindInbox struct {
	ID          *int32
	SenderID    *int32
	ReceiverID  *int32
	Status      *InboxStatus
	MessageType *storepb.InboxMessage_Type

	// Pagination
	Limit  *int
	Offset *int
}

// DeleteInbox specifies which inbox item to delete.
type DeleteInbox struct {
	ID int32
}

// CreateInbox creates a new inbox notification.
func (s *Store) CreateInbox(ctx context.Context, create *Inbox) (*Inbox, error) {
	return s.driver.CreateInbox(ctx, create)
}

// ListInboxes retrieves inbox items matching the filter criteria.
func (s *Store) ListInboxes(ctx context.Context, find *FindInbox) ([]*Inbox, error) {
	return s.driver.ListInboxes(ctx, find)
}

// UpdateInbox updates an existing inbox item.
func (s *Store) UpdateInbox(ctx context.Context, update *UpdateInbox) (*Inbox, error) {
	return s.driver.UpdateInbox(ctx, update)
}

// DeleteInbox permanently removes an inbox item.
func (s *Store) DeleteInbox(ctx context.Context, delete *DeleteInbox) error {
	return s.driver.DeleteInbox(ctx, delete)
}
