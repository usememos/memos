package v1

import (
	"context"
	"fmt"
	"time"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) CreateGroup(ctx context.Context, request *v1pb.CreateGroupRequest) (*v1pb.Group, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	create := &store.Group{
		Name:        request.Group.DisplayName,
		Description: request.Group.Description,
		CreatorID:   user.ID,
		Visibility:  store.Public, // Default to public for now
	}
	group, err := s.Store.CreateGroup(ctx, create)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create group")
	}

	return s.convertGroupFromStore(ctx, group)
}

func (s *APIV1Service) ListGroups(ctx context.Context, request *v1pb.ListGroupsRequest) (*v1pb.ListGroupsResponse, error) {
	groups, err := s.Store.ListGroups(ctx, &store.FindGroup{})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list groups")
	}

	var pbGroups []*v1pb.Group
	for _, g := range groups {
		if pbGroup, err := s.convertGroupFromStore(ctx, g); err == nil {
			pbGroups = append(pbGroups, pbGroup)
		}
	}

	return &v1pb.ListGroupsResponse{Groups: pbGroups}, nil
}

func (s *APIV1Service) GetGroup(ctx context.Context, request *v1pb.GetGroupRequest) (*v1pb.Group, error) {
	// Simplified get implementation
	return nil, status.Errorf(codes.Unimplemented, "GetGroup is not implemented")
}

func (s *APIV1Service) UpdateGroup(ctx context.Context, request *v1pb.UpdateGroupRequest) (*v1pb.Group, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	var groupID int32
	_, err = fmt.Sscanf(request.Group.Name, "groups/%d", &groupID)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid group name: %s", request.Group.Name)
	}

	group, err := s.Store.GetGroup(ctx, &store.FindGroup{ID: &groupID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to find group")
	}
	if group == nil {
		return nil, status.Errorf(codes.NotFound, "group not found")
	}

	// Verify permission: only group owner/creator can update
	members, err := s.Store.ListGroupMembers(ctx, &store.FindGroupMember{
		GroupID: &groupID,
		UserID:  &user.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list group members")
	}



	isOwnerOrAdmin := false
	if user.Role == store.RoleAdmin {
		isOwnerOrAdmin = true
	}
	for _, member := range members {
		if member.Role == "OWNER" || member.Role == "ADMIN" {
			isOwnerOrAdmin = true
			break
		}
	}
	if group.CreatorID == user.ID {
		isOwnerOrAdmin = true
	}

	if !isOwnerOrAdmin {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied to update group")
	}

	update := &store.UpdateGroup{
		ID: groupID,
	}

	for _, path := range request.UpdateMask.Paths {
		if path == "display_name" {
			update.Name = &request.Group.DisplayName
		} else if path == "description" {
			update.Description = &request.Group.Description
		}
	}

	updatedGroup, err := s.Store.UpdateGroup(ctx, update)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update group")
	}

	return s.convertGroupFromStore(ctx, updatedGroup)
}

func (s *APIV1Service) DeleteGroup(ctx context.Context, request *v1pb.DeleteGroupRequest) (*emptypb.Empty, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	var groupID int32
	_, err = fmt.Sscanf(request.Name, "groups/%d", &groupID)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid group name: %s", request.Name)
	}

	group, err := s.Store.GetGroup(ctx, &store.FindGroup{ID: &groupID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to find group")
	}
	if group == nil {
		return nil, status.Errorf(codes.NotFound, "group not found")
	}

	// Verify permission: only group owner/creator can delete
	members, err := s.Store.ListGroupMembers(ctx, &store.FindGroupMember{
		GroupID: &groupID,
		UserID:  &user.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list group members")
	}



	isOwnerOrAdmin := false
	if user.Role == store.RoleAdmin {
		isOwnerOrAdmin = true
	}
	for _, member := range members {
		if member.Role == "OWNER" || member.Role == "ADMIN" {
			isOwnerOrAdmin = true
			break
		}
	}
	if group.CreatorID == user.ID {
		isOwnerOrAdmin = true
	}

	if !isOwnerOrAdmin {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied to delete group")
	}

	err = s.Store.DeleteGroup(ctx, groupID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete group")
	}

	return &emptypb.Empty{}, nil
}

func (s *APIV1Service) AddGroupMember(ctx context.Context, request *v1pb.AddGroupMemberRequest) (*v1pb.GroupMember, error) {
	return nil, status.Errorf(codes.Unimplemented, "AddGroupMember is not implemented")
}

func (s *APIV1Service) ListGroupMembers(ctx context.Context, request *v1pb.ListGroupMembersRequest) (*v1pb.ListGroupMembersResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "ListGroupMembers is not implemented")
}

func (s *APIV1Service) UpdateGroupMember(ctx context.Context, request *v1pb.UpdateGroupMemberRequest) (*v1pb.GroupMember, error) {
	return nil, status.Errorf(codes.Unimplemented, "UpdateGroupMember is not implemented")
}

func (s *APIV1Service) RemoveGroupMember(ctx context.Context, request *v1pb.RemoveGroupMemberRequest) (*emptypb.Empty, error) {
	return nil, status.Errorf(codes.Unimplemented, "RemoveGroupMember is not implemented")
}

func (s *APIV1Service) convertGroupFromStore(ctx context.Context, group *store.Group) (*v1pb.Group, error) {
	return &v1pb.Group{
		Name:        fmt.Sprintf("groups/%d", group.ID),
		DisplayName: group.Name,
		Description: group.Description,
		CreateTime:  timestamppb.New(time.Unix(group.CreatedTs, 0)),
	}, nil
}
