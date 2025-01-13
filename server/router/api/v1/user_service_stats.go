package v1

import (
	"context"
	"fmt"
	"slices"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) ListAllUserStats(ctx context.Context, request *v1pb.ListAllUserStatsRequest) (*v1pb.ListAllUserStatsResponse, error) {
	users, err := s.Store.ListUsers(ctx, &store.FindUser{})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list users: %v", err)
	}
	userStatsList := []*v1pb.UserStats{}
	for _, user := range users {
		userStats, err := s.GetUserStats(ctx, &v1pb.GetUserStatsRequest{
			Name:   fmt.Sprintf("%s%d", UserNamePrefix, user.ID),
			Filter: request.Filter,
		})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get user stats: %v", err)
		}
		userStatsList = append(userStatsList, userStats)
	}
	return &v1pb.ListAllUserStatsResponse{
		UserStats: userStatsList,
	}, nil
}

func (s *APIV1Service) GetUserStats(ctx context.Context, request *v1pb.GetUserStatsRequest) (*v1pb.UserStats, error) {
	userID, err := ExtractUserIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}
	user, err := s.Store.GetUser(ctx, &store.FindUser{ID: &userID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}

	workspaceMemoRelatedSetting, err := s.Store.GetWorkspaceMemoRelatedSetting(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get workspace memo related setting")
	}
	userStats := &v1pb.UserStats{
		Name:                  fmt.Sprintf("%s%d", UserNamePrefix, user.ID),
		MemoDisplayTimestamps: []*timestamppb.Timestamp{},
		MemoTypeStats:         &v1pb.UserStats_MemoTypeStats{},
		TagCount:              map[string]int32{},
	}
	memoFind := &store.FindMemo{
		// Exclude comments by default.
		ExcludeComments: true,
		ExcludeContent:  true,
	}
	if err := s.buildMemoFindWithFilter(ctx, memoFind, request.Filter); err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "failed to build find memos with filter: %v", err)
	}

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if len(memoFind.VisibilityList) == 0 {
		visibilities := []store.Visibility{store.Public}
		if currentUser != nil {
			visibilities = append(visibilities, store.Protected)
			if currentUser.ID == user.ID {
				visibilities = append(visibilities, store.Private)
			}
		}
		memoFind.VisibilityList = visibilities
	} else {
		if slices.Contains(memoFind.VisibilityList, store.Private) {
			if currentUser == nil || currentUser.ID != user.ID {
				return nil, status.Errorf(codes.PermissionDenied, "permission denied")
			}
		}
		if slices.Contains(memoFind.VisibilityList, store.Protected) {
			if currentUser == nil {
				return nil, status.Errorf(codes.PermissionDenied, "permission denied")
			}
		}
	}

	// Override the creator ID.
	memoFind.CreatorID = &user.ID
	memos, err := s.Store.ListMemos(ctx, memoFind)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memos: %v", err)
	}
	for _, memo := range memos {
		displayTs := memo.CreatedTs
		if workspaceMemoRelatedSetting.DisplayWithUpdateTime {
			displayTs = memo.UpdatedTs
		}
		userStats.MemoDisplayTimestamps = append(userStats.MemoDisplayTimestamps, timestamppb.New(time.Unix(displayTs, 0)))
		// Handle duplicated tags.
		for _, tag := range memo.Payload.Tags {
			userStats.TagCount[tag]++
		}
		if memo.Payload.Property.GetHasLink() {
			userStats.MemoTypeStats.LinkCount++
		}
		if memo.Payload.Property.GetHasCode() {
			userStats.MemoTypeStats.CodeCount++
		}
		if memo.Payload.Property.GetHasTaskList() {
			userStats.MemoTypeStats.TodoCount++
		}
		if memo.Payload.Property.GetHasIncompleteTasks() {
			userStats.MemoTypeStats.UndoCount++
		}
	}
	return userStats, nil
}
