package store

import (
	"context"
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
	ID int32

	// Standard fields
	RowStatus RowStatus
	CreatorID int32
	CreatedTs int64
	UpdatedTs int64

	// Domain specific fields
	Content    string
	Visibility Visibility

	// Composed fields
	Pinned   bool
	ParentID *int32
}

type FindMemo struct {
	ID *int32

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
	ExcludeContent  bool
	ExcludeComments bool

	// Pagination
	Limit            *int
	Offset           *int
	OrderByUpdatedTs bool
	OrderByPinned    bool
}

type UpdateMemo struct {
	ID         int32
	CreatedTs  *int64
	UpdatedTs  *int64
	RowStatus  *RowStatus
	Content    *string
	Visibility *Visibility
}

type DeleteMemo struct {
	ID int32
}

func (s *Store) CreateMemo(ctx context.Context, create *Memo) (*Memo, error) {
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
	return s.driver.UpdateMemo(ctx, update)
}

func (s *Store) DeleteMemo(ctx context.Context, delete *DeleteMemo) error {
	return s.driver.DeleteMemo(ctx, delete)
}
