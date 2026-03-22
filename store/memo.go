package store

import (
	"context"
	"errors"

	"github.com/usememos/memos/internal/base"

	storepb "github.com/usememos/memos/proto/gen/store"
)

// Visibility is the type of a visibility.
type Visibility string

const (
	// Public is the PUBLIC visibility.
	Public Visibility = "PUBLIC"
	// Protected is the PROTECTED visibility.
	Protected Visibility = "PROTECTED"
	// Private is the PRIVATE visibility.
	Private Visibility = "PRIVATE"
)

func (v Visibility) String() string {
	switch v {
	case Public:
		return "PUBLIC"
	case Protected:
		return "PROTECTED"
	default:
		return "PRIVATE"
	}
}

type Memo struct {
	// ID is the system generated unique identifier for the memo.
	ID int32
	// UID is the user defined unique identifier for the memo.
	UID string

	// Standard fields
	RowStatus RowStatus
	CreatorID int32
	CreatedTs int64
	UpdatedTs int64

	// Domain specific fields
	Content    string
	Visibility Visibility
	Pinned     bool
	Payload    *storepb.MemoPayload

	// Composed fields
	ParentUID *string
}

type FindMemo struct {
	ID  *int32
	UID *string

	IDList  []int32
	UIDList []string

	// Standard fields
	RowStatus *RowStatus
	CreatorID *int32

	// Domain specific fields
	VisibilityList  []Visibility
	ExcludeContent  bool
	ExcludeComments bool
	Filters         []string

	// Pagination
	Limit  *int
	Offset *int

	// Ordering
	OrderByPinned    bool
	OrderByUpdatedTs bool
	OrderByTimeAsc   bool
}

type FindMemoPayload struct {
	Raw                *string
	TagSearch          []string
	HasLink            bool
	HasTaskList        bool
	HasCode            bool
	HasIncompleteTasks bool
}

type UpdateMemo struct {
	ID         int32
	UID        *string
	CreatedTs  *int64
	UpdatedTs  *int64
	RowStatus  *RowStatus
	Content    *string
	Visibility *Visibility
	Pinned     *bool
	Payload    *storepb.MemoPayload
}

type DeleteMemo struct {
	ID int32
}

func (s *Store) CreateMemo(ctx context.Context, create *Memo) (*Memo, error) {
	if !base.UIDMatcher.MatchString(create.UID) {
		return nil, errors.New("invalid uid")
	}
	return s.driver.CreateMemo(ctx, create)
}

func (s *Store) ListMemos(ctx context.Context, find *FindMemo) ([]*Memo, error) {
	return s.driver.ListMemos(ctx, find)
}

func (s *Store) GetMemo(ctx context.Context, find *FindMemo) (*Memo, error) {
	list, err := s.ListMemos(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}

	memo := list[0]
	return memo, nil
}

func (s *Store) UpdateMemo(ctx context.Context, update *UpdateMemo) error {
	if update.UID != nil && !base.UIDMatcher.MatchString(*update.UID) {
		return errors.New("invalid uid")
	}
	return s.driver.UpdateMemo(ctx, update)
}

func (s *Store) DeleteMemo(ctx context.Context, delete *DeleteMemo) error {
	// Clean up memo_relation records where this memo is either the source or target.
	if err := s.driver.DeleteMemoRelation(ctx, &DeleteMemoRelation{MemoID: &delete.ID}); err != nil {
		return err
	}
	if err := s.driver.DeleteMemoRelation(ctx, &DeleteMemoRelation{RelatedMemoID: &delete.ID}); err != nil {
		return err
	}
	// Clean up attachments linked to this memo.
	attachments, err := s.ListAttachments(ctx, &FindAttachment{MemoID: &delete.ID})
	if err != nil {
		return err
	}
	for _, attachment := range attachments {
		if err := s.DeleteAttachment(ctx, &DeleteAttachment{ID: attachment.ID}); err != nil {
			return err
		}
	}
	return s.driver.DeleteMemo(ctx, delete)
}
