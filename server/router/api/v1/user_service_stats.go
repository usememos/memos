package v1

import (
	"context"
	"fmt"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) ListAllUserStats(ctx context.Context, _ *v1pb.ListAllUserStatsRequest) (*v1pb.ListAllUserStatsResponse, error) {
	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	visibilities := []store.Visibility{store.Public}
	if currentUser != nil {
		visibilities = append(visibilities, store.Protected)
	}

	workspaceMemoRelatedSetting, err := s.Store.GetWorkspaceMemoRelatedSetting(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get workspace memo related setting")
	}

	normalStatus := store.Normal
	memoFind := &store.FindMemo{
		// Exclude comments by default.
		ExcludeComments: true,
		ExcludeContent:  true,
		VisibilityList:  visibilities,
		RowStatus:       &normalStatus,
	}
	memos, err := s.Store.ListMemos(ctx, memoFind)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memos: %v", err)
	}
	userStatsMap := map[string]*v1pb.UserStats{}
	for _, memo := range memos {
		creator := fmt.Sprintf("%s%d", UserNamePrefix, memo.CreatorID)
		if _, ok := userStatsMap[creator]; !ok {
			userStatsMap[creator] = &v1pb.UserStats{
				Name:                  creator,
				MemoDisplayTimestamps: []*timestamppb.Timestamp{},
				MemoTypeStats:         &v1pb.UserStats_MemoTypeStats{},
				TagCount:              map[string]int32{},
			}
		}
		displayTs := memo.CreatedTs
		if workspaceMemoRelatedSetting.DisplayWithUpdateTime {
			displayTs = memo.UpdatedTs
		}
		userStats := userStatsMap[creator]
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
	userStatsList := []*v1pb.UserStats{}
	for _, userStats := range userStatsMap {
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

	normalStatus := store.Normal
	memoFind := &store.FindMemo{
		// Exclude comments by default.
		ExcludeComments: true,
		ExcludeContent:  true,
		CreatorID:       &userID,
		RowStatus:       &normalStatus,
	}

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	visibilities := []store.Visibility{store.Public}
	if currentUser != nil {
		visibilities = append(visibilities, store.Protected)
		if currentUser.ID == user.ID {
			visibilities = append(visibilities, store.Private)
		}
	}
	memoFind.VisibilityList = visibilities
	memos, err := s.Store.ListMemos(ctx, memoFind)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memos: %v", err)
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
