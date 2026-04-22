package store

import "context"

// UserIdentity is the linkage between an external identity subject and a local user.
// Uniqueness is enforced on (Provider, ExternUID); one local user may have multiple
// identities across different providers.
type UserIdentity struct {
	ID        int32
	UserID    int32
	Provider  string
	ExternUID string
	CreatedTs int64
	UpdatedTs int64
}

// FindUserIdentity is used to filter user identities in list/get queries.
type FindUserIdentity struct {
	ID        *int32
	UserID    *int32
	Provider  *string
	ExternUID *string
}

// DeleteUserIdentity is used to delete user identity linkage rows.
type DeleteUserIdentity struct {
	ID       *int32
	UserID   *int32
	Provider *string
}

// CreateUserIdentity creates a new external-identity linkage record.
// Returns the driver error on unique-constraint violation; callers are responsible
// for reconciling concurrent first-login races on (Provider, ExternUID).
func (s *Store) CreateUserIdentity(ctx context.Context, create *UserIdentity) (*UserIdentity, error) {
	return s.driver.CreateUserIdentity(ctx, create)
}

// ListUserIdentities returns all linkage records matching the filter.
func (s *Store) ListUserIdentities(ctx context.Context, find *FindUserIdentity) ([]*UserIdentity, error) {
	return s.driver.ListUserIdentities(ctx, find)
}

// DeleteUserIdentities deletes all linkage records matching the filter.
func (s *Store) DeleteUserIdentities(ctx context.Context, delete *DeleteUserIdentity) error {
	return s.driver.DeleteUserIdentities(ctx, delete)
}

// GetUserIdentity returns the first linkage record matching the filter, or nil if none found.
func (s *Store) GetUserIdentity(ctx context.Context, find *FindUserIdentity) (*UserIdentity, error) {
	list, err := s.ListUserIdentities(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}
	return list[0], nil
}
