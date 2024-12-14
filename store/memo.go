package store

import (
	"context"
	"errors"

	"github.com/usememos/memos/internal/util"

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
	case Private:
		return "PRIVATE"
	}
	return "PRIVATE"
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
	Payload    *storepb.MemoPayload

	// Composed fields
	Pinned   bool
	ParentID *int32
}

type FindMemo struct {
	ID  *int32
	UID *string

	// Standard fields
	RowStatus       *RowStatus
	CreatorID       *int32
	CreatedTsAfter  *int64
	CreatedTsBefore *int64
	UpdatedTsAfter  *int64
	UpdatedTsBefore *int64

	// Domain specific fields
	ContentSearch   []string
	VisibilityList  []Visibility
	PayloadFind     *FindMemoPayload
	ExcludeContent  bool
	ExcludeComments bool
	Random          bool
	ShareTags       bool

	// Pagination
	Limit  *int
	Offset *int

	// Ordering
	OrderByUpdatedTs bool
	OrderByPinned    bool
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
	Payload    *storepb.MemoPayload
}

type DeleteMemo struct {
	ID int32
}

func (s *Store) CreateMemo(ctx context.Context, create *Memo) (*Memo, error) {
	if !util.UIDMatcher.MatchString(create.UID) {
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
	if update.UID != nil && !util.UIDMatcher.MatchString(*update.UID) {
		return errors.New("invalid uid")
	}
	return s.driver.UpdateMemo(ctx, update)
}

func (s *Store) DeleteMemo(ctx context.Context, delete *DeleteMemo) error {
	return s.driver.DeleteMemo(ctx, delete)
}
