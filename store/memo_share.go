package store

import "context"

// MemoShare is an access grant that permits read-only access to a memo via a bearer token.
type MemoShare struct {
	ID        int32
	UID       string
	MemoID    int32
	CreatorID int32
	CreatedTs int64
	ExpiresTs *int64 // nil means the share never expires
}

// FindMemoShare is used to filter memo shares in list/get queries.
type FindMemoShare struct {
	ID        *int32
	UID       *string
	MemoID    *int32
	CreatorID *int32
}

// DeleteMemoShare identifies a share grant to remove.
type DeleteMemoShare struct {
	ID  *int32
	UID *string
}

// CreateMemoShare creates a new share grant.
func (s *Store) CreateMemoShare(ctx context.Context, create *MemoShare) (*MemoShare, error) {
	return s.driver.CreateMemoShare(ctx, create)
}

// ListMemoShares returns all share grants matching the filter.
func (s *Store) ListMemoShares(ctx context.Context, find *FindMemoShare) ([]*MemoShare, error) {
	return s.driver.ListMemoShares(ctx, find)
}

// GetMemoShare returns the first share grant matching the filter, or nil if none found.
func (s *Store) GetMemoShare(ctx context.Context, find *FindMemoShare) (*MemoShare, error) {
	return s.driver.GetMemoShare(ctx, find)
}

// DeleteMemoShare removes a share grant.
func (s *Store) DeleteMemoShare(ctx context.Context, delete *DeleteMemoShare) error {
	return s.driver.DeleteMemoShare(ctx, delete)
}
