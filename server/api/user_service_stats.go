package api

import (
	"cmp"
	"context"
	"fmt"
	"slices"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	apipb "github.com/usememos/memos/proto/gen/api"
	"github.com/usememos/memos/store"
)

func (s *APIService) listUsersByID(ctx context.Context, userIDs []int32) (map[int32]*store.User, error) {
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

func (s *APIService) listUsernamesByID(ctx context.Context, userIDs []int32) (map[int32]string, error) {
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

func (s *APIService) ListUserStats(ctx context.Context, request *apipb.ListUserStatsRequest) (*apipb.ListUserStatsResponse, error) {
	// users/- lists every user; users/{user} narrows the list to one creator.
	var creatorID *int32
	if request.Parent != BuildUserName("-") {
		user, err := ResolveUserByName(ctx, s.Store, request.Parent)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid parent: %v", err)
		}
		if user == nil {
			return nil, status.Errorf(codes.NotFound, "user not found")
		}
		creatorID = &user.ID
	}

	rowStatus := convertStateToStore(request.State)
	memoFind := &store.FindMemo{
		CreatorID:      creatorID,
		ExcludeContent: true,
		RowStatus:      &rowStatus,
	}

	accessScope, currentUser, err := s.resolveMemoAccessScope(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "%v", err)
	}

	if request.Filter != "" {
		if err := s.validateMemoFilterForUser(ctx, request.Filter, currentUser); err != nil {
			return nil, err
		}
		memoFind.Filters = append(memoFind.Filters, request.Filter)
	}

	if request.State == apipb.State_ARCHIVED {
		// Archived memos are only visible to their creator.
		if currentUser == nil || (creatorID != nil && *creatorID != currentUser.ID) {
			return &apipb.ListUserStatsResponse{}, nil
		}
		memoFind.CreatorID = &currentUser.ID
	}
	memoFind.Access = accessScope

	userMemoStatMap := make(map[int32]*apipb.UserStats)
	statsMemosByUserID := make(map[int32][]statsMemo)
	limit := 1000
	memoFind.Limit = &limit
	memoFind.OrderByID = true

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
				userMemoStatMap[memo.CreatorID] = &apipb.UserStats{
					Name:                  "",
					TagCounts:             make(map[string]int32),
					MemoCreatedTimestamps: []*timestamppb.Timestamp{},
					MemoUpdatedTimestamps: []*timestamppb.Timestamp{},
					PinnedMemos:           []string{},
					MemoTypeStats: &apipb.UserStats_MemoTypeStats{
						LinkCount: 0,
						CodeCount: 0,
						TodoCount: 0,
						UndoCount: 0,
					},
				}
			}

			stats := userMemoStatMap[memo.CreatorID]
			statsMemosByUserID[memo.CreatorID] = append(statsMemosByUserID[memo.CreatorID], newStatsMemo(memo))

			// Count memo stats
			stats.TotalMemoCount++

			// Count tags and other properties
			if memo.Payload != nil {
				incrementTagCounts(stats.TagCounts, memo.Payload.Tags)
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
		}

		lastID := memos[len(memos)-1].ID
		memoFind.AfterID = &lastID
	}

	userMemoStats := []*apipb.UserStats{}
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
		setStatsMemoLists(userMemoStat, statsMemosByUserID[userID])
		userMemoStats = append(userMemoStats, userMemoStat)
	}

	response := &apipb.ListUserStatsResponse{
		UserStats: userMemoStats,
	}
	return response, nil
}

func (s *APIService) GetUserStats(ctx context.Context, request *apipb.GetUserStatsRequest) (*apipb.UserStats, error) {
	user, err := ResolveUserByName(ctx, s.Store, request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.NotFound, "user not found")
	}
	userID := user.ID

	accessScope, currentUser, err := s.resolveMemoAccessScope(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "%v", err)
	}

	normalStatus := store.Normal
	memoFind := &store.FindMemo{
		CreatorID:      &userID,
		ExcludeContent: true,
		RowStatus:      &normalStatus,
	}

	if request.Filter != "" {
		if err := s.validateMemoFilterForUser(ctx, request.Filter, currentUser); err != nil {
			return nil, err
		}
		memoFind.Filters = append(memoFind.Filters, request.Filter)
	}

	memoFind.Access = accessScope

	statsMemos := []statsMemo{}
	tagCount := make(map[string]int32)
	linkCount := int32(0)
	codeCount := int32(0)
	todoCount := int32(0)
	undoCount := int32(0)
	totalMemoCount := int32(0)

	limit := 1000
	memoFind.Limit = &limit
	memoFind.OrderByID = true

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
			statsMemos = append(statsMemos, newStatsMemo(memo))
			// Count different memo types based on content.
			if memo.Payload != nil {
				incrementTagCounts(tagCount, memo.Payload.Tags)
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
		}

		lastID := memos[len(memos)-1].ID
		memoFind.AfterID = &lastID
	}

	userStats := &apipb.UserStats{
		Name:           fmt.Sprintf("%s/stats", BuildUserName(user.Username)),
		TagCounts:      tagCount,
		TotalMemoCount: totalMemoCount,
		MemoTypeStats: &apipb.UserStats_MemoTypeStats{
			LinkCount: linkCount,
			CodeCount: codeCount,
			TodoCount: todoCount,
			UndoCount: undoCount,
		},
	}
	setStatsMemoLists(userStats, statsMemos)

	if currentUser != nil && currentUser.ID == userID {
		size, err := s.Store.GetAttachmentStorageUsage(ctx, userID)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get attachment storage usage: %v", err)
		}
		userStats.AttachmentStorageBytes = &size
	}

	return userStats, nil
}

// statsMemo is what UserStats lists for each counted memo.
type statsMemo struct {
	id        int32
	uid       string
	createdTs int64
	updatedTs int64
	pinned    bool
}

func newStatsMemo(memo *store.Memo) statsMemo {
	return statsMemo{
		id:        memo.ID,
		uid:       memo.UID,
		createdTs: memo.CreatedTs,
		updatedTs: memo.UpdatedTs,
		pinned:    memo.Pinned,
	}
}

// setStatsMemoLists fills the timestamp and pinned memo lists of stats.
//
// The stats handlers read memos in pages ordered by ID, because each page then
// starts where the last one ended. An OFFSET page makes the database find and
// sort all earlier rows again, so reading every memo took time quadratic in
// the number of memos. The lists keep the order they had with OFFSET paging:
// newest created first, then highest ID first.
func setStatsMemoLists(stats *apipb.UserStats, memos []statsMemo) {
	slices.SortFunc(memos, func(a, b statsMemo) int {
		if c := cmp.Compare(b.createdTs, a.createdTs); c != 0 {
			return c
		}
		return cmp.Compare(b.id, a.id)
	})
	stats.MemoCreatedTimestamps = make([]*timestamppb.Timestamp, 0, len(memos))
	stats.MemoUpdatedTimestamps = make([]*timestamppb.Timestamp, 0, len(memos))
	stats.PinnedMemos = []string{}
	for _, memo := range memos {
		stats.MemoCreatedTimestamps = append(stats.MemoCreatedTimestamps, timestamppb.New(time.Unix(memo.createdTs, 0)))
		stats.MemoUpdatedTimestamps = append(stats.MemoUpdatedTimestamps, timestamppb.New(time.Unix(memo.updatedTs, 0)))
		if memo.pinned {
			stats.PinnedMemos = append(stats.PinnedMemos, MemoNamePrefix+memo.uid)
		}
	}
}

// incrementTagCounts counts each distinct tag at most once for one memo payload.
func incrementTagCounts(counts map[string]int32, tags []string) {
	seen := make(map[string]struct{}, len(tags))
	for _, tag := range tags {
		if _, ok := seen[tag]; ok {
			continue
		}
		seen[tag] = struct{}{}
		counts[tag]++
	}
}
