package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestDeleteAttachmentsWithPolicyUsesCurrentBinding(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	_, actor, space := createAttachmentDeleteSpace(ctx, t, ts, "current")
	firstMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "attachment-delete-current-first", CreatorID: actor.ID, Content: "first", Visibility: store.SpaceAudience, SpaceID: &space.ID,
	})
	require.NoError(t, err)
	secondMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "attachment-delete-current-second", CreatorID: actor.ID, Content: "second", Visibility: store.SpaceAudience, SpaceID: &space.ID,
	})
	require.NoError(t, err)
	attachment, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID: "attachment-delete-current-target", CreatorID: actor.ID, Filename: "current.txt", Type: "text/plain", MemoID: &firstMemo.ID,
	})
	require.NoError(t, err)

	// The delete protocol authorizes the binding locked in its own transaction;
	// it does not compare a transport snapshot of the old binding.
	require.NoError(t, ts.UpdateAttachment(ctx, &store.UpdateAttachment{ID: attachment.ID, MemoID: &secondMemo.ID}))
	require.NoError(t, ts.DeleteAttachmentsWithPolicy(ctx, attachmentDeletionPolicy(actor.ID, secondMemo), []int32{attachment.ID}))

	stored, err := ts.GetAttachment(ctx, &store.FindAttachment{ID: &attachment.ID})
	require.NoError(t, err)
	require.Nil(t, stored)
}

func TestDeleteAttachmentsWithPolicyRevalidatesCurrentMemoMembership(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, actor, space := createAttachmentDeleteSpace(ctx, t, ts, "membership")
	memo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "attachment-delete-membership-memo", CreatorID: actor.ID, Content: "memo", Visibility: store.SpaceAudience, SpaceID: &space.ID,
	})
	require.NoError(t, err)
	attachment, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID: "attachment-delete-membership-target", CreatorID: actor.ID, Filename: "member.txt", Type: "text/plain", MemoID: &memo.ID,
	})
	require.NoError(t, err)
	require.NoError(t, ts.DeleteSpaceMember(ctx, &store.DeleteSpaceMember{SpaceID: space.ID, UserID: actor.ID}, owner.ID))

	err = ts.DeleteAttachmentsWithPolicy(ctx, attachmentDeletionPolicy(actor.ID, memo), []int32{attachment.ID})
	require.ErrorIs(t, err, store.ErrMemoSpaceMembershipRequired)
	stored, err := ts.GetAttachment(ctx, &store.FindAttachment{ID: &attachment.ID})
	require.NoError(t, err)
	require.NotNil(t, stored)
}

func TestDeleteAttachmentsWithPolicyRequiresCurrentMemoAuthor(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, actor, space := createAttachmentDeleteSpace(ctx, t, ts, "memo-author")
	ownerMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "attachment-delete-owner-memo", CreatorID: owner.ID, Content: "owner", Visibility: store.SpaceAudience, SpaceID: &space.ID,
	})
	require.NoError(t, err)
	attachment, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID: "attachment-delete-actor-target", CreatorID: actor.ID, Filename: "actor.txt", Type: "text/plain",
	})
	require.NoError(t, err)
	require.NoError(t, ts.UpdateAttachment(ctx, &store.UpdateAttachment{ID: attachment.ID, MemoID: &ownerMemo.ID}))

	err = ts.DeleteAttachmentsWithPolicy(ctx, attachmentDeletionPolicy(actor.ID, ownerMemo), []int32{attachment.ID})
	require.ErrorIs(t, err, store.ErrMemoPermissionDenied)
	stored, err := ts.GetAttachment(ctx, &store.FindAttachment{ID: &attachment.ID})
	require.NoError(t, err)
	require.NotNil(t, stored)
}

func TestDeleteAttachmentsWithPolicyBatchIsAtomic(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	actor, err := ts.CreateUser(ctx, &store.User{Username: "attachment-delete-batch-actor", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	other, err := ts.CreateUser(ctx, &store.User{Username: "attachment-delete-batch-other", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	owned, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID: "attachment-delete-batch-owned", CreatorID: actor.ID, Filename: "owned.txt", Type: "text/plain",
	})
	require.NoError(t, err)
	foreign, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID: "attachment-delete-batch-foreign", CreatorID: other.ID, Filename: "foreign.txt", Type: "text/plain",
	})
	require.NoError(t, err)

	err = ts.DeleteAttachmentsWithPolicy(ctx, attachmentDeletionPolicy(actor.ID), []int32{owned.ID, foreign.ID})
	require.ErrorIs(t, err, store.ErrMemoPermissionDenied)
	for _, attachment := range []*store.Attachment{owned, foreign} {
		stored, getErr := ts.GetAttachment(ctx, &store.FindAttachment{ID: &attachment.ID})
		require.NoError(t, getErr)
		require.NotNil(t, stored)
	}

	err = ts.DeleteAttachmentsWithPolicy(ctx, attachmentDeletionPolicy(actor.ID), []int32{owned.ID, 2147483000})
	require.ErrorIs(t, err, store.ErrMemoMutationConflict)
	stored, err := ts.GetAttachment(ctx, &store.FindAttachment{ID: &owned.ID})
	require.NoError(t, err)
	require.NotNil(t, stored, "a missing batch target must not partially delete existing rows")
}

func TestDeleteAttachmentsWithPolicyValidatesIDs(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	require.Error(t, ts.DeleteAttachmentsWithPolicy(ctx, nil, []int32{1}))
	require.Error(t, ts.DeleteAttachmentsWithPolicy(ctx, attachmentDeletionPolicy(1), nil))
	require.Error(t, ts.DeleteAttachmentsWithPolicy(ctx, attachmentDeletionPolicy(1), []int32{0}))
	require.Error(t, ts.DeleteAttachmentsWithPolicy(ctx, attachmentDeletionPolicy(1), []int32{1, 1}))
}

func TestDeleteAttachmentsWithPolicyRejectsChangedMemoContent(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	actor, err := ts.CreateUser(ctx, &store.User{Username: "attachment-delete-content-actor", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	memo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "attachment-delete-content-memo", CreatorID: actor.ID, Content: "before", Visibility: store.Private,
	})
	require.NoError(t, err)
	attachment, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID: "attachment-delete-content-target", CreatorID: actor.ID, Filename: "content.txt", Type: "text/plain", MemoID: &memo.ID,
	})
	require.NoError(t, err)
	policy := attachmentDeletionPolicy(actor.ID, memo)
	err = ts.DeleteAttachmentsWithPolicy(ctx, attachmentDeletionPolicy(actor.ID), []int32{attachment.ID})
	require.ErrorIs(t, err, store.ErrMemoMutationConflict, "bound attachments require a memo content snapshot")

	updatedContent := "after"
	require.NoError(t, ts.UpdateMemo(ctx, &store.UpdateMemo{ID: memo.ID, Content: &updatedContent}))

	err = ts.DeleteAttachmentsWithPolicy(ctx, policy, []int32{attachment.ID})
	require.ErrorIs(t, err, store.ErrMemoMutationConflict)
	stored, err := ts.GetAttachment(ctx, &store.FindAttachment{ID: &attachment.ID})
	require.NoError(t, err)
	require.NotNil(t, stored)
}

func attachmentDeletionPolicy(actorUserID int32, memos ...*store.Memo) *store.AttachmentDeletionPolicy {
	expectedMemoContents := make(map[int32]string, len(memos))
	for _, memo := range memos {
		if memo != nil {
			expectedMemoContents[memo.ID] = memo.Content
		}
	}
	return &store.AttachmentDeletionPolicy{ActorUserID: actorUserID, ExpectedMemoContents: expectedMemoContents}
}

func createAttachmentDeleteSpace(ctx context.Context, t *testing.T, ts *store.Store, suffix string) (*store.User, *store.User, *store.Space) {
	t.Helper()
	owner, err := ts.CreateUser(ctx, &store.User{Username: "attachment-delete-" + suffix + "-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	actor, err := ts.CreateUser(ctx, &store.User{Username: "attachment-delete-" + suffix + "-actor", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	space, err := ts.CreateSpace(ctx, &store.Space{UID: "attachment-delete-" + suffix + "-space", Title: suffix}, owner.ID)
	require.NoError(t, err)
	_, err = createSpaceMemberForTest(ctx, ts, &store.SpaceMember{SpaceID: space.ID, UserID: actor.ID, Role: store.SpaceMemberRoleUser}, owner.ID)
	require.NoError(t, err)
	return owner, actor, space
}
