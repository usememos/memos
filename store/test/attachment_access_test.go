package test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestAttachmentAccessScopeFiltersBeforePagination(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "attachment-space-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	member, err := ts.CreateUser(ctx, &store.User{Username: "attachment-space-member", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	space, err := ts.CreateSpace(ctx, &store.Space{UID: "attachment-space", Title: "Attachments"}, owner.ID)
	require.NoError(t, err)
	_, err = createSpaceMemberForTest(ctx, ts, &store.SpaceMember{SpaceID: space.ID, UserID: member.ID, Role: store.SpaceMemberRoleUser}, owner.ID)
	require.NoError(t, err)
	root, err := ts.CreateMemo(ctx, &store.Memo{UID: "attachment-space-root", CreatorID: owner.ID, Content: "root", Visibility: store.SpaceAudience, SpaceID: &space.ID})
	require.NoError(t, err)
	comment, err := ts.CreateMemoComment(ctx, &store.Memo{
		UID: "attachment-space-comment", CreatorID: owner.ID, Content: "comment", Visibility: store.SpaceAudience, SpaceID: &space.ID,
	}, root.ID, owner.ID)
	require.NoError(t, err)

	unlinked, err := ts.CreateAttachment(ctx, &store.Attachment{UID: "attachment-unlinked", CreatorID: member.ID, Filename: "unlinked.txt", Type: "text/plain", Size: 1, Blob: []byte("u")})
	require.NoError(t, err)
	linked, err := ts.CreateAttachment(ctx, &store.Attachment{UID: "attachment-linked", CreatorID: member.ID, Filename: "linked.txt", Type: "text/plain", Size: 1, Blob: []byte("l"), MemoID: &comment.ID})
	require.NoError(t, err)
	older, newer := time.Now().Unix()-20, time.Now().Unix()-10
	require.NoError(t, ts.UpdateAttachment(ctx, &store.UpdateAttachment{ID: unlinked.ID, UpdatedTs: &older}))
	require.NoError(t, ts.UpdateAttachment(ctx, &store.UpdateAttachment{ID: linked.ID, UpdatedTs: &newer}))
	require.NoError(t, ts.DeleteSpaceMember(ctx, &store.DeleteSpaceMember{SpaceID: space.ID, UserID: member.ID}, owner.ID))

	limit, offset := 1, 0
	attachments, err := ts.ListAttachments(ctx, &store.FindAttachment{
		CreatorID: &member.ID,
		Access: &store.MemoAccessScope{
			UserID:         &member.ID,
			AllowPublic:    true,
			AllowProtected: true,
		},
		Limit:  &limit,
		Offset: &offset,
	})
	require.NoError(t, err)
	require.Len(t, attachments, 1)
	require.Equal(t, unlinked.ID, attachments[0].ID, "the inaccessible newer row must be removed before LIMIT is applied")
}

func TestAttachmentSpaceFilterFiltersByMemoPlacement(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "attachment-scope-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	spaceA, err := ts.CreateSpace(ctx, &store.Space{UID: "attachment-scope-a", Title: "A"}, owner.ID)
	require.NoError(t, err)
	spaceB, err := ts.CreateSpace(ctx, &store.Space{UID: "attachment-scope-b", Title: "B"}, owner.ID)
	require.NoError(t, err)

	unassignedMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "attachment-scope-unassigned", CreatorID: owner.ID, Content: "unassigned", Visibility: store.Private,
	})
	require.NoError(t, err)
	spaceAMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "attachment-scope-a-memo", CreatorID: owner.ID, Content: "a", Visibility: store.Private, SpaceID: &spaceA.ID,
	})
	require.NoError(t, err)
	spaceBMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "attachment-scope-b-memo", CreatorID: owner.ID, Content: "b", Visibility: store.Public, SpaceID: &spaceB.ID,
	})
	require.NoError(t, err)

	createAttachment := func(uid string, memoID *int32) *store.Attachment {
		t.Helper()
		attachment, createErr := ts.CreateAttachment(ctx, &store.Attachment{
			UID: uid, CreatorID: owner.ID, Filename: uid + ".txt", Type: "text/plain", MemoID: memoID,
		})
		require.NoError(t, createErr)
		return attachment
	}
	unlinked := createAttachment("attachment-scope-unlinked", nil)
	unassigned := createAttachment("attachment-scope-unassigned-file", &unassignedMemo.ID)
	inSpaceANewer := createAttachment("attachment-scope-a-newer", &spaceAMemo.ID)
	inSpaceAOlder := createAttachment("attachment-scope-a-older", &spaceAMemo.ID)
	inSpaceB := createAttachment("attachment-scope-b-file", &spaceBMemo.ID)

	baseTime := time.Now().Unix() - 100
	for attachment, updatedTs := range map[*store.Attachment]int64{
		inSpaceB:      baseTime + 50,
		inSpaceANewer: baseTime + 40,
		unlinked:      baseTime + 30,
		inSpaceAOlder: baseTime + 20,
		unassigned:    baseTime + 10,
	} {
		require.NoError(t, ts.UpdateAttachment(ctx, &store.UpdateAttachment{ID: attachment.ID, UpdatedTs: &updatedTs}))
	}

	access := &store.MemoAccessScope{UserID: &owner.ID, AllowPublic: true, AllowProtected: true}
	limit, firstOffset := 1, 0
	spaceAttachments, err := ts.ListAttachments(ctx, &store.FindAttachment{
		CreatorID: &owner.ID, Access: access, Filters: []string{`space == "spaces/attachment-scope-a"`}, Limit: &limit, Offset: &firstOffset,
	})
	require.NoError(t, err)
	require.Equal(t, []int32{inSpaceANewer.ID}, attachmentIDs(spaceAttachments), "filter must be applied before the first page")
	secondOffset := 1
	spaceAttachments, err = ts.ListAttachments(ctx, &store.FindAttachment{
		CreatorID: &owner.ID, Access: access, Filters: []string{`space == "spaces/attachment-scope-a"`}, Limit: &limit, Offset: &secondOffset,
	})
	require.NoError(t, err)
	require.Equal(t, []int32{inSpaceAOlder.ID}, attachmentIDs(spaceAttachments), "filter must be applied before the second page")

	unassignedAttachments, err := ts.ListAttachments(ctx, &store.FindAttachment{
		CreatorID: &owner.ID, Access: access, Filters: []string{`space == null`}, SkipDefaultLimit: true,
	})
	require.NoError(t, err)
	require.ElementsMatch(t, []int32{unlinked.ID, unassigned.ID}, attachmentIDs(unassignedAttachments))
}

func TestAttachmentAccessScopeUsesDirectMemoAudience(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "attachment-local-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	contextMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "attachment-local-context", CreatorID: owner.ID, Content: "private context", Visibility: store.Private,
	})
	require.NoError(t, err)
	publicComment, err := ts.CreateMemoComment(ctx, &store.Memo{
		UID: "attachment-local-public", CreatorID: owner.ID, Content: "public reply", Visibility: store.Public,
	}, contextMemo.ID, owner.ID)
	require.NoError(t, err)
	privateComment, err := ts.CreateMemoComment(ctx, &store.Memo{
		UID: "attachment-local-private", CreatorID: owner.ID, Content: "private reply", Visibility: store.Private,
	}, contextMemo.ID, owner.ID)
	require.NoError(t, err)
	publicAttachment, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID: "attachment-local-public-file", CreatorID: owner.ID, Filename: "public.txt", Type: "text/plain", MemoID: &publicComment.ID,
	})
	require.NoError(t, err)
	_, err = ts.CreateAttachment(ctx, &store.Attachment{
		UID: "attachment-local-private-file", CreatorID: owner.ID, Filename: "private.txt", Type: "text/plain", MemoID: &privateComment.ID,
	})
	require.NoError(t, err)

	attachments, err := ts.ListAttachments(ctx, &store.FindAttachment{
		Access:           &store.MemoAccessScope{AllowPublic: true},
		SkipDefaultLimit: true,
	})
	require.NoError(t, err)
	require.Len(t, attachments, 1)
	require.Equal(t, publicAttachment.ID, attachments[0].ID, "the context memo must not grant or restrict attachment access")
}

func TestAttachmentAccessScopeSpaceAudienceHasNoMemoAuthorBypass(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	author, err := ts.CreateUser(ctx, &store.User{Username: "attachment-removed-author", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	admin, err := ts.CreateUser(ctx, &store.User{Username: "attachment-remaining-admin", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	space, err := ts.CreateSpace(ctx, &store.Space{UID: "attachment-author-space", Title: "Author attachment access"}, author.ID)
	require.NoError(t, err)
	_, err = createSpaceMemberForTest(ctx, ts, &store.SpaceMember{SpaceID: space.ID, UserID: admin.ID, Role: store.SpaceMemberRoleAdmin}, author.ID)
	require.NoError(t, err)
	memo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "attachment-author-memo", CreatorID: author.ID, Content: "members", Visibility: store.SpaceAudience, SpaceID: &space.ID,
	})
	require.NoError(t, err)
	_, err = ts.CreateAttachment(ctx, &store.Attachment{
		UID: "attachment-author-file", CreatorID: author.ID, Filename: "members.txt", Type: "text/plain", MemoID: &memo.ID,
	})
	require.NoError(t, err)
	require.NoError(t, ts.DeleteSpaceMember(ctx, &store.DeleteSpaceMember{SpaceID: space.ID, UserID: author.ID}, admin.ID))

	attachments, err := ts.ListAttachments(ctx, &store.FindAttachment{
		CreatorID:        &author.ID,
		Access:           &store.MemoAccessScope{UserID: &author.ID, AllowPublic: true, AllowProtected: true},
		SkipDefaultLimit: true,
	})
	require.NoError(t, err)
	require.Empty(t, attachments)
}

func TestAttachmentAccessScopeAllowsArchivedMemoCreatorAndFiltersMissingCreator(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	creator, err := ts.CreateUser(ctx, &store.User{Username: "attachment-archived-memo-creator", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	attachmentOwner, err := ts.CreateUser(ctx, &store.User{Username: "attachment-creator-viewer", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	validMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "attachment-archived-creator-memo", CreatorID: creator.ID, Content: "valid", Visibility: store.Public,
	})
	require.NoError(t, err)
	validAttachment, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID: "attachment-archived-creator-file", CreatorID: attachmentOwner.ID, Filename: "valid.txt", Type: "text/plain", MemoID: &validMemo.ID,
	})
	require.NoError(t, err)
	archived := store.Archived
	_, err = ts.UpdateUser(ctx, &store.UpdateUser{ID: creator.ID, RowStatus: &archived})
	require.NoError(t, err)

	attachments, err := ts.ListAttachments(ctx, &store.FindAttachment{
		Access:           &store.MemoAccessScope{AllowPublic: true},
		SkipDefaultLimit: true,
	})
	require.NoError(t, err)
	require.Equal(t, []int32{validAttachment.ID}, attachmentIDs(attachments),
		"attachments keep following an active memo's audience when its creator is archived")

	corruptMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "attachment-missing-creator-memo", CreatorID: attachmentOwner.ID, Content: "corrupt", Visibility: store.Public,
	})
	require.NoError(t, err)
	_, err = ts.CreateAttachment(ctx, &store.Attachment{
		UID: "attachment-missing-creator-file", CreatorID: attachmentOwner.ID, Filename: "corrupt.txt", Type: "text/plain", MemoID: &corruptMemo.ID,
	})
	require.NoError(t, err)
	_, err = ts.GetDriver().GetDB().ExecContext(ctx,
		fmt.Sprintf("UPDATE memo SET creator_id = 2147483000 WHERE id = %d", corruptMemo.ID))
	require.NoError(t, err)

	attachments, err = ts.ListAttachments(ctx, &store.FindAttachment{
		Access:           &store.MemoAccessScope{AllowPublic: true},
		SkipDefaultLimit: true,
	})
	require.NoError(t, err)
	require.Equal(t, []int32{validAttachment.ID}, attachmentIDs(attachments),
		"an attachment must not reveal a memo whose creator cannot be resolved")
}

func TestAttachmentWritePolicyRevalidatesMemoSpaceMembership(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "attachment-write-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	member, err := ts.CreateUser(ctx, &store.User{Username: "attachment-write-member", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	space, err := ts.CreateSpace(ctx, &store.Space{UID: "attachment-write-space", Title: "Attachment Writes"}, owner.ID)
	require.NoError(t, err)
	_, err = createSpaceMemberForTest(ctx, ts, &store.SpaceMember{SpaceID: space.ID, UserID: member.ID, Role: store.SpaceMemberRoleUser}, owner.ID)
	require.NoError(t, err)

	root, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "attachment-write-root", CreatorID: member.ID, Content: "root", Visibility: store.SpaceAudience, SpaceID: &space.ID,
	})
	require.NoError(t, err)
	target, err := ts.CreateMemoComment(ctx, &store.Memo{
		UID: "attachment-write-comment", CreatorID: member.ID, Content: "comment", Visibility: store.SpaceAudience, SpaceID: &space.ID,
	}, root.ID, member.ID)
	require.NoError(t, err)
	secondTarget, err := ts.CreateMemoComment(ctx, &store.Memo{
		UID: "attachment-write-second-comment", CreatorID: member.ID, Content: "second", Visibility: store.SpaceAudience, SpaceID: &space.ID,
	}, root.ID, member.ID)
	require.NoError(t, err)
	policy := memoWritePolicy(member.ID, false)
	unlinked, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID: "attachment-policy-unlinked", CreatorID: member.ID, Filename: "unlinked.txt", Type: "text/plain",
	})
	require.NoError(t, err)
	unlinkedRename := "unlinked-renamed.txt"
	require.NoError(t, ts.UpdateAttachment(ctx, &store.UpdateAttachment{
		ID: unlinked.ID, Filename: &unlinkedRename, Policy: policy,
	}))

	attachment, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID:       "attachment-policy-linked",
		CreatorID: member.ID,
		Filename:  "linked.txt",
		Type:      "text/plain",
		Size:      1,
		Blob:      []byte("a"),
		MemoID:    &target.ID,
		Policy:    policy,
	})
	require.NoError(t, err)
	renamed := "renamed.txt"
	require.NoError(t, ts.UpdateAttachment(ctx, &store.UpdateAttachment{
		ID: attachment.ID, Filename: &renamed, Policy: policy,
	}))
	foreignAttachment, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID:       "attachment-policy-foreign-owner",
		CreatorID: owner.ID,
		Filename:  "foreign.txt",
		Type:      "text/plain",
		MemoID:    &target.ID,
	})
	require.NoError(t, err)
	foreignRename := "must-not-rename-foreign.txt"
	err = ts.UpdateAttachment(ctx, &store.UpdateAttachment{
		ID: foreignAttachment.ID, Filename: &foreignRename, Policy: policy,
	})
	require.ErrorIs(t, err, store.ErrMemoPermissionDenied)
	storedForeign, err := ts.GetAttachment(ctx, &store.FindAttachment{ID: &foreignAttachment.ID})
	require.NoError(t, err)
	require.Equal(t, "foreign.txt", storedForeign.Filename)

	// A trusted internal caller can still rebind legacy data. A later transport
	// update discovers and authorizes the current binding in its transaction.
	require.NoError(t, ts.UpdateAttachment(ctx, &store.UpdateAttachment{ID: attachment.ID, MemoID: &secondTarget.ID}))
	currentBindingRename := "current-binding.txt"
	err = ts.UpdateAttachment(ctx, &store.UpdateAttachment{
		ID: attachment.ID, Filename: &currentBindingRename, Policy: policy,
	})
	require.NoError(t, err)
	stored, err := ts.GetAttachment(ctx, &store.FindAttachment{ID: &attachment.ID})
	require.NoError(t, err)
	require.Equal(t, currentBindingRename, stored.Filename)
	require.NoError(t, ts.UpdateAttachment(ctx, &store.UpdateAttachment{ID: attachment.ID, MemoID: &target.ID}))

	archived := store.Archived
	_, err = ts.UpdateUser(ctx, &store.UpdateUser{ID: member.ID, RowStatus: &archived})
	require.NoError(t, err)
	_, err = ts.CreateAttachment(ctx, &store.Attachment{
		UID:       "attachment-policy-archived-actor",
		CreatorID: member.ID,
		Filename:  "archived.txt",
		Type:      "text/plain",
		MemoID:    &target.ID,
		Policy:    policy,
	})
	require.ErrorIs(t, err, store.ErrMemoSpaceMembershipRequired)
	archivedRename := "archived-must-not-rename.txt"
	err = ts.UpdateAttachment(ctx, &store.UpdateAttachment{
		ID: unlinked.ID, Filename: &archivedRename, Policy: policy,
	})
	require.ErrorIs(t, err, store.ErrMemoPermissionDenied)
	normal := store.Normal
	_, err = ts.UpdateUser(ctx, &store.UpdateUser{ID: member.ID, RowStatus: &normal})
	require.NoError(t, err)

	require.NoError(t, ts.DeleteSpaceMember(ctx, &store.DeleteSpaceMember{SpaceID: space.ID, UserID: member.ID}, owner.ID))
	_, err = ts.CreateAttachment(ctx, &store.Attachment{
		UID:       "attachment-policy-revoked-create",
		CreatorID: member.ID,
		Filename:  "revoked.txt",
		Type:      "text/plain",
		MemoID:    &target.ID,
		Policy:    policy,
	})
	require.ErrorIs(t, err, store.ErrMemoSpaceMembershipRequired)
	revokedRename := "revoked-rename.txt"
	err = ts.UpdateAttachment(ctx, &store.UpdateAttachment{
		ID: attachment.ID, Filename: &revokedRename, Policy: policy,
	})
	require.ErrorIs(t, err, store.ErrMemoSpaceMembershipRequired)
	stored, err = ts.GetAttachment(ctx, &store.FindAttachment{ID: &attachment.ID})
	require.NoError(t, err)
	require.Equal(t, currentBindingRename, stored.Filename)

	_, err = createSpaceMemberForTest(ctx, ts, &store.SpaceMember{SpaceID: space.ID, UserID: member.ID, Role: store.SpaceMemberRoleUser}, owner.ID)
	require.NoError(t, err)
	restoredRename := "restored-membership.txt"
	err = ts.UpdateAttachment(ctx, &store.UpdateAttachment{
		ID: attachment.ID, Filename: &restoredRename, Policy: policy,
	})
	require.NoError(t, err)
	stored, err = ts.GetAttachment(ctx, &store.FindAttachment{ID: &attachment.ID})
	require.NoError(t, err)
	require.Equal(t, restoredRename, stored.Filename)
}

func attachmentIDs(attachments []*store.Attachment) []int32 {
	ids := make([]int32, 0, len(attachments))
	for _, attachment := range attachments {
		ids = append(ids, attachment.ID)
	}
	return ids
}
