package store

import (
	"context"
	"errors"
	"strings"

	"github.com/usememos/memos/internal/base"
)

// ErrLastSpaceAdmin indicates that a membership mutation would leave an active
// space without an administrator.
var ErrLastSpaceAdmin = errors.New("cannot remove the last space admin")

// ErrSpacePermissionDenied indicates that the actor cannot perform a space mutation.
var ErrSpacePermissionDenied = errors.New("space permission denied")

// ErrSpaceMemberNotActive indicates that a membership target is not an active user.
var ErrSpaceMemberNotActive = errors.New("space member user is not active")

// ErrSpaceAlreadyExists indicates a duplicate immutable space ID.
var ErrSpaceAlreadyExists = errors.New("space already exists")

// ErrSpaceMemberAlreadyExists indicates an existing membership.
var ErrSpaceMemberAlreadyExists = errors.New("space member already exists")

// ErrSpaceNotFound indicates a missing mutation target.
var ErrSpaceNotFound = errors.New("space not found")

// ErrSpaceMemberNotFound indicates a missing membership mutation target.
var ErrSpaceMemberNotFound = errors.New("space member not found")

// SpaceMemberRole is the role of a user within a space.
type SpaceMemberRole string

const (
	// SpaceMemberRoleAdmin can manage the space and its membership.
	SpaceMemberRoleAdmin SpaceMemberRole = "ADMIN"
	// SpaceMemberRoleUser is a regular space member.
	SpaceMemberRoleUser SpaceMemberRole = "USER"
)

// IsActiveMember reports whether the role grants space membership. It is the
// single definition of membership validity: an unknown role denies the access
// that depends on it.
func (r SpaceMemberRole) IsActiveMember() bool {
	return r == SpaceMemberRoleAdmin || r == SpaceMemberRoleUser
}

// Space groups memos and memberships.
type Space struct {
	ID int32

	UID         string
	Title       string
	Description string
}

// FindSpace selects spaces. MemberUserID restricts results to spaces where the
// user has a membership and is applied before pagination.
type FindSpace struct {
	ID           *int32
	UID          *string
	MemberUserID *int32
	Limit        *int
	Offset       *int
}

// UpdateSpace contains mutable space fields.
type UpdateSpace struct {
	ID          int32
	Title       *string
	Description *string
}

// DeleteSpace identifies a Space to hard-delete.
type DeleteSpace struct {
	ID          int32
	ActorUserID int32
}

// DeleteSpaceResult contains external resources to clean after commit.
type DeleteSpaceResult struct {
	Attachments []*Attachment
}

// SpaceMember associates a user with a space.
type SpaceMember struct {
	SpaceID int32
	UserID  int32
	Role    SpaceMemberRole
}

// FindSpaceMember selects memberships.
type FindSpaceMember struct {
	SpaceID      *int32
	UserID       *int32
	ViewerUserID *int32
	Limit        *int
	Offset       *int
}

// UpdateSpaceMember contains mutable membership fields.
type UpdateSpaceMember struct {
	SpaceID int32
	UserID  int32
	Role    *SpaceMemberRole
}

// DeleteSpaceMember identifies a membership to delete.
type DeleteSpaceMember struct {
	SpaceID int32
	UserID  int32
}

// CreateSpace creates a space and its first ADMIN membership atomically.
func (s *Store) CreateSpace(ctx context.Context, create *Space, creatorID int32) (*Space, error) {
	if create == nil {
		return nil, errors.New("space is required")
	}
	if !base.UIDMatcher.MatchString(create.UID) {
		return nil, errors.New("invalid uid")
	}
	if strings.TrimSpace(create.Title) == "" {
		return nil, errors.New("space title is required")
	}
	return s.driver.CreateSpace(ctx, create, creatorID)
}

// ListSpaces returns spaces matching find.
func (s *Store) ListSpaces(ctx context.Context, find *FindSpace) ([]*Space, error) {
	return s.driver.ListSpaces(ctx, find)
}

// GetSpace returns the first matching space.
func (s *Store) GetSpace(ctx context.Context, find *FindSpace) (*Space, error) {
	spaces, err := s.ListSpaces(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(spaces) == 0 {
		return nil, nil
	}
	return spaces[0], nil
}

// UpdateSpace updates and returns a space.
func (s *Store) UpdateSpace(ctx context.Context, update *UpdateSpace, actorUserID int32) (*Space, error) {
	if update == nil {
		return nil, errors.New("space update is required")
	}
	if update.Title != nil && strings.TrimSpace(*update.Title) == "" {
		return nil, errors.New("space title is required")
	}
	if update.Title == nil && update.Description == nil {
		return nil, errors.New("space update requires at least one field")
	}
	return s.driver.UpdateSpace(ctx, update, actorUserID)
}

// DeleteSpace atomically deletes a Space, all directly assigned memos, and
// their owned database resources. Memo relations are not followed.
func (s *Store) DeleteSpace(ctx context.Context, delete *DeleteSpace) (*DeleteSpaceResult, error) {
	if delete == nil || delete.ID <= 0 || delete.ActorUserID <= 0 {
		return nil, errors.New("space deletion requires space and actor")
	}
	result, err := s.driver.DeleteSpace(ctx, delete)
	if err != nil {
		return nil, err
	}
	if result == nil {
		return nil, errors.New("unexpected nil delete space result")
	}
	return result, nil
}

// CreateSpaceMember creates a membership.
func (s *Store) CreateSpaceMember(ctx context.Context, create *SpaceMember, actorUserID int32) (*SpaceMember, error) {
	if !create.Role.IsActiveMember() {
		return nil, errors.New("invalid space member role")
	}
	return s.driver.CreateSpaceMember(ctx, create, actorUserID)
}

// ListSpaceMembers returns memberships matching find.
func (s *Store) ListSpaceMembers(ctx context.Context, find *FindSpaceMember) ([]*SpaceMember, error) {
	return s.driver.ListSpaceMembers(ctx, find)
}

// GetSpaceMember returns the first matching membership.
func (s *Store) GetSpaceMember(ctx context.Context, find *FindSpaceMember) (*SpaceMember, error) {
	members, err := s.ListSpaceMembers(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(members) == 0 {
		return nil, nil
	}
	return members[0], nil
}

// UpdateSpaceMember updates and returns a membership after checking that the
// change keeps an active ADMIN.
func (s *Store) UpdateSpaceMember(ctx context.Context, update *UpdateSpaceMember, actorUserID int32) (*SpaceMember, error) {
	if update == nil || update.Role == nil {
		return nil, errors.New("space member role is required")
	}
	if update.Role != nil && !update.Role.IsActiveMember() {
		return nil, errors.New("invalid space member role")
	}
	return s.driver.UpdateSpaceMember(ctx, update, actorUserID)
}

// DeleteSpaceMember deletes a membership after checking that the change keeps
// an active ADMIN.
func (s *Store) DeleteSpaceMember(ctx context.Context, delete *DeleteSpaceMember, actorUserID int32) error {
	return s.driver.DeleteSpaceMember(ctx, delete, actorUserID)
}
