package test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestGetUserStats_TagCount(t *testing.T) {
	ctx := context.Background()

	// Create test service
	ts := NewTestService(t)
	defer ts.Cleanup()

	// Create a test host user
	user, err := ts.CreateHostUser(ctx, "test-user")
	require.NoError(t, err)

	// Create user context for authentication
	userCtx := ts.CreateUserContext(ctx, user.ID)

	// Create a memo with a single tag
	memo, err := ts.Store.CreateMemo(ctx, &store.Memo{
		UID:        "test-memo-1",
		CreatorID:  user.ID,
		Content:    "This is a test memo with #test tag",
		Visibility: store.Public,
		Payload: &storepb.MemoPayload{
			Tags: []string{"test", "test"},
		},
	})
	require.NoError(t, err)
	require.NotNil(t, memo)

	// Test GetUserStats
	userName := fmt.Sprintf("users/%s", user.Username)
	response, err := ts.Service.GetUserStats(userCtx, &v1pb.GetUserStatsRequest{
		Name: userName,
	})
	require.NoError(t, err)
	require.NotNil(t, response)
	require.Equal(t, fmt.Sprintf("users/%s/stats", user.Username), response.Name)

	// A memo contributes at most once to an exact tag count, even if its payload
	// accidentally contains the same derived membership more than once.
	require.Contains(t, response.TagCount, "test")
	require.Equal(t, int32(1), response.TagCount["test"], "Tag count should be 1 for a single occurrence")

	// Create another memo with the same tag
	memo2, err := ts.Store.CreateMemo(ctx, &store.Memo{
		UID:        "test-memo-2",
		CreatorID:  user.ID,
		Content:    "Another memo with #test tag",
		Visibility: store.Public,
		Payload: &storepb.MemoPayload{
			Tags: []string{"test"},
		},
	})
	require.NoError(t, err)
	require.NotNil(t, memo2)

	// Test GetUserStats again
	response2, err := ts.Service.GetUserStats(userCtx, &v1pb.GetUserStatsRequest{
		Name: userName,
	})
	require.NoError(t, err)
	require.NotNil(t, response2)

	// Check that the tag count is exactly 2, not 3
	require.Contains(t, response2.TagCount, "test")
	require.Equal(t, int32(2), response2.TagCount["test"], "Tag count should be 2 for two occurrences")

	// Test with a new unique tag
	memo3, err := ts.Store.CreateMemo(ctx, &store.Memo{
		UID:        "test-memo-3",
		CreatorID:  user.ID,
		Content:    "Memo with #unique tag",
		Visibility: store.Public,
		Payload: &storepb.MemoPayload{
			Tags: []string{"unique"},
		},
	})
	require.NoError(t, err)
	require.NotNil(t, memo3)

	// Test GetUserStats for the new tag
	response3, err := ts.Service.GetUserStats(userCtx, &v1pb.GetUserStatsRequest{
		Name: userName,
	})
	require.NoError(t, err)
	require.NotNil(t, response3)

	// Check that the unique tag count is exactly 1
	require.Contains(t, response3.TagCount, "unique")
	require.Equal(t, int32(1), response3.TagCount["unique"], "New tag count should be 1 for first occurrence")

	// The original test tag should still be 2
	require.Contains(t, response3.TagCount, "test")
	require.Equal(t, int32(2), response3.TagCount["test"], "Original tag count should remain 2")

	_, err = ts.Service.GetUserStats(userCtx, &v1pb.GetUserStatsRequest{
		Name: "users/1",
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "user not found")
}

func TestGetUserStats_TagCountPreservesExactIdentity(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()
	const (
		composedTag   = "caf\u00e9"
		decomposedTag = "cafe\u0301"
	)

	user, err := ts.CreateHostUser(ctx, "exact-tag-stats-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	_, err = ts.Store.CreateMemo(ctx, &store.Memo{
		UID:        "exact-tag-stats-memo",
		CreatorID:  user.ID,
		Content:    "Exact tag membership fixture",
		Visibility: store.Public,
		Payload: &storepb.MemoPayload{
			Tags: []string{"book", "book/fiction", "book", "Work", "work", composedTag, decomposedTag},
		},
	})
	require.NoError(t, err)

	response, err := ts.Service.GetUserStats(userCtx, &v1pb.GetUserStatsRequest{
		Name: fmt.Sprintf("users/%s", user.Username),
	})
	require.NoError(t, err)
	require.Equal(t, map[string]int32{
		"book":         1,
		"book/fiction": 1,
		"Work":         1,
		"work":         1,
		composedTag:    1,
		decomposedTag:  1,
	}, response.TagCount)
}

func TestGetUserStats_MemoUpdatedTimestamps(t *testing.T) {
	ctx := context.Background()

	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateHostUser(ctx, "ts-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	memo, err := ts.Store.CreateMemo(ctx, &store.Memo{
		UID:        "ts-memo-1",
		CreatorID:  user.ID,
		Content:    "first content",
		Visibility: store.Public,
	})
	require.NoError(t, err)
	require.NotNil(t, memo)

	// SQLite UpdateMemo only sets fields explicitly passed (created_ts default
	// fires on INSERT only). So bump updated_ts explicitly to simulate an edit
	// happening after creation.
	newContent := "second content"
	newUpdatedTs := memo.UpdatedTs + 100
	require.NoError(t, ts.Store.UpdateMemo(ctx, &store.UpdateMemo{
		ID:        memo.ID,
		Content:   &newContent,
		UpdatedTs: &newUpdatedTs,
	}))

	userName := fmt.Sprintf("users/%s", user.Username)
	resp, err := ts.Service.GetUserStats(userCtx, &v1pb.GetUserStatsRequest{Name: userName})
	require.NoError(t, err)
	require.NotNil(t, resp)

	require.Len(t, resp.MemoCreatedTimestamps, 1, "should have one created timestamp")
	require.Len(t, resp.MemoUpdatedTimestamps, 1, "should have one updated timestamp")

	require.Equal(t, memo.CreatedTs, resp.MemoCreatedTimestamps[0].AsTime().Unix())
	require.Equal(t, newUpdatedTs, resp.MemoUpdatedTimestamps[0].AsTime().Unix())
	require.Greater(
		t,
		resp.MemoUpdatedTimestamps[0].AsTime().Unix(),
		resp.MemoCreatedTimestamps[0].AsTime().Unix(),
		"updated_ts should be after created_ts after an edit",
	)
}

func TestGetUserStats_PinnedMemoUsesCanonicalResourceName(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateHostUser(ctx, "pinned-stats-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)
	memo, err := ts.Store.CreateMemo(ctx, &store.Memo{
		UID:        "pinned-stats-memo",
		CreatorID:  user.ID,
		Content:    "pinned",
		Visibility: store.Public,
	})
	require.NoError(t, err)
	pinned := true
	require.NoError(t, ts.Store.UpdateMemo(ctx, &store.UpdateMemo{ID: memo.ID, Pinned: &pinned}))

	resp, err := ts.Service.GetUserStats(userCtx, &v1pb.GetUserStatsRequest{Name: fmt.Sprintf("users/%s", user.Username)})
	require.NoError(t, err)
	require.Equal(t, []string{"memos/pinned-stats-memo"}, resp.PinnedMemos)
}

func TestListAllUserStats_FilterExcludesPrivateMemos(t *testing.T) {
	ctx := context.Background()

	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateHostUser(ctx, "stats-filter-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	_, err = ts.Store.CreateMemo(ctx, &store.Memo{
		UID:        "stats-filter-public",
		CreatorID:  user.ID,
		Content:    "public memo",
		Visibility: store.Public,
		Payload:    &storepb.MemoPayload{Tags: []string{"public", "public"}},
	})
	require.NoError(t, err)
	_, err = ts.Store.CreateMemo(ctx, &store.Memo{
		UID:        "stats-filter-private",
		CreatorID:  user.ID,
		Content:    "private memo",
		Visibility: store.Private,
		Payload:    &storepb.MemoPayload{Tags: []string{"private", "private"}},
	})
	require.NoError(t, err)

	unfilteredResp, err := ts.Service.ListAllUserStats(userCtx, &v1pb.ListAllUserStatsRequest{})
	require.NoError(t, err)
	require.Len(t, unfilteredResp.Stats, 1)
	require.Equal(t, int32(1), unfilteredResp.Stats[0].TagCount["public"])
	require.Equal(t, int32(1), unfilteredResp.Stats[0].TagCount["private"])

	filteredResp, err := ts.Service.ListAllUserStats(userCtx, &v1pb.ListAllUserStatsRequest{
		Filter: `visibility in ["PUBLIC", "PROTECTED"]`,
	})
	require.NoError(t, err)
	require.Len(t, filteredResp.Stats, 1)
	require.Equal(t, int32(1), filteredResp.Stats[0].TagCount["public"])
	require.NotContains(t, filteredResp.Stats[0].TagCount, "private")
}

func TestUserStatsUseMemoLocalAccess(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "stats-access-owner")
	require.NoError(t, err)
	member, err := ts.CreateRegularUser(ctx, "stats-access-member")
	require.NoError(t, err)
	applicationAdmin, err := ts.CreateHostUser(ctx, "stats-access-app-admin")
	require.NoError(t, err)

	space, err := ts.Store.CreateSpace(ctx, &store.Space{
		UID:   "stats-access-space",
		Title: "Stats access",
	}, owner.ID)
	require.NoError(t, err)
	_, err = ts.Store.CreateSpaceMember(ctx, &store.SpaceMember{
		SpaceID: space.ID,
		UserID:  member.ID,
		Role:    store.SpaceMemberRoleUser,
	}, owner.ID)
	require.NoError(t, err)

	fixtures := []struct {
		uid        string
		visibility store.Visibility
		spaceID    *int32
		tag        string
	}{
		{uid: "stats-access-public", visibility: store.Public, tag: "public"},
		{uid: "stats-access-protected", visibility: store.Protected, tag: "protected"},
		{uid: "stats-access-private", visibility: store.Private, tag: "private"},
		{uid: "stats-access-members", visibility: store.SpaceAudience, spaceID: &space.ID, tag: "space"},
	}
	for _, fixture := range fixtures {
		_, err := ts.Store.CreateMemo(ctx, &store.Memo{
			UID:        fixture.uid,
			CreatorID:  owner.ID,
			Content:    fixture.tag,
			Visibility: fixture.visibility,
			SpaceID:    fixture.spaceID,
			Payload:    &storepb.MemoPayload{Tags: []string{fixture.tag}},
		})
		require.NoError(t, err)
	}

	ownerName := fmt.Sprintf("users/%s", owner.Username)
	tests := []struct {
		name       string
		requestCtx context.Context
		wantTags   []string
		denyTags   []string
	}{
		{
			name:       "owner",
			requestCtx: ts.CreateUserContext(ctx, owner.ID),
			wantTags:   []string{"public", "protected", "private", "space"},
		},
		{
			name:       "space member",
			requestCtx: ts.CreateUserContext(ctx, member.ID),
			wantTags:   []string{"public", "protected", "space"},
			denyTags:   []string{"private"},
		},
		{
			name:       "nonmember application admin",
			requestCtx: ts.CreateUserContext(ctx, applicationAdmin.ID),
			wantTags:   []string{"public", "protected"},
			denyTags:   []string{"private", "space"},
		},
		{
			name:       "anonymous",
			requestCtx: ctx,
			wantTags:   []string{"public"},
			denyTags:   []string{"protected", "private", "space"},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			response, err := ts.Service.GetUserStats(test.requestCtx, &v1pb.GetUserStatsRequest{Name: ownerName})
			require.NoError(t, err)
			require.Equal(t, int32(len(test.wantTags)), response.TotalMemoCount)
			for _, tag := range test.wantTags {
				require.Equal(t, int32(1), response.TagCount[tag], "expected tag %q to be visible", tag)
			}
			for _, tag := range test.denyTags {
				require.NotContains(t, response.TagCount, tag)
			}
		})
	}

	memberStats, err := ts.Service.ListAllUserStats(ts.CreateUserContext(ctx, member.ID), &v1pb.ListAllUserStatsRequest{})
	require.NoError(t, err)
	require.Len(t, memberStats.Stats, 1)
	require.Equal(t, int32(3), memberStats.Stats[0].TotalMemoCount)
	require.Contains(t, memberStats.Stats[0].TagCount, "space")
	require.NotContains(t, memberStats.Stats[0].TagCount, "private")
}

func TestUserStatsSpaceFilter(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "stats-scope-owner")
	require.NoError(t, err)
	member, err := ts.CreateRegularUser(ctx, "stats-scope-member")
	require.NoError(t, err)
	outsider, err := ts.CreateRegularUser(ctx, "stats-scope-outsider")
	require.NoError(t, err)

	spaceA, err := ts.Store.CreateSpace(ctx, &store.Space{UID: "stats-scope-a", Title: "A"}, owner.ID)
	require.NoError(t, err)
	_, err = ts.Store.CreateSpaceMember(ctx, &store.SpaceMember{
		SpaceID: spaceA.ID,
		UserID:  member.ID,
		Role:    store.SpaceMemberRoleUser,
	}, owner.ID)
	require.NoError(t, err)
	spaceB, err := ts.Store.CreateSpace(ctx, &store.Space{UID: "stats-scope-b", Title: "B"}, owner.ID)
	require.NoError(t, err)

	spaceAName := "spaces/" + spaceA.UID
	fixtures := []struct {
		uid        string
		creatorID  int32
		visibility store.Visibility
		spaceID    *int32
		tag        string
	}{
		{uid: "stats-scope-unassigned", creatorID: owner.ID, visibility: store.Public, tag: "unassigned"},
		{uid: "stats-scope-a-members", creatorID: owner.ID, visibility: store.SpaceAudience, spaceID: &spaceA.ID, tag: "a-members"},
		{uid: "stats-scope-a-private", creatorID: owner.ID, visibility: store.Private, spaceID: &spaceA.ID, tag: "a-private"},
		{uid: "stats-scope-a-member-private", creatorID: member.ID, visibility: store.Private, spaceID: &spaceA.ID, tag: "member-private"},
		{uid: "stats-scope-b-public", creatorID: owner.ID, visibility: store.Public, spaceID: &spaceB.ID, tag: "b-public"},
	}
	for _, fixture := range fixtures {
		_, err := ts.Store.CreateMemo(ctx, &store.Memo{
			UID:        fixture.uid,
			CreatorID:  fixture.creatorID,
			Content:    fixture.tag,
			Visibility: fixture.visibility,
			SpaceID:    fixture.spaceID,
			Payload:    &storepb.MemoPayload{Tags: []string{fixture.tag}},
		})
		require.NoError(t, err)
	}

	ownerName := fmt.Sprintf("users/%s", owner.Username)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)
	ownerSpaceStats, err := ts.Service.GetUserStats(ownerCtx, &v1pb.GetUserStatsRequest{
		Name:   ownerName,
		Filter: fmt.Sprintf(`space == %q`, spaceAName),
	})
	require.NoError(t, err)
	require.Equal(t, int32(2), ownerSpaceStats.TotalMemoCount)
	require.Contains(t, ownerSpaceStats.TagCount, "a-members")
	require.Contains(t, ownerSpaceStats.TagCount, "a-private")
	require.NotContains(t, ownerSpaceStats.TagCount, "unassigned")
	require.NotContains(t, ownerSpaceStats.TagCount, "b-public")

	ownerUnassignedStats, err := ts.Service.GetUserStats(ownerCtx, &v1pb.GetUserStatsRequest{
		Name:   ownerName,
		Filter: `space == null`,
	})
	require.NoError(t, err)
	require.Equal(t, int32(1), ownerUnassignedStats.TotalMemoCount)
	require.Contains(t, ownerUnassignedStats.TagCount, "unassigned")

	memberSpaceStats, err := ts.Service.ListAllUserStats(ts.CreateUserContext(ctx, member.ID), &v1pb.ListAllUserStatsRequest{
		Filter: fmt.Sprintf(`space == %q`, spaceAName),
	})
	require.NoError(t, err)
	require.Len(t, memberSpaceStats.Stats, 2)
	visibleTags := map[string]int32{}
	for _, stats := range memberSpaceStats.Stats {
		for tag, count := range stats.TagCount {
			visibleTags[tag] += count
		}
	}
	require.Equal(t, map[string]int32{"a-members": 1, "member-private": 1}, visibleTags)

	_, err = ts.Service.ListAllUserStats(ts.CreateUserContext(ctx, outsider.ID), &v1pb.ListAllUserStatsRequest{
		Filter: fmt.Sprintf(`space == %q`, spaceAName),
	})
	require.Equal(t, codes.NotFound, status.Code(err))

	_, err = ts.Service.ListAllUserStats(ctx, &v1pb.ListAllUserStatsRequest{
		Filter: fmt.Sprintf(`space == %q`, spaceAName),
	})
	require.Equal(t, codes.Unauthenticated, status.Code(err))

	_, err = ts.Service.GetUserStats(ownerCtx, &v1pb.GetUserStatsRequest{
		Name:   ownerName,
		Filter: `space != null`,
	})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
}
