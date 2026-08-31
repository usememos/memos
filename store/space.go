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

// ErrSpaceMemberAlreadyExists indicates an existing membership or invitation.
var ErrSpaceMemberAlreadyExists = errors.New("space member already exists")

// ErrSpaceNotFound indicates a missing mutation target.
var ErrSpaceNotFound = errors.New("space not found")

// ErrSpaceMemberNotFound indicates a missing membership mutation target.
var ErrSpaceMemberNotFound = errors.New("space member not found")

// ErrSpaceInvitationNotFound indicates a missing pending invitation.
var ErrSpaceInvitationNotFound = errors.New("space invitation not found")

// SpaceMemberStatus is the state of a user's relationship with a space.
type SpaceMemberStatus string

const (
	// SpaceMemberStatusInvited represents an invitation that the user has not accepted.
	SpaceMemberStatusInvited SpaceMemberStatus = "INVITED"
	// SpaceMemberStatusActive represents a membership that the user has accepted.
	SpaceMemberStatusActive SpaceMemberStatus = "ACTIVE"
)

// IsValid reports whether the status is recognized.
func (s SpaceMemberStatus) IsValid() bool {
	return s == SpaceMemberStatusInvited || s == SpaceMemberStatusActive
}

// SpaceMemberRole is the role of a user within a space.
type SpaceMemberRole string

const (
	// SpaceMemberRoleAdmin can manage the space and its membership.
	SpaceMemberRoleAdmin SpaceMemberRole = "ADMIN"
	// SpaceMemberRoleUser is a regular space member.
	SpaceMemberRoleUser SpaceMemberRole = "USER"
)

// IsActiveMember reports whether the role can grant space membership. The
// relationship must separately be ACTIVE before the role grants access.
func (r SpaceMemberRole) IsActiveMember() bool {
	return r == SpaceMemberRoleAdmin || r == SpaceMemberRoleUser
}

// Space groups memos and memberships.
type Space struct {
	ID int32

	UID             string
	Title           string
	Description     string
	CurrentUserRole SpaceMemberRole
	MemberCount     int32
}

// FindSpace selects spaces. MemberUserID restricts results to spaces where the
// user has a membership, populates the viewer summary, and is applied before
// pagination.
type FindSpace struct {
	ID           *int32
	IDList       []int32
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

// SpaceInvitation is a pending offer for an existing user to join a space.
type SpaceInvitation struct {
	SpaceID int32
	UserID  int32
	Role    SpaceMemberRole
}

// FindSpaceInvitation selects pending invitations. ViewerUserID restricts
// results to invitations visible to that user: their own or those in a space
// they actively administer.
type FindSpaceInvitation struct {
	SpaceID      *int32
	UserID       *int32
	ViewerUserID *int32
	Limit        *int
	Offset       *int
}

// AcceptSpaceInvitation identifies an invitation accepted by its invitee.
type AcceptSpaceInvitation struct {
	SpaceID int32
	UserID  int32
}

// DeclineSpaceInvitation identifies an invitation declined by its invitee.
type DeclineSpaceInvitation struct {
	SpaceID int32
	UserID  int32
}

// RevokeSpaceInvitation identifies an invitation revoked by a space administrator.
type RevokeSpaceInvitation struct {
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
	if delete == nil || delete.SpaceID <= 0 || delete.UserID <= 0 || actorUserID <= 0 {
		return errors.New("space member deletion requires space, user, and actor")
	}
	return s.driver.DeleteSpaceMember(ctx, delete, actorUserID)
}

// CreateSpaceInvitation creates a pending invitation. It never creates an
// active membership; only the invitee can do that by accepting it.
func (s *Store) CreateSpaceInvitation(ctx context.Context, create *SpaceInvitation, actorUserID int32) (*SpaceInvitation, error) {
	if create == nil || create.SpaceID <= 0 || create.UserID <= 0 || actorUserID <= 0 {
		return nil, errors.New("space invitation requires space, user, and actor")
	}
	if !create.Role.IsActiveMember() {
		return nil, errors.New("invalid space invitation role")
	}
	return s.driver.CreateSpaceInvitation(ctx, create, actorUserID)
}

// ListSpaceInvitations returns pending invitations matching find.
func (s *Store) ListSpaceInvitations(ctx context.Context, find *FindSpaceInvitation) ([]*SpaceInvitation, error) {
	return s.driver.ListSpaceInvitations(ctx, find)
}

// GetSpaceInvitation returns the first matching pending invitation.
func (s *Store) GetSpaceInvitation(ctx context.Context, find *FindSpaceInvitation) (*SpaceInvitation, error) {
	invitations, err := s.ListSpaceInvitations(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(invitations) == 0 {
		return nil, nil
	}
	return invitations[0], nil
}

// AcceptSpaceInvitation activates a pending invitation only when the actor is
// the invitee.
func (s *Store) AcceptSpaceInvitation(ctx context.Context, accept *AcceptSpaceInvitation, actorUserID int32) (*SpaceMember, error) {
	if accept == nil || accept.SpaceID <= 0 || accept.UserID <= 0 || actorUserID <= 0 {
		return nil, errors.New("space invitation acceptance requires space, user, and actor")
	}
	if accept.UserID != actorUserID {
		return nil, ErrSpacePermissionDenied
	}
	return s.driver.AcceptSpaceInvitation(ctx, accept, actorUserID)
}

// DeclineSpaceInvitation deletes a pending invitation only when the actor is
// the invitee.
func (s *Store) DeclineSpaceInvitation(ctx context.Context, decline *DeclineSpaceInvitation, actorUserID int32) error {
	if decline == nil || decline.SpaceID <= 0 || decline.UserID <= 0 || actorUserID <= 0 {
		return errors.New("space invitation decline requires space, user, and actor")
	}
	if decline.UserID != actorUserID {
		return ErrSpacePermissionDenied
	}
	return s.driver.DeclineSpaceInvitation(ctx, decline, actorUserID)
}

// RevokeSpaceInvitation deletes a pending invitation after authorizing an
// active space administrator.
func (s *Store) RevokeSpaceInvitation(ctx context.Context, revoke *RevokeSpaceInvitation, actorUserID int32) error {
	if revoke == nil || revoke.SpaceID <= 0 || revoke.UserID <= 0 || actorUserID <= 0 {
		return errors.New("space invitation revocation requires space, user, and actor")
	}
	return s.driver.RevokeSpaceInvitation(ctx, revoke, actorUserID)
}
