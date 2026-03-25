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

func (s *APIV1Service) listUsersByID(ctx context.Context, userIDs []int32) (map[int32]*store.User, error) {
	if len(userIDs) == 0 {
		return map[int32]*store.User{}, nil
	}

	uniqueUserIDs := make([]int32, 0, len(userIDs))
	seenUserIDs := make(map[int32]struct{}, len(userIDs))
	for _, userID := range userIDs {
		if _, seen := seenUserIDs[userID]; seen {
			continue
		}
		seenUserIDs[userID] = struct{}{}
		uniqueUserIDs = append(uniqueUserIDs, userID)
	}

	users, err := s.Store.ListUsers(ctx, &store.FindUser{IDList: uniqueUserIDs})
	if err != nil {
		return nil, err
	}

	usersByID := make(map[int32]*store.User, len(users))
	for _, user := range users {
		usersByID[user.ID] = user
	}
	return usersByID, nil
}

func (s *APIV1Service) listUsernamesByID(ctx context.Context, userIDs []int32) (map[int32]string, error) {
	usersByID, err := s.listUsersByID(ctx, userIDs)
	if err != nil {
		return nil, err
	}

	usernamesByID := make(map[int32]string, len(usersByID))
	for _, user := range usersByID {
		usernamesByID[user.ID] = user.Username
	}
	return usernamesByID, nil
}

func (s *APIV1Service) ListAllUserStats(ctx context.Context, _ *v1pb.ListAllUserStatsRequest) (*v1pb.ListAllUserStatsResponse, error) {
	instanceMemoRelatedSetting, err := s.Store.GetInstanceMemoRelatedSetting(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get instance memo related setting")
	}

	normalStatus := store.Normal
	memoFind := &store.FindMemo{
		// Exclude comments by default.
		ExcludeComments: true,
		ExcludeContent:  true,
		RowStatus:       &normalStatus,
	}

	currentUser, err := s.fetchCurrentUser(ctx)
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

	userMemoStatMap := make(map[int32]*v1pb.UserStats)
	pinnedMemoIDsByUserID := make(map[int32][]int32)
	limit := 1000
	offset := 0
	memoFind.Limit = &limit
	memoFind.Offset = &offset

	for {
		memos, err := s.Store.ListMemos(ctx, memoFind)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to list memos: %v", err)
		}
		if len(memos) == 0 {
			break
		}

		for _, memo := range memos {
			// Initialize user stats if not exists
			if _, exists := userMemoStatMap[memo.CreatorID]; !exists {
				userMemoStatMap[memo.CreatorID] = &v1pb.UserStats{
					Name:                  "",
					TagCount:              make(map[string]int32),
					MemoDisplayTimestamps: []*timestamppb.Timestamp{},
					PinnedMemos:           []string{},
					MemoTypeStats: &v1pb.UserStats_MemoTypeStats{
						LinkCount: 0,
						CodeCount: 0,
						TodoCount: 0,
						UndoCount: 0,
					},
				}
			}

			stats := userMemoStatMap[memo.CreatorID]

			// Add display timestamp
			displayTs := memo.CreatedTs
			if instanceMemoRelatedSetting.DisplayWithUpdateTime {
				displayTs = memo.UpdatedTs
			}
			stats.MemoDisplayTimestamps = append(stats.MemoDisplayTimestamps, timestamppb.New(time.Unix(displayTs, 0)))

			// Count memo stats
			stats.TotalMemoCount++

			// Count tags and other properties
			if memo.Payload != nil {
				for _, tag := range memo.Payload.Tags {
					stats.TagCount[tag]++
				}
				if memo.Payload.Property != nil {
					if memo.Payload.Property.HasLink {
						stats.MemoTypeStats.LinkCount++
					}
					if memo.Payload.Property.HasCode {
						stats.MemoTypeStats.CodeCount++
					}
					if memo.Payload.Property.HasTaskList {
						stats.MemoTypeStats.TodoCount++
					}
					if memo.Payload.Property.HasIncompleteTasks {
						stats.MemoTypeStats.UndoCount++
					}
				}
			}

			// Track pinned memos
			if memo.Pinned {
				pinnedMemoIDsByUserID[memo.CreatorID] = append(pinnedMemoIDsByUserID[memo.CreatorID], memo.ID)
			}
		}

		offset += limit
	}

	userMemoStats := []*v1pb.UserStats{}
	userIDs := make([]int32, 0, len(userMemoStatMap))
	for userID := range userMemoStatMap {
		userIDs = append(userIDs, userID)
	}
	usernamesByID, err := s.listUsernamesByID(ctx, userIDs)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list users: %v", err)
	}
	for userID, userMemoStat := range userMemoStatMap {
		username, ok := usernamesByID[userID]
		if !ok {
			return nil, status.Errorf(codes.Internal, "failed to resolve user stats name")
		}
		userMemoStat.Name = fmt.Sprintf("%s/stats", BuildUserName(username))
		for _, memoID := range pinnedMemoIDsByUserID[userID] {
			userMemoStat.PinnedMemos = append(userMemoStat.PinnedMemos, fmt.Sprintf("%s/memos/%d", BuildUserName(username), memoID))
		}
		userMemoStats = append(userMemoStats, userMemoStat)
	}

	response := &v1pb.ListAllUserStatsResponse{
		Stats: userMemoStats,
	}
	return response, nil
}

func (s *APIV1Service) GetUserStats(ctx context.Context, request *v1pb.GetUserStatsRequest) (*v1pb.UserStats, error) {
	user, err := ResolveUserByName(ctx, s.Store, request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.NotFound, "user not found")
	}
	userID := user.ID

	currentUser, err := s.fetchCurrentUser(ctx)
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

	instanceMemoRelatedSetting, err := s.Store.GetInstanceMemoRelatedSetting(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get instance memo related setting")
	}

	displayTimestamps := []*timestamppb.Timestamp{}
	tagCount := make(map[string]int32)
	linkCount := int32(0)
	codeCount := int32(0)
	todoCount := int32(0)
	undoCount := int32(0)
	pinnedMemos := []string{}
	totalMemoCount := int32(0)

	limit := 1000
	offset := 0
	memoFind.Limit = &limit
	memoFind.Offset = &offset

	for {
		memos, err := s.Store.ListMemos(ctx, memoFind)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to list memos: %v", err)
		}
		if len(memos) == 0 {
			break
		}

		totalMemoCount += int32(len(memos))

		for _, memo := range memos {
			displayTs := memo.CreatedTs
			if instanceMemoRelatedSetting.DisplayWithUpdateTime {
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
				pinnedMemos = append(pinnedMemos, fmt.Sprintf("%s/memos/%d", BuildUserName(user.Username), memo.ID))
			}
		}

		offset += limit
	}

	userStats := &v1pb.UserStats{
		Name:                  fmt.Sprintf("%s/stats", BuildUserName(user.Username)),
		MemoDisplayTimestamps: displayTimestamps,
		TagCount:              tagCount,
		PinnedMemos:           pinnedMemos,
		TotalMemoCount:        totalMemoCount,
		MemoTypeStats: &v1pb.UserStats_MemoTypeStats{
			LinkCount: linkCount,
			CodeCount: codeCount,
			TodoCount: todoCount,
			UndoCount: undoCount,
		},
	}

	return userStats, nil
}
