package store

import (
	"context"
)

// Group is the schema for a group.
type Group struct {
	ID          int32
	Name        string
	Description string
	CreatorID   int32
	Visibility  Visibility
	CreatedTs   int64
}

// GroupMember is the schema for a group member.
type GroupMember struct {
	GroupID int32
	UserID  int32
	Role    string // "MEMBER", "ADMIN", "OWNER"
}

// FindGroup is the query filter for listing groups.
type FindGroup struct {
	ID        *int32
	Name      *string
	CreatorID *int32
}

// FindGroupMember is the query filter for listing group members.
type FindGroupMember struct {
	GroupID *int32
	UserID  *int32
}

// UpdateGroup is the schema for updating a group.
type UpdateGroup struct {
	ID          int32
	Name        *string
	Description *string
	Visibility  *Visibility
}

func (s *Store) CreateGroup(ctx context.Context, create *Group) (*Group, error) {
	return s.driver.CreateGroup(ctx, create)
}

func (s *Store) ListGroups(ctx context.Context, find *FindGroup) ([]*Group, error) {
	return s.driver.ListGroups(ctx, find)
}

func (s *Store) GetGroup(ctx context.Context, find *FindGroup) (*Group, error) {
	list, err := s.driver.ListGroups(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}
	return list[0], nil
}

func (s *Store) UpdateGroup(ctx context.Context, update *UpdateGroup) (*Group, error) {
	return s.driver.UpdateGroup(ctx, update)
}

func (s *Store) DeleteGroup(ctx context.Context, id int32) error {
	return s.driver.DeleteGroup(ctx, id)
}

func (s *Store) CreateGroupMember(ctx context.Context, create *GroupMember) (*GroupMember, error) {
	return s.driver.CreateGroupMember(ctx, create)
}

func (s *Store) ListGroupMembers(ctx context.Context, find *FindGroupMember) ([]*GroupMember, error) {
	return s.driver.ListGroupMembers(ctx, find)
}

func (s *Store) UpdateGroupMember(ctx context.Context, update *GroupMember) (*GroupMember, error) {
	return s.driver.UpdateGroupMember(ctx, update)
}

func (s *Store) DeleteGroupMember(ctx context.Context, delete *GroupMember) error {
	return s.driver.DeleteGroupMember(ctx, delete)
}

// CheckUserInGroup returns true if the user is a member of the group.
func (s *Store) CheckUserInGroup(ctx context.Context, userID int32, groupID int32) (bool, error) {
	members, err := s.driver.ListGroupMembers(ctx, &FindGroupMember{
		GroupID: &groupID,
		UserID:  &userID,
	})
	if err != nil {
		return false, err
	}
	return len(members) > 0, nil
}
