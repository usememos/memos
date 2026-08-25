package test

import (
	"context"
	"testing"

	"github.com/lithammer/shortuuid/v4"
	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestMemoRelationMutationRevalidatesRelatedMemo(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	spaceOwner, err := ts.CreateUser(ctx, &store.User{Username: "relation-space-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	// An application ADMIN deliberately acts as the source author. The instance
	// role must not bypass the related memo's current Space audience.
	actor, err := ts.CreateUser(ctx, &store.User{Username: "relation-app-admin", Role: store.RoleAdmin, PasswordHash: "hash"})
	require.NoError(t, err)
	space, err := ts.CreateSpace(ctx, &store.Space{UID: shortuuid.New(), Title: "Relations"}, spaceOwner.ID)
	require.NoError(t, err)
	_, err = createSpaceMemberForTest(ctx, ts, &store.SpaceMember{SpaceID: space.ID, UserID: actor.ID, Role: store.SpaceMemberRoleUser}, spaceOwner.ID)
	require.NoError(t, err)

	targetRoot, err := ts.CreateMemo(ctx, &store.Memo{
		UID: shortuuid.New(), CreatorID: spaceOwner.ID, Content: "target root", Visibility: store.SpaceAudience, SpaceID: &space.ID,
	})
	require.NoError(t, err)
	targetComment, err := ts.CreateMemoComment(ctx, &store.Memo{
		UID: shortuuid.New(), CreatorID: spaceOwner.ID, Content: "independent target", Visibility: store.SpaceAudience, SpaceID: &space.ID,
	}, targetRoot.ID, spaceOwner.ID)
	require.NoError(t, err)
	source, err := ts.CreateMemo(ctx, &store.Memo{
		UID: shortuuid.New(), CreatorID: actor.ID, Content: "source", Visibility: store.Private,
	})
	require.NoError(t, err)

	policy := &store.MemoWritePolicy{
		ActorUserID: actor.ID,
	}
	err = ts.ApplyMemoMutation(ctx, &store.MemoMutation{
		MemoID:                    source.ID,
		MemoCreatorID:             actor.ID,
		ExpectedMemoContent:       source.Content,
		ReplaceReferenceRelations: true,
		ReferenceRelations: []*store.MemoRelation{{
			MemoID: source.ID, RelatedMemoID: targetComment.ID, Type: store.MemoRelationReference,
		}},
		Policy: policy,
	})
	require.NoError(t, err)

	require.NoError(t, ts.DeleteSpaceMember(ctx, &store.DeleteSpaceMember{SpaceID: space.ID, UserID: actor.ID}, spaceOwner.ID))
	updatedContent := "must not commit"
	err = ts.ApplyMemoMutation(ctx, &store.MemoMutation{
		MemoID:                    source.ID,
		MemoCreatorID:             actor.ID,
		ExpectedMemoContent:       source.Content,
		MemoUpdate:                &store.UpdateMemo{ID: source.ID, Content: &updatedContent},
		ReplaceReferenceRelations: true,
		ReferenceRelations: []*store.MemoRelation{{
			MemoID: source.ID, RelatedMemoID: targetComment.ID, Type: store.MemoRelationReference,
		}},
		Policy: policy,
	})
	require.ErrorIs(t, err, store.ErrMemoPermissionDenied)

	stored, err := ts.GetMemo(ctx, &store.FindMemo{ID: &source.ID})
	require.NoError(t, err)
	require.Equal(t, "source", stored.Content)
	referenceType := store.MemoRelationReference
	relations, err := ts.ListMemoRelations(ctx, &store.FindMemoRelation{MemoID: &source.ID, Type: &referenceType})
	require.NoError(t, err)
	require.Len(t, relations, 1)
	require.Equal(t, targetComment.ID, relations[0].RelatedMemoID)
}

func TestMemoRelationMutationRejectsCommentPersistence(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	source, err := ts.CreateMemo(ctx, &store.Memo{UID: shortuuid.New(), CreatorID: user.ID, Content: "source", Visibility: store.Private})
	require.NoError(t, err)
	target, err := ts.CreateMemo(ctx, &store.Memo{UID: shortuuid.New(), CreatorID: user.ID, Content: "target", Visibility: store.Private})
	require.NoError(t, err)

	_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{MemoID: source.ID, RelatedMemoID: target.ID, Type: store.MemoRelationComment})
	require.Error(t, err)
	err = ts.ApplyMemoMutation(ctx, &store.MemoMutation{
		MemoID:                    source.ID,
		MemoCreatorID:             user.ID,
		ExpectedMemoContent:       source.Content,
		ReplaceReferenceRelations: true,
		ReferenceRelations: []*store.MemoRelation{{
			MemoID: source.ID, RelatedMemoID: target.ID, Type: store.MemoRelationComment,
		}},
	})
	require.Error(t, err)

	relations, err := ts.ListMemoRelations(ctx, &store.FindMemoRelation{MemoID: &source.ID})
	require.NoError(t, err)
	require.Empty(t, relations)
}

func TestMemoCommentCreationKeepsIndependentPlacementAndAudience(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "comment-context-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	actor, err := ts.CreateUser(ctx, &store.User{Username: "comment-independent-actor", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	contextSpace, err := ts.CreateSpace(ctx, &store.Space{UID: shortuuid.New(), Title: "Context"}, owner.ID)
	require.NoError(t, err)
	commentSpace, err := ts.CreateSpace(ctx, &store.Space{UID: shortuuid.New(), Title: "Comment"}, owner.ID)
	require.NoError(t, err)
	for _, space := range []*store.Space{contextSpace, commentSpace} {
		_, err = createSpaceMemberForTest(ctx, ts, &store.SpaceMember{SpaceID: space.ID, UserID: actor.ID, Role: store.SpaceMemberRoleUser}, owner.ID)
		require.NoError(t, err)
	}
	contextMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: shortuuid.New(), CreatorID: owner.ID, Content: "context", Visibility: store.Public, SpaceID: &contextSpace.ID,
	})
	require.NoError(t, err)
	comment, err := ts.CreateMemoComment(ctx, &store.Memo{
		UID: shortuuid.New(), CreatorID: actor.ID, Content: "comment", Visibility: store.Private, SpaceID: &commentSpace.ID,
	}, contextMemo.ID, actor.ID)
	require.NoError(t, err)
	require.Equal(t, store.Private, comment.Visibility)
	require.Equal(t, &commentSpace.ID, comment.SpaceID)

	commentType := store.MemoRelationComment
	relations, err := ts.ListMemoRelations(ctx, &store.FindMemoRelation{MemoID: &comment.ID, Type: &commentType})
	require.NoError(t, err)
	require.Len(t, relations, 1)
	require.Equal(t, contextMemo.ID, relations[0].RelatedMemoID)
	require.Error(t, ts.DeleteMemoRelation(ctx, &store.DeleteMemoRelation{
		MemoID: &comment.ID, RelatedMemoID: &contextMemo.ID, Type: &commentType,
	}))

	require.NoError(t, ts.DeleteSpaceMember(ctx, &store.DeleteSpaceMember{SpaceID: contextSpace.ID, UserID: actor.ID}, owner.ID))
	rejectedUID := shortuuid.New()
	_, err = ts.CreateMemoComment(ctx, &store.Memo{
		UID: rejectedUID, CreatorID: actor.ID, Content: "rejected", Visibility: store.Private, SpaceID: &commentSpace.ID,
	}, contextMemo.ID, actor.ID)
	require.ErrorIs(t, err, store.ErrMemoSpaceMembershipRequired)
	rejected, getErr := ts.GetMemo(ctx, &store.FindMemo{UID: &rejectedUID})
	require.NoError(t, getErr)
	require.Nil(t, rejected, "failed context participation must not leave an orphan memo")
}
