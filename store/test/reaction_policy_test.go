package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestReactionWritePolicyUsesTargetMemoAudience(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "reaction-local-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	viewer, err := ts.CreateUser(ctx, &store.User{Username: "reaction-local-viewer", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	outsider, err := ts.CreateUser(ctx, &store.User{Username: "reaction-local-outsider", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)

	contextMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "reaction-local-context", CreatorID: owner.ID, Content: "public context", Visibility: store.Public,
	})
	require.NoError(t, err)
	privateComment, err := ts.CreateMemoComment(ctx, &store.Memo{
		UID: "reaction-local-private-comment", CreatorID: viewer.ID, Content: "private comment", Visibility: store.Private,
	}, contextMemo.ID, viewer.ID)
	require.NoError(t, err)

	_, err = ts.UpsertReaction(ctx, &store.Reaction{
		CreatorID: owner.ID, MemoID: privateComment.ID, ReactionType: "context-author",
		Policy: reactionWritePolicy(owner.ID),
	})
	require.ErrorIs(t, err, store.ErrMemoPermissionDenied, "a public context relation must not grant access to a private comment")
	_, err = ts.UpsertReaction(ctx, &store.Reaction{
		CreatorID: viewer.ID, MemoID: privateComment.ID, ReactionType: "comment-author",
		Policy: reactionWritePolicy(viewer.ID),
	})
	require.NoError(t, err)

	privateContext, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "reaction-local-private-context", CreatorID: owner.ID, Content: "private context", Visibility: store.Private,
	})
	require.NoError(t, err)
	publicComment, err := ts.CreateMemoComment(ctx, &store.Memo{
		UID: "reaction-local-public-comment", CreatorID: owner.ID, Content: "public comment", Visibility: store.Public,
	}, privateContext.ID, owner.ID)
	require.NoError(t, err)
	_, err = ts.UpsertReaction(ctx, &store.Reaction{
		CreatorID: outsider.ID, MemoID: publicComment.ID, ReactionType: "public-comment",
		Policy: reactionWritePolicy(outsider.ID),
	})
	require.NoError(t, err, "a private context relation must not restrict a public comment")

	_, err = ts.UpsertReaction(ctx, &store.Reaction{
		CreatorID: outsider.ID, MemoID: publicComment.ID, ReactionType: "wrong-actor", Policy: reactionWritePolicy(owner.ID),
	})
	require.ErrorIs(t, err, store.ErrReactionPermissionDenied)
}

func TestReactionWritePolicySpaceParticipationIsMemoLocal(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "reaction-space-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	member, err := ts.CreateUser(ctx, &store.User{Username: "reaction-space-member", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	outsider, err := ts.CreateUser(ctx, &store.User{Username: "reaction-space-outsider", Role: store.RoleAdmin, PasswordHash: "hash"})
	require.NoError(t, err)

	space, err := ts.CreateSpace(ctx, &store.Space{UID: "reaction-space", Title: "Reaction Space"}, owner.ID)
	require.NoError(t, err)
	_, err = ts.CreateSpaceMember(ctx, &store.SpaceMember{SpaceID: space.ID, UserID: member.ID, Role: store.SpaceMemberRoleUser}, owner.ID)
	require.NoError(t, err)
	spaceMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "reaction-space-memo", CreatorID: owner.ID, Content: "space memo", Visibility: store.SpaceAudience, SpaceID: &space.ID,
	})
	require.NoError(t, err)

	_, err = ts.UpsertReaction(ctx, &store.Reaction{
		CreatorID: member.ID, MemoID: spaceMemo.ID, ReactionType: "member", Policy: reactionWritePolicy(member.ID),
	})
	require.NoError(t, err)
	_, err = ts.UpsertReaction(ctx, &store.Reaction{
		CreatorID: outsider.ID, MemoID: spaceMemo.ID, ReactionType: "application-admin", Policy: reactionWritePolicy(outsider.ID),
	})
	require.ErrorIs(t, err, store.ErrMemoSpaceMembershipRequired, "application ADMIN must not bypass Space membership")

	require.NoError(t, ts.DeleteSpaceMember(ctx, &store.DeleteSpaceMember{SpaceID: space.ID, UserID: member.ID}, owner.ID))
	_, err = ts.UpsertReaction(ctx, &store.Reaction{
		CreatorID: member.ID, MemoID: spaceMemo.ID, ReactionType: "former-member", Policy: reactionWritePolicy(member.ID),
	})
	require.ErrorIs(t, err, store.ErrMemoSpaceMembershipRequired)

	assignedPrivate, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "reaction-space-private", CreatorID: owner.ID, Content: "private", Visibility: store.Private, SpaceID: &space.ID,
	})
	require.NoError(t, err)
	_, err = ts.CreateSpaceMember(ctx, &store.SpaceMember{SpaceID: space.ID, UserID: member.ID, Role: store.SpaceMemberRoleUser}, owner.ID)
	require.NoError(t, err)
	_, err = ts.UpsertReaction(ctx, &store.Reaction{
		CreatorID: member.ID, MemoID: assignedPrivate.ID, ReactionType: "private-member", Policy: reactionWritePolicy(member.ID),
	})
	require.ErrorIs(t, err, store.ErrMemoPermissionDenied, "Space membership must not broaden a PRIVATE memo")
}

func TestReactionWritePolicyRejectsInactiveActorAndMemo(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "reaction-state-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	actor, err := ts.CreateUser(ctx, &store.User{Username: "reaction-state-actor", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	memo, err := ts.CreateMemo(ctx, &store.Memo{UID: "reaction-state-memo", CreatorID: owner.ID, Content: "memo", Visibility: store.Public})
	require.NoError(t, err)

	archived := store.Archived
	_, err = ts.UpdateUser(ctx, &store.UpdateUser{ID: actor.ID, RowStatus: &archived})
	require.NoError(t, err)
	_, err = ts.UpsertReaction(ctx, &store.Reaction{
		CreatorID: actor.ID, MemoID: memo.ID, ReactionType: "inactive-actor", Policy: reactionWritePolicy(actor.ID),
	})
	require.ErrorIs(t, err, store.ErrReactionPermissionDenied)

	require.NoError(t, ts.UpdateMemo(ctx, &store.UpdateMemo{ID: memo.ID, RowStatus: &archived}))
	_, err = ts.UpsertReaction(ctx, &store.Reaction{
		CreatorID: owner.ID, MemoID: memo.ID, ReactionType: "inactive-memo", Policy: reactionWritePolicy(owner.ID),
	})
	require.ErrorIs(t, err, store.ErrMemoSpaceNotWritable)
}

func TestDeleteReactionAtomicallyEnforcesCreatorAndParticipation(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "reaction-delete-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	member, err := ts.CreateUser(ctx, &store.User{Username: "reaction-delete-member", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	space, err := ts.CreateSpace(ctx, &store.Space{UID: "reaction-delete-space", Title: "Delete Reactions"}, owner.ID)
	require.NoError(t, err)
	_, err = ts.CreateSpaceMember(ctx, &store.SpaceMember{SpaceID: space.ID, UserID: member.ID, Role: store.SpaceMemberRoleUser}, owner.ID)
	require.NoError(t, err)
	memo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "reaction-delete-memo", CreatorID: owner.ID, Content: "memo", Visibility: store.SpaceAudience, SpaceID: &space.ID,
	})
	require.NoError(t, err)
	reaction, err := ts.UpsertReaction(ctx, &store.Reaction{
		CreatorID: member.ID, MemoID: memo.ID, ReactionType: "delete", Policy: reactionWritePolicy(member.ID),
	})
	require.NoError(t, err)

	err = ts.DeleteReaction(ctx, &store.DeleteReaction{
		ID: &reaction.ID, MemoID: &memo.ID, ActorUserID: &owner.ID, Policy: reactionWritePolicy(owner.ID),
	})
	require.ErrorIs(t, err, store.ErrReactionPermissionDenied)
	requireReactionPresent(ctx, t, ts, reaction.ID)

	require.NoError(t, ts.DeleteSpaceMember(ctx, &store.DeleteSpaceMember{SpaceID: space.ID, UserID: member.ID}, owner.ID))
	err = ts.DeleteReaction(ctx, &store.DeleteReaction{
		ID: &reaction.ID, MemoID: &memo.ID, ActorUserID: &member.ID, Policy: reactionWritePolicy(member.ID),
	})
	require.ErrorIs(t, err, store.ErrMemoSpaceMembershipRequired)
	requireReactionPresent(ctx, t, ts, reaction.ID)

	_, err = ts.CreateSpaceMember(ctx, &store.SpaceMember{SpaceID: space.ID, UserID: member.ID, Role: store.SpaceMemberRoleUser}, owner.ID)
	require.NoError(t, err)
	require.NoError(t, ts.DeleteReaction(ctx, &store.DeleteReaction{
		ID: &reaction.ID, MemoID: &memo.ID, ActorUserID: &member.ID, Policy: reactionWritePolicy(member.ID),
	}))
	requireReactionMissing(ctx, t, ts, reaction.ID)
}

func reactionWritePolicy(actorUserID int32) *store.ReactionWritePolicy {
	return &store.ReactionWritePolicy{ActorUserID: actorUserID}
}

func requireReactionPresent(ctx context.Context, t *testing.T, ts *store.Store, reactionID int32) {
	t.Helper()
	reaction, err := ts.GetReaction(ctx, &store.FindReaction{ID: &reactionID})
	require.NoError(t, err)
	require.NotNil(t, reaction)
}

func requireReactionMissing(ctx context.Context, t *testing.T, ts *store.Store, reactionID int32) {
	t.Helper()
	reaction, err := ts.GetReaction(ctx, &store.FindReaction{ID: &reactionID})
	require.NoError(t, err)
	require.Nil(t, reaction)
}
