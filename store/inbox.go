package store

import (
	"context"

	storepb "github.com/usememos/memos/proto/gen/store"
)

// InboxStatus is the status for an inbox.
type InboxStatus string

const (
	UNREAD   InboxStatus = "UNREAD"
	ARCHIVED InboxStatus = "ARCHIVED"
)

func (s InboxStatus) String() string {
	return string(s)
}

type Inbox struct {
	ID         int32
	CreatedTs  int64
	SenderID   int32
	ReceiverID int32
	Status     InboxStatus
	Message    *storepb.InboxMessage
}

type UpdateInbox struct {
	ID     int32
	Status InboxStatus
}

type FindInbox struct {
	ID         *int32
	SenderID   *int32
	ReceiverID *int32
	Status     *InboxStatus

	// Pagination
	Limit  *int
	Offset *int
}

type DeleteInbox struct {
	ID int32
}

func (s *Store) CreateInbox(ctx context.Context, create *Inbox) (*Inbox, error) {
	return s.driver.CreateInbox(ctx, create)
}

func (s *Store) ListInboxes(ctx context.Context, find *FindInbox) ([]*Inbox, error) {
	return s.driver.ListInboxes(ctx, find)
}

func (s *Store) UpdateInbox(ctx context.Context, update *UpdateInbox) (*Inbox, error) {
	return s.driver.UpdateInbox(ctx, update)
}

func (s *Store) DeleteInbox(ctx context.Context, delete *DeleteInbox) error {
	return s.driver.DeleteInbox(ctx, delete)
}
