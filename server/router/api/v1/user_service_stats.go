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
	workspaceMemoRelatedSetting, err := s.Store.GetWorkspaceMemoRelatedSetting(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get workspace memo related setting")
	}

	normalStatus := store.Normal
	memoFind := &store.FindMemo{
		// Exclude comments by default.
		ExcludeComments: true,
		ExcludeContent:  true,
		RowStatus:       &normalStatus,
	}

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser == nil {
		memoFind.VisibilityList = []store.Visibility{store.Public}
	} else {
		if memoFind.CreatorID == nil {
			filter := fmt.Sprintf(`creator_id == %d || visibility in ["PUBLIC", "PROTECTED"]`, currentUser.ID)
			memoFind.Filters = append(memoFind.Filters, filter)
		} else if *memoFind.CreatorID != currentUser.ID {
			memoFind.VisibilityList = []store.Visibility{store.Public, store.Protected}
		}
	}
	memos, err := s.Store.ListMemos(ctx, memoFind)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memos: %v", err)
	}

	userMemoStatMap := make(map[int32]*v1pb.UserStats)
	for _, memo := range memos {
		displayTs := memo.CreatedTs
		if workspaceMemoRelatedSetting.DisplayWithUpdateTime {
			displayTs = memo.UpdatedTs
		}
		userMemoStatMap[memo.CreatorID] = &v1pb.UserStats{
			Name: fmt.Sprintf("users/%d/stats", memo.CreatorID),
		}
		userMemoStatMap[memo.CreatorID].MemoDisplayTimestamps = append(userMemoStatMap[memo.CreatorID].MemoDisplayTimestamps, timestamppb.New(time.Unix(displayTs, 0)))
	}

	userMemoStats := []*v1pb.UserStats{}
	for _, userMemoStat := range userMemoStatMap {
		userMemoStats = append(userMemoStats, userMemoStat)
	}

	response := &v1pb.ListAllUserStatsResponse{
		Stats: userMemoStats,
	}
	return response, nil
}

func (s *APIV1Service) GetUserStats(ctx context.Context, request *v1pb.GetUserStatsRequest) (*v1pb.UserStats, error) {
	userID, err := ExtractUserIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}

	normalStatus := store.Normal
	memoFind := &store.FindMemo{
		CreatorID: &userID,
		// Exclude comments by default.
		ExcludeComments: true,
		ExcludeContent:  true,
		RowStatus:       &normalStatus,
	}

	if currentUser == nil {
		memoFind.VisibilityList = []store.Visibility{store.Public}
	} else if currentUser.ID != userID {
		memoFind.VisibilityList = []store.Visibility{store.Public, store.Protected}
	}

	memos, err := s.Store.ListMemos(ctx, memoFind)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memos: %v", err)
	}

	workspaceMemoRelatedSetting, err := s.Store.GetWorkspaceMemoRelatedSetting(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get workspace memo related setting")
	}

	displayTimestamps := []*timestamppb.Timestamp{}
	tagCount := make(map[string]int32)
	linkCount := int32(0)
	codeCount := int32(0)
	todoCount := int32(0)
	undoCount := int32(0)
	pinnedMemos := []string{}

	for _, memo := range memos {
		displayTs := memo.CreatedTs
		if workspaceMemoRelatedSetting.DisplayWithUpdateTime {
			displayTs = memo.UpdatedTs
		}
		displayTimestamps = append(displayTimestamps, timestamppb.New(time.Unix(displayTs, 0)))
		// Count different memo types based on content.
		if memo.Payload != nil {
			for _, tag := range memo.Payload.Tags {
				tagCount[tag]++
			}
			if memo.Payload.Property != nil {
				if memo.Payload.Property.HasLink {
					linkCount++
				}
				if memo.Payload.Property.HasCode {
					codeCount++
				}
				if memo.Payload.Property.HasTaskList {
					todoCount++
				}
				if memo.Payload.Property.HasIncompleteTasks {
					undoCount++
				}
			}
		}
		if memo.Pinned {
			pinnedMemos = append(pinnedMemos, fmt.Sprintf("users/%d/memos/%d", userID, memo.ID))
		}
	}

	userStats := &v1pb.UserStats{
		Name:                  fmt.Sprintf("users/%d/stats", userID),
		MemoDisplayTimestamps: displayTimestamps,
		TagCount:              tagCount,
		PinnedMemos:           pinnedMemos,
		TotalMemoCount:        int32(len(memos)),
		MemoTypeStats: &v1pb.UserStats_MemoTypeStats{
			LinkCount: linkCount,
			CodeCount: codeCount,
			TodoCount: todoCount,
			UndoCount: undoCount,
		},
	}

	return userStats, nil
}
