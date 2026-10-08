package test

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	apipb "github.com/usememos/memos/proto/gen/api"
	"github.com/usememos/memos/store"
)

func TestMemoReactionResourceNames(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "reaction-resource-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)
	memo, err := ts.Service.CreateMemo(userCtx, &apipb.CreateMemoRequest{
		MemoId: "reaction-resource-memo",
		Memo: &apipb.Memo{
			Content:    "reaction resource names",
			Visibility: apipb.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	reaction, err := ts.Service.UpsertMemoReaction(userCtx, &apipb.UpsertMemoReactionRequest{
		Parent: memo.Name,
		Reaction: &apipb.Reaction{
			ReactionType: "👍",
		},
	})
	require.NoError(t, err)
	require.True(t, strings.HasPrefix(reaction.Name, memo.Name+"/reactions/"))

	memoID := parseMemoIDFromNameForTest(t, ts, memo.Name)
	storedReaction, err := ts.Store.GetReaction(ctx, &store.FindReaction{MemoID: &memoID, CreatorID: &user.ID})
	require.NoError(t, err)
	require.NotNil(t, storedReaction)
	require.Equal(t, memoID, storedReaction.MemoID)

	listed, err := ts.Service.ListMemoReactions(ctx, &apipb.ListMemoReactionsRequest{Parent: memo.Name})
	require.NoError(t, err)
	require.Len(t, listed.Reactions, 1)
	require.Equal(t, reaction.Name, listed.Reactions[0].Name)

	fetchedMemo, err := ts.Service.GetMemo(ctx, &apipb.GetMemoRequest{Name: memo.Name})
	require.NoError(t, err)
	require.Len(t, fetchedMemo.Reactions, 1)
	require.Equal(t, reaction.Name, fetchedMemo.Reactions[0].Name)
}

func TestUpsertMemoReactionRequiresReaction(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "reaction-required-user")
	require.NoError(t, err)
	_, err = ts.Service.UpsertMemoReaction(ts.CreateUserContext(ctx, user.ID), &apipb.UpsertMemoReactionRequest{
		Parent: "memos/missing",
	})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
}

func TestListMemoCommentsIncludesReactionResourceNames(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "comment-reaction-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)
	parent, err := ts.Service.CreateMemo(userCtx, &apipb.CreateMemoRequest{
		Memo: &apipb.Memo{Content: "parent", Visibility: apipb.Visibility_PUBLIC},
	})
	require.NoError(t, err)
	comment, err := ts.Service.CreateMemoComment(userCtx, &apipb.CreateMemoCommentRequest{
		Parent:  parent.Name,
		Comment: &apipb.Memo{Content: "comment", Visibility: apipb.Visibility_PUBLIC},
	})
	require.NoError(t, err)

	_, err = ts.Service.UpsertMemoReaction(userCtx, &apipb.UpsertMemoReactionRequest{
		Parent: comment.Name,
		Reaction: &apipb.Reaction{
			ReactionType: "🔥",
		},
	})
	require.NoError(t, err)

	comments, err := ts.Service.ListMemoComments(userCtx, &apipb.ListMemoCommentsRequest{Parent: parent.Name})
	require.NoError(t, err)
	require.Len(t, comments.Comments, 1)
	require.Len(t, comments.Comments[0].Reactions, 1)
	require.True(t, strings.HasPrefix(comments.Comments[0].Reactions[0].Name, comment.Name+"/reactions/"))
}

func TestUpsertMemoReactionRevalidatesSpaceParticipation(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "reaction-space-owner")
	require.NoError(t, err)
	member, err := ts.CreateRegularUser(ctx, "reaction-space-member")
	require.NoError(t, err)
	applicationAdmin, err := ts.CreateHostUser(ctx, "reaction-space-application-admin")
	require.NoError(t, err)
	memberCtx := ts.CreateUserContext(ctx, member.ID)
	adminCtx := ts.CreateUserContext(ctx, applicationAdmin.ID)

	space, err := ts.Store.CreateSpace(ctx, &store.Space{UID: "reaction-space", Title: "Reaction Space"}, owner.ID)
	require.NoError(t, err)
	_, err = ts.InviteAndAcceptSpaceMember(ctx, &store.SpaceMember{
		SpaceID: space.ID,
		UserID:  member.ID,
		Role:    store.SpaceMemberRoleUser,
	}, owner.ID)
	require.NoError(t, err)
	root, err := ts.Store.CreateMemo(ctx, &store.Memo{
		UID:        "reaction-space-root",
		CreatorID:  owner.ID,
		Content:    "assigned public memo",
		Visibility: store.Public,
		SpaceID:    &space.ID,
	})
	require.NoError(t, err)
	memoName := "memos/" + root.UID

	memberReaction, err := ts.Service.UpsertMemoReaction(memberCtx, &apipb.UpsertMemoReactionRequest{
		Parent:   memoName,
		Reaction: &apipb.Reaction{ReactionType: "👍"},
	})
	require.NoError(t, err)

	// An application ADMIN is the superuser and participates without membership.
	adminReaction, err := ts.Service.UpsertMemoReaction(adminCtx, &apipb.UpsertMemoReactionRequest{
		Parent:   memoName,
		Reaction: &apipb.Reaction{ReactionType: "🔥"},
	})
	require.NoError(t, err)
	_, err = ts.Service.DeleteMemoReaction(adminCtx, &apipb.DeleteMemoReactionRequest{Name: adminReaction.Name})
	require.NoError(t, err)

	require.NoError(t, ts.Store.DeleteSpaceMember(ctx, &store.DeleteSpaceMember{SpaceID: space.ID, UserID: member.ID}, owner.ID))
	_, err = ts.Service.DeleteMemoReaction(memberCtx, &apipb.DeleteMemoReactionRequest{Name: memberReaction.Name})
	require.NoError(t, err, "the creator may withdraw a reaction after leaving")
	_, err = ts.Service.UpsertMemoReaction(memberCtx, &apipb.UpsertMemoReactionRequest{
		Parent:   memoName,
		Reaction: &apipb.Reaction{ReactionType: "🔥"},
	})
	require.Equal(t, codes.PermissionDenied, status.Code(err))

	_, err = ts.InviteAndAcceptSpaceMember(ctx, &store.SpaceMember{
		SpaceID: space.ID,
		UserID:  member.ID,
		Role:    store.SpaceMemberRoleUser,
	}, owner.ID)
	require.NoError(t, err)

	_, err = ts.Service.UpsertMemoReaction(memberCtx, &apipb.UpsertMemoReactionRequest{
		Parent:   memoName,
		Reaction: &apipb.Reaction{ReactionType: "🔥"},
	})
	require.NoError(t, err)

	reactions, err := ts.Store.ListReactions(ctx, &store.FindReaction{MemoID: &root.ID})
	require.NoError(t, err)
	require.Len(t, reactions, 1)
}

func TestAssignedMemoReactionsFollowMemoReadAccess(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "assigned-reaction-owner")
	require.NoError(t, err)
	member, err := ts.CreateRegularUser(ctx, "assigned-reaction-member")
	require.NoError(t, err)
	outsider, err := ts.CreateRegularUser(ctx, "assigned-reaction-outsider")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)
	memberCtx := ts.CreateUserContext(ctx, member.ID)
	outsiderCtx := ts.CreateUserContext(ctx, outsider.ID)

	space, err := ts.Store.CreateSpace(ctx, &store.Space{UID: "assigned-reaction-space", Title: "Assigned reactions"}, owner.ID)
	require.NoError(t, err)
	_, err = ts.InviteAndAcceptSpaceMember(ctx, &store.SpaceMember{
		SpaceID: space.ID,
		UserID:  member.ID,
		Role:    store.SpaceMemberRoleAdmin,
	}, owner.ID)
	require.NoError(t, err)
	memo, err := ts.Service.CreateMemo(ownerCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{
		Content:    "assigned public memo with reactions",
		Visibility: apipb.Visibility_PUBLIC,
		Space:      ptr("spaces/" + space.UID),
	}})
	require.NoError(t, err)
	_, err = ts.Service.UpsertMemoReaction(ownerCtx, &apipb.UpsertMemoReactionRequest{
		Parent:   memo.Name,
		Reaction: &apipb.Reaction{ReactionType: "👍"},
	})
	require.NoError(t, err)

	listed, err := ts.Service.ListMemoReactions(memberCtx, &apipb.ListMemoReactionsRequest{Parent: memo.Name})
	require.NoError(t, err)
	require.Len(t, listed.Reactions, 1)

	listed, err = ts.Service.ListMemoReactions(ctx, &apipb.ListMemoReactionsRequest{Parent: memo.Name})
	require.NoError(t, err)
	require.Len(t, listed.Reactions, 1, "anonymous reaction reads follow the PUBLIC memo audience")
	listed, err = ts.Service.ListMemoReactions(outsiderCtx, &apipb.ListMemoReactionsRequest{Parent: memo.Name})
	require.NoError(t, err)
	require.Len(t, listed.Reactions, 1, "Space placement adds no reaction read gate")

	got, err := ts.Service.GetMemo(outsiderCtx, &apipb.GetMemoRequest{Name: memo.Name})
	require.NoError(t, err, "a non-member may still read an assigned PUBLIC memo")
	require.Empty(t, got.GetSpace())
	require.Len(t, got.Reactions, 1, "embedded reactions follow the readable memo")
	feed, err := ts.Service.ListMemos(outsiderCtx, &apipb.ListMemosRequest{PageSize: 20})
	require.NoError(t, err)
	var listedMemo *apipb.Memo
	for _, candidate := range feed.Memos {
		if candidate.Name == memo.Name {
			listedMemo = candidate
			break
		}
	}
	require.NotNil(t, listedMemo)
	require.Len(t, listedMemo.Reactions, 1)

	require.NoError(t, ts.Store.DeleteSpaceMember(ctx, &store.DeleteSpaceMember{SpaceID: space.ID, UserID: owner.ID}, owner.ID))
	listed, err = ts.Service.ListMemoReactions(ownerCtx, &apipb.ListMemoReactionsRequest{Parent: memo.Name})
	require.NoError(t, err)
	require.Len(t, listed.Reactions, 1, "the removed author still reads a PUBLIC memo and its reactions")
	got, err = ts.Service.GetMemo(ownerCtx, &apipb.GetMemoRequest{Name: memo.Name})
	require.NoError(t, err)
	require.Equal(t, "spaces/"+space.UID, got.GetSpace(), "the author may still see placement")
	require.Len(t, got.Reactions, 1)
}

func TestDeleteMemoReaction(t *testing.T) {
	ctx := context.Background()

	t.Run("DeleteMemoReaction success by reaction owner", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user
		user, err := ts.CreateRegularUser(ctx, "user")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		// Create memo
		memo, err := ts.Service.CreateMemo(userCtx, &apipb.CreateMemoRequest{
			Memo: &apipb.Memo{
				Content:    "Test memo",
				Visibility: apipb.Visibility_PUBLIC,
			},
		})
		require.NoError(t, err)
		require.NotNil(t, memo)

		// Create reaction
		reaction, err := ts.Service.UpsertMemoReaction(userCtx, &apipb.UpsertMemoReactionRequest{
			Parent: memo.Name,
			Reaction: &apipb.Reaction{
				ReactionType: "👍",
			},
		})
		require.NoError(t, err)
		require.NotNil(t, reaction)
		require.Equal(t, "users/user", reaction.Creator)

		// Delete reaction - should succeed
		_, err = ts.Service.DeleteMemoReaction(userCtx, &apipb.DeleteMemoReactionRequest{
			Name: reaction.Name,
		})
		require.NoError(t, err)
	})

	t.Run("DeleteMemoReaction fails closed when memo was concurrently deleted", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "concurrent-delete-user")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)
		memo, err := ts.Service.CreateMemo(userCtx, &apipb.CreateMemoRequest{
			Memo: &apipb.Memo{Content: "concurrent delete", Visibility: apipb.Visibility_PUBLIC},
		})
		require.NoError(t, err)
		reaction, err := ts.Service.UpsertMemoReaction(userCtx, &apipb.UpsertMemoReactionRequest{
			Parent: memo.Name,
			Reaction: &apipb.Reaction{
				ReactionType: "👍",
			},
		})
		require.NoError(t, err)

		memoID := parseMemoIDFromNameForTest(t, ts, memo.Name)
		storedReaction, err := ts.Store.GetReaction(ctx, &store.FindReaction{MemoID: &memoID, CreatorID: &user.ID})
		require.NoError(t, err)
		require.NotNil(t, storedReaction)
		// Simulate the state visible between DeleteMemoReaction's reaction and
		// memo reads after a concurrent memo deletion commits.
		_, err = ts.Store.GetDriver().GetDB().ExecContext(ctx, "DELETE FROM memo WHERE id = ?", memoID)
		require.NoError(t, err)

		_, err = ts.Service.DeleteMemoReaction(userCtx, &apipb.DeleteMemoReactionRequest{Name: reaction.Name})
		require.Equal(t, codes.PermissionDenied, status.Code(err))
		remainingReaction, err := ts.Store.GetReaction(ctx, &store.FindReaction{ID: &storedReaction.ID})
		require.NoError(t, err)
		require.NotNil(t, remainingReaction, "a missing direct memo must not authorize a reaction mutation")
	})

	t.Run("DeleteMemoReaction host user has no ownership bypass", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create regular user
		regularUser, err := ts.CreateRegularUser(ctx, "user")
		require.NoError(t, err)
		regularUserCtx := ts.CreateUserContext(ctx, regularUser.ID)

		// Create host user
		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		hostCtx := ts.CreateUserContext(ctx, hostUser.ID)

		// Create memo by regular user
		memo, err := ts.Service.CreateMemo(regularUserCtx, &apipb.CreateMemoRequest{
			Memo: &apipb.Memo{
				Content:    "Test memo",
				Visibility: apipb.Visibility_PUBLIC,
			},
		})
		require.NoError(t, err)
		require.NotNil(t, memo)

		// Create reaction by regular user
		reaction, err := ts.Service.UpsertMemoReaction(regularUserCtx, &apipb.UpsertMemoReactionRequest{
			Parent: memo.Name,
			Reaction: &apipb.Reaction{
				ReactionType: "👍",
			},
		})
		require.NoError(t, err)
		require.NotNil(t, reaction)

		// Application ADMIN is the superuser and may withdraw any reaction.
		_, err = ts.Service.DeleteMemoReaction(hostCtx, &apipb.DeleteMemoReactionRequest{
			Name: reaction.Name,
		})
		require.NoError(t, err)
		memoID := parseMemoIDFromNameForTest(t, ts, memo.Name)
		remainingReaction, err := ts.Store.GetReaction(ctx, &store.FindReaction{MemoID: &memoID, CreatorID: &regularUser.ID})
		require.NoError(t, err)
		require.Nil(t, remainingReaction)
	})

	t.Run("DeleteMemoReaction permission denied for non-owner", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user1
		user1, err := ts.CreateRegularUser(ctx, "user1")
		require.NoError(t, err)
		user1Ctx := ts.CreateUserContext(ctx, user1.ID)

		// Create user2
		user2, err := ts.CreateRegularUser(ctx, "user2")
		require.NoError(t, err)
		user2Ctx := ts.CreateUserContext(ctx, user2.ID)

		// Create memo by user1
		memo, err := ts.Service.CreateMemo(user1Ctx, &apipb.CreateMemoRequest{
			Memo: &apipb.Memo{
				Content:    "Test memo",
				Visibility: apipb.Visibility_PUBLIC,
			},
		})
		require.NoError(t, err)
		require.NotNil(t, memo)

		// Create reaction by user1
		reaction, err := ts.Service.UpsertMemoReaction(user1Ctx, &apipb.UpsertMemoReactionRequest{
			Parent: memo.Name,
			Reaction: &apipb.Reaction{
				ReactionType: "👍",
			},
		})
		require.NoError(t, err)
		require.NotNil(t, reaction)

		// User2 tries to delete reaction - should fail with permission denied
		_, err = ts.Service.DeleteMemoReaction(user2Ctx, &apipb.DeleteMemoReactionRequest{
			Name: reaction.Name,
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")
	})

	t.Run("DeleteMemoReaction unauthenticated", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user
		user, err := ts.CreateRegularUser(ctx, "user")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		// Create memo
		memo, err := ts.Service.CreateMemo(userCtx, &apipb.CreateMemoRequest{
			Memo: &apipb.Memo{
				Content:    "Test memo",
				Visibility: apipb.Visibility_PUBLIC,
			},
		})
		require.NoError(t, err)
		require.NotNil(t, memo)

		// Create reaction
		reaction, err := ts.Service.UpsertMemoReaction(userCtx, &apipb.UpsertMemoReactionRequest{
			Parent: memo.Name,
			Reaction: &apipb.Reaction{
				ReactionType: "👍",
			},
		})
		require.NoError(t, err)
		require.NotNil(t, reaction)

		// Unauthenticated user tries to delete reaction - should fail
		_, err = ts.Service.DeleteMemoReaction(ctx, &apipb.DeleteMemoReactionRequest{
			Name: reaction.Name,
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "not authenticated")
	})

	t.Run("DeleteMemoReaction not found returns permission denied", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user
		user, err := ts.CreateRegularUser(ctx, "user")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		// Try to delete non-existent reaction - should fail with permission denied
		// (not "not found" to avoid information disclosure)
		// Use new nested resource format: memos/{memo}/reactions/{reaction}
		_, err = ts.Service.DeleteMemoReaction(userCtx, &apipb.DeleteMemoReactionRequest{
			Name: "memos/nonexistent/reactions/99999",
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")
		require.NotContains(t, err.Error(), "not found")
	})
}

func TestListMemoReactionsSkipsMissingCreators(t *testing.T) {
	ctx := context.Background()

	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "reaction-owner")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)

	reactor, err := ts.CreateRegularUser(ctx, "reaction-orphan")
	require.NoError(t, err)
	reactorCtx := ts.CreateUserContext(ctx, reactor.ID)

	memo, err := ts.Service.CreateMemo(ownerCtx, &apipb.CreateMemoRequest{
		Memo: &apipb.Memo{
			Content:    "reaction list memo",
			Visibility: apipb.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	_, err = ts.Service.UpsertMemoReaction(reactorCtx, &apipb.UpsertMemoReactionRequest{
		Parent: memo.Name,
		Reaction: &apipb.Reaction{
			ReactionType: "🔥",
		},
	})
	require.NoError(t, err)

	_, err = ts.Store.DeleteUser(ctx, &store.DeleteUser{ID: reactor.ID})
	require.NoError(t, err)

	resp, err := ts.Service.ListMemoReactions(ctx, &apipb.ListMemoReactionsRequest{Parent: memo.Name})
	require.NoError(t, err)
	require.Empty(t, resp.Reactions)
}
