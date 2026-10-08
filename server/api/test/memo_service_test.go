package test

import (
	"context"
	"fmt"
	"slices"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/fieldmaskpb"
	"google.golang.org/protobuf/types/known/timestamppb"

	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestAnonymousMemoAccessFollowsInstanceAccessSetting(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "access-mode-owner")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)
	memo, err := ts.Service.CreateMemo(ownerCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{
		Content:    "public memo",
		Visibility: apipb.Visibility_PUBLIC,
	}})
	require.NoError(t, err)

	_, err = ts.Service.GetMemo(ctx, &apipb.GetMemoRequest{Name: memo.Name})
	require.NoError(t, err)
	_, err = ts.Service.ListMemos(ctx, &apipb.ListMemosRequest{})
	require.NoError(t, err)

	require.NoError(t, ts.SetInstanceAccessMode(ctx, storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PRIVATE))
	_, err = ts.Service.GetMemo(ctx, &apipb.GetMemoRequest{Name: memo.Name})
	require.Equal(t, codes.Unauthenticated, status.Code(err))
	_, err = ts.Service.ListMemos(ctx, &apipb.ListMemosRequest{})
	require.Equal(t, codes.Unauthenticated, status.Code(err))

	_, err = ts.Service.GetMemo(ownerCtx, &apipb.GetMemoRequest{Name: memo.Name})
	require.NoError(t, err)

	require.NoError(t, ts.SetInstanceAccessMode(ctx, storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PUBLIC))
	_, err = ts.Service.GetMemo(ctx, &apipb.GetMemoRequest{Name: memo.Name})
	require.NoError(t, err)
}

func TestInstanceAdminIsSuperuserForNamedMemoOperations(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "superuser-owner")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)
	admin, err := ts.CreateHostUser(ctx, "superuser-admin")
	require.NoError(t, err)
	adminCtx := ts.CreateUserContext(ctx, admin.ID)
	other, err := ts.CreateRegularUser(ctx, "superuser-other")
	require.NoError(t, err)
	otherCtx := ts.CreateUserContext(ctx, other.ID)

	space, err := ts.Store.CreateSpace(ctx, &store.Space{UID: "superuser-space", Title: "Superuser"}, owner.ID)
	require.NoError(t, err)
	private, err := ts.Service.CreateMemo(ownerCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{
		Content:    "private memo",
		Visibility: apipb.Visibility_PRIVATE,
	}})
	require.NoError(t, err)
	spaceMemo, err := ts.Service.CreateMemo(ownerCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{
		Content:    "members only",
		Visibility: apipb.Visibility_SPACE,
		Space:      ptr("spaces/" + space.UID),
	}})
	require.NoError(t, err)

	// Point reads bypass audience and membership for the administrator only.
	_, err = ts.Service.GetMemo(otherCtx, &apipb.GetMemoRequest{Name: private.Name})
	require.Equal(t, codes.PermissionDenied, status.Code(err))
	got, err := ts.Service.GetMemo(adminCtx, &apipb.GetMemoRequest{Name: private.Name})
	require.NoError(t, err)
	require.Equal(t, "private memo", got.Content)
	got, err = ts.Service.GetMemo(adminCtx, &apipb.GetMemoRequest{Name: spaceMemo.Name})
	require.NoError(t, err, "a SPACE memo is readable by name without membership")
	require.Equal(t, "spaces/"+space.UID, got.GetSpace())

	// Collections keep the audience predicate.
	feed, err := ts.Service.ListMemos(adminCtx, &apipb.ListMemosRequest{PageSize: 50})
	require.NoError(t, err)
	for _, candidate := range feed.Memos {
		require.NotEqual(t, private.Name, candidate.Name, "another user's PRIVATE memo must not surface in the administrator's feed")
		require.NotEqual(t, spaceMemo.Name, candidate.Name, "a SPACE memo must not surface without membership")
	}
	_, err = ts.Service.ListMemos(adminCtx, &apipb.ListMemosRequest{Filter: `space == "spaces/` + space.UID + `"`})
	require.Equal(t, codes.NotFound, status.Code(err), "the Space feed stays membership-only")

	// Named mutations: content, audience, placement, comments, and deletion.
	_, err = ts.Service.UpdateMemo(otherCtx, &apipb.UpdateMemoRequest{
		Memo:       &apipb.Memo{Name: private.Name, Content: "hijacked"},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"content"}},
	})
	require.Equal(t, codes.PermissionDenied, status.Code(err))
	updated, err := ts.Service.UpdateMemo(adminCtx, &apipb.UpdateMemoRequest{
		Memo:       &apipb.Memo{Name: private.Name, Content: "edited by admin"},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"content"}},
	})
	require.NoError(t, err)
	require.Equal(t, "edited by admin", updated.Content)
	require.Equal(t, "users/"+owner.Username, updated.Creator, "authorship is unchanged")
	_, err = ts.Service.UpdateMemo(adminCtx, &apipb.UpdateMemoRequest{
		Memo:       &apipb.Memo{Name: spaceMemo.Name, Content: "edited without membership"},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"content"}},
	})
	require.NoError(t, err)
	_, err = ts.Service.UpdateMemo(adminCtx, &apipb.UpdateMemoRequest{
		Memo:       &apipb.Memo{Name: private.Name, Visibility: apipb.Visibility_SPACE, Space: ptr("spaces/" + space.UID)},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"visibility", "space"}},
	})
	require.NoError(t, err, "an administrator places memos in a Space they are not a member of")
	_, err = ts.Service.UpdateMemo(adminCtx, &apipb.UpdateMemoRequest{
		Memo:       &apipb.Memo{Name: private.Name, Space: ptr("spaces/does-not-exist")},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"space"}},
	})
	require.Equal(t, codes.NotFound, status.Code(err), "structural validity still applies")
	_, err = ts.Service.CreateMemoComment(adminCtx, &apipb.CreateMemoCommentRequest{
		Parent:  spaceMemo.Name,
		Comment: &apipb.Memo{Content: "admin comment"},
	})
	require.NoError(t, err, "participation does not require membership")

	_, err = ts.Service.DeleteMemo(otherCtx, &apipb.DeleteMemoRequest{Name: private.Name})
	require.Equal(t, codes.PermissionDenied, status.Code(err))
	_, err = ts.Service.DeleteMemo(adminCtx, &apipb.DeleteMemoRequest{Name: private.Name})
	require.NoError(t, err)
	_, err = ts.Service.GetMemo(ownerCtx, &apipb.GetMemoRequest{Name: private.Name})
	require.Equal(t, codes.NotFound, status.Code(err))

	// An archived administrator holds no privilege.
	archived := store.Archived
	_, err = ts.Store.UpdateUser(ctx, &store.UpdateUser{ID: admin.ID, RowStatus: &archived})
	require.NoError(t, err)
	_, err = ts.Service.GetMemo(adminCtx, &apipb.GetMemoRequest{Name: spaceMemo.Name})
	require.Error(t, err)
}

func TestMemoReadAllowsArchivedCreatorAccordingToAudience(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	creator, err := ts.CreateRegularUser(ctx, "archived-memo-creator")
	require.NoError(t, err)
	viewer, err := ts.CreateRegularUser(ctx, "archived-memo-viewer")
	require.NoError(t, err)
	creatorCtx := ts.CreateUserContext(ctx, creator.ID)
	viewerCtx := ts.CreateUserContext(ctx, viewer.ID)
	publicMemo, err := ts.Service.CreateMemo(creatorCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{
		Content: "public memo by archived creator", Visibility: apipb.Visibility_PUBLIC,
	}})
	require.NoError(t, err)
	protectedMemo, err := ts.Service.CreateMemo(creatorCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{
		Content: "protected memo by archived creator", Visibility: apipb.Visibility_PROTECTED,
	}})
	require.NoError(t, err)
	archived := store.Archived
	_, err = ts.Store.UpdateUser(ctx, &store.UpdateUser{ID: creator.ID, RowStatus: &archived})
	require.NoError(t, err)

	_, err = ts.Service.GetMemo(ctx, &apipb.GetMemoRequest{Name: publicMemo.Name})
	require.NoError(t, err, "creator archive must not narrow a PUBLIC memo")
	_, err = ts.Service.GetMemo(viewerCtx, &apipb.GetMemoRequest{Name: protectedMemo.Name})
	require.NoError(t, err, "creator archive must not narrow a PROTECTED memo")
}

func TestDanglingPlacementDoesNotOverrideNonSpaceAudience(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	creator, err := ts.CreateRegularUser(ctx, "dangling-placement-creator")
	require.NoError(t, err)
	creatorCtx := ts.CreateUserContext(ctx, creator.ID)
	memo, err := ts.Service.CreateMemo(creatorCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{
		Content: "public memo with corrupt placement", Visibility: apipb.Visibility_PUBLIC,
	}})
	require.NoError(t, err)
	memoID := parseMemoIDFromNameForTest(t, ts, memo.Name)
	_, err = ts.Store.GetDriver().GetDB().ExecContext(ctx,
		fmt.Sprintf("UPDATE memo SET space_id = 2147483000 WHERE id = %d", memoID))
	require.NoError(t, err)

	got, err := ts.Service.GetMemo(ctx, &apipb.GetMemoRequest{Name: memo.Name})
	require.NoError(t, err)
	require.Nil(t, got.Space, "an invalid placement must be omitted")

	listed, err := ts.Service.ListMemos(ctx, &apipb.ListMemosRequest{})
	require.NoError(t, err)
	require.Len(t, listed.Memos, 1)
	require.Equal(t, memo.Name, listed.Memos[0].Name)
	require.Nil(t, listed.Memos[0].Space)

	_, err = ts.Service.CreateMemoComment(creatorCtx, &apipb.CreateMemoCommentRequest{
		Parent: memo.Name, Comment: &apipb.Memo{Content: "must not participate", Visibility: apipb.Visibility_PUBLIC},
	})
	require.Equal(t, codes.FailedPrecondition, status.Code(err), "placement-dependent participation must fail closed")
}

func TestMemoReadFailsClosedForMissingCreatorBeforePaginationAndChildren(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	creator, err := ts.CreateRegularUser(ctx, "missing-memo-creator")
	require.NoError(t, err)
	creatorCtx := ts.CreateUserContext(ctx, creator.ID)
	first, err := ts.Service.CreateMemo(creatorCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{
		Content: "first valid", Visibility: apipb.Visibility_PUBLIC,
	}})
	require.NoError(t, err)
	second, err := ts.Service.CreateMemo(creatorCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{
		Content: "second valid", Visibility: apipb.Visibility_PUBLIC,
	}})
	require.NoError(t, err)
	corrupt, err := ts.Service.CreateMemo(creatorCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{
		Content: "dangling creator", Visibility: apipb.Visibility_PUBLIC,
	}})
	require.NoError(t, err)
	_, err = ts.Service.UpsertMemoReaction(creatorCtx, &apipb.UpsertMemoReactionRequest{
		Parent: corrupt.Name, Reaction: &apipb.Reaction{ReactionType: "eyes"},
	})
	require.NoError(t, err)
	_, err = ts.Service.CreateMemoComment(creatorCtx, &apipb.CreateMemoCommentRequest{
		Parent: corrupt.Name, Comment: &apipb.Memo{Content: "existing comment", Visibility: apipb.Visibility_PUBLIC},
	})
	require.NoError(t, err)
	corruptID := parseMemoIDFromNameForTest(t, ts, corrupt.Name)
	_, err = ts.Store.CreateAttachment(ctx, &store.Attachment{
		UID: "missing-memo-creator-attachment", CreatorID: creator.ID, Filename: "secret.txt", Type: "text/plain", MemoID: &corruptID,
	})
	require.NoError(t, err)
	_, err = ts.Store.GetDriver().GetDB().ExecContext(ctx,
		fmt.Sprintf("UPDATE memo SET creator_id = 2147483000 WHERE id = %d", corruptID))
	require.NoError(t, err)

	_, err = ts.Service.GetMemo(ctx, &apipb.GetMemoRequest{Name: corrupt.Name})
	require.Equal(t, codes.NotFound, status.Code(err))
	_, err = ts.Service.ListMemoReactions(ctx, &apipb.ListMemoReactionsRequest{Parent: corrupt.Name})
	require.Equal(t, codes.NotFound, status.Code(err))
	_, err = ts.Service.ListMemoAttachments(ctx, &apipb.ListMemoAttachmentsRequest{Parent: corrupt.Name})
	require.Equal(t, codes.NotFound, status.Code(err))
	_, err = ts.Service.ListMemoComments(ctx, &apipb.ListMemoCommentsRequest{Parent: corrupt.Name})
	require.Equal(t, codes.NotFound, status.Code(err))
	_, err = ts.Service.CreateMemoComment(creatorCtx, &apipb.CreateMemoCommentRequest{
		Parent: corrupt.Name, Comment: &apipb.Memo{Content: "must not be created", Visibility: apipb.Visibility_PUBLIC},
	})
	require.Equal(t, codes.NotFound, status.Code(err))

	listed, err := ts.Service.ListMemos(ctx, &apipb.ListMemosRequest{PageSize: 2})
	require.NoError(t, err)
	require.Len(t, listed.Memos, 2)
	require.ElementsMatch(t, []string{first.Name, second.Name}, []string{listed.Memos[0].Name, listed.Memos[1].Name},
		"a newer dangling-creator row must be filtered before the page limit")
}

func TestCreateMemoAcceptsUUID(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "test-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	const memoID = "21ec98aa-9a8f-458c-a2a3-c7dc69b6f591"
	memo, err := ts.Service.CreateMemo(userCtx, &apipb.CreateMemoRequest{
		Memo: &apipb.Memo{
			Content:    "Created with a UUID",
			Visibility: apipb.Visibility_PRIVATE,
		},
		MemoId: memoID,
	})
	require.NoError(t, err)
	require.Equal(t, "memos/"+memoID, memo.Name)
}

func TestCreateAndUpdateMemoRebuildsTagPayload(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "tag-payload-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	memo, err := ts.Service.CreateMemo(userCtx, &apipb.CreateMemoRequest{
		Memo: &apipb.Memo{
			Content:    "#book/fiction #Work #work #A\u200dB https://example.com/#hidden",
			Visibility: apipb.Visibility_PRIVATE,
		},
	})
	require.NoError(t, err)
	require.Equal(t, []string{"book", "book/fiction", "Work", "work", "AB"}, memo.Tags)

	memo, err = ts.Service.UpdateMemo(userCtx, &apipb.UpdateMemoRequest{
		Memo: &apipb.Memo{
			Name:    memo.Name,
			Content: "#next #A\u200dB",
		},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"content"}},
	})
	require.NoError(t, err)
	require.Equal(t, []string{"next", "AB"}, memo.Tags)

	stored, err := ts.Service.GetMemo(userCtx, &apipb.GetMemoRequest{Name: memo.Name})
	require.NoError(t, err)
	require.Equal(t, []string{"next", "AB"}, stored.Tags)
}

func TestListMemos(t *testing.T) {
	ctx := context.Background()

	ts := NewTestService(t)
	defer ts.Cleanup()

	// Create userOne
	userOne, err := ts.CreateRegularUser(ctx, "test-user-1")
	require.NoError(t, err)
	require.NotNil(t, userOne)

	// Create userOne context
	userOneCtx := ts.CreateUserContext(ctx, userOne.ID)

	// Create userTwo
	userTwo, err := ts.CreateRegularUser(ctx, "test-user-2")
	require.NoError(t, err)
	require.NotNil(t, userTwo)

	// Create userTwo context
	userTwoCtx := ts.CreateUserContext(ctx, userTwo.ID)

	// Create attachmentOne by userOne
	attachmentOne, err := ts.Service.CreateAttachment(userOneCtx, &apipb.CreateAttachmentRequest{
		Attachment: &apipb.Attachment{
			Name:     "",
			Filename: "hello.txt",
			Size:     5,
			Type:     "text/plain",
			Content: []byte{
				104, 101, 108, 108, 111,
			},
		},
	})

	require.NoError(t, err)
	require.NotNil(t, attachmentOne)

	// Create attachmentTwo by userOne
	attachmentTwo, err := ts.Service.CreateAttachment(userOneCtx, &apipb.CreateAttachmentRequest{
		Attachment: &apipb.Attachment{
			Name:     "",
			Filename: "world.txt",
			Size:     5,
			Type:     "text/plain",
			Content: []byte{
				119, 111, 114, 108, 100,
			},
		},
	})

	require.NoError(t, err)
	require.NotNil(t, attachmentTwo)

	// Create memoOne with two attachments by userOne
	memoOne, err := ts.Service.CreateMemo(userOneCtx, &apipb.CreateMemoRequest{
		Memo: &apipb.Memo{
			Content:    "Hellooo, any words after this sentence won't be in the snippet. This is the next sentence. And I also have two attachments.",
			Visibility: apipb.Visibility_PROTECTED,
			Attachments: []*apipb.Attachment{
				&apipb.Attachment{
					Name: attachmentOne.Name,
				},
				&apipb.Attachment{
					Name: attachmentTwo.Name,
				},
			},
		},
	})

	require.NoError(t, err)
	require.NotNil(t, memoOne)

	// Create memoTwo by userTwo referencing memoOne
	memoTwo, err := ts.Service.CreateMemo(userTwoCtx, &apipb.CreateMemoRequest{
		Memo: &apipb.Memo{
			Content:    "This is a memo reminding you to check the attachment attached to memoOne. I have referenced the memo below.⬇️",
			Visibility: apipb.Visibility_PROTECTED,
			Relations: []*apipb.MemoRelation{
				&apipb.MemoRelation{
					RelatedMemo: &apipb.MemoRelation_MemoRef{
						Name: memoOne.Name,
					},
					Type: apipb.MemoRelation_REFERENCE,
				},
			},
		},
	})

	require.NoError(t, err)
	require.NotNil(t, memoTwo)

	// Create memoThree by userOne
	memoThree, err := ts.Service.CreateMemo(userOneCtx, &apipb.CreateMemoRequest{
		Memo: &apipb.Memo{
			Content:    "This is a very popular memo. I have 2 reactions!",
			Visibility: apipb.Visibility_PROTECTED,
		},
	})

	require.NoError(t, err)
	require.NotNil(t, memoThree)

	// Create reaction from userOne on memoThree
	reactionOne, err := ts.Service.UpsertMemoReaction(userOneCtx, &apipb.UpsertMemoReactionRequest{
		Parent: memoThree.Name,
		Reaction: &apipb.Reaction{
			ReactionType: "❤️",
		},
	})

	require.NoError(t, err)
	require.NotNil(t, reactionOne)

	// Create reaction from userTwo on memoThree
	reactionTwo, err := ts.Service.UpsertMemoReaction(userTwoCtx, &apipb.UpsertMemoReactionRequest{
		Parent: memoThree.Name,
		Reaction: &apipb.Reaction{
			ReactionType: "👍",
		},
	})

	require.NoError(t, err)
	require.NotNil(t, reactionTwo)

	memos, err := ts.Service.ListMemos(userOneCtx, &apipb.ListMemosRequest{PageSize: 10})

	require.NoError(t, err)
	require.NotNil(t, memos)
	require.Equal(t, 3, len(memos.Memos))

	// ///////////////
	// VERIFY MEMO ONE
	// ///////////////
	memoOneResIdx := slices.IndexFunc(memos.Memos, func(m *apipb.Memo) bool { return m.GetName() == memoOne.GetName() })
	require.NotEqual(t, memoOneResIdx, -1)

	memoOneRes := memos.Memos[memoOneResIdx]
	require.NotNil(t, memoOneRes)

	require.Equal(t, fmt.Sprintf("users/%s", userOne.Username), memoOneRes.GetCreator())
	require.Equal(t, apipb.Visibility_PROTECTED, memoOneRes.GetVisibility())
	require.Equal(t, memoOne.Content, memoOneRes.GetContent())
	require.Equal(t, memoOne.Content[:64]+"...", memoOneRes.GetSnippet(), "memoOne's content is snipped past the 64 char limit")
	require.Len(t, memoOneRes.Attachments, 2)
	require.Len(t, memoOneRes.Relations, 1)
	require.Empty(t, memoOneRes.Reactions)

	// verify memoOne's attachments
	// attachment one
	attachmentOneResIdx := slices.IndexFunc(memoOneRes.Attachments, func(a *apipb.Attachment) bool { return a.GetName() == attachmentOne.GetName() })
	require.NotEqual(t, attachmentOneResIdx, -1)

	attachmentOneRes := memoOneRes.Attachments[attachmentOneResIdx]
	require.NotNil(t, attachmentOneRes)

	require.Equal(t, attachmentOne.GetName(), attachmentOneRes.GetName())
	require.Equal(t, attachmentOne.GetContent(), attachmentOneRes.GetContent())

	// attachment two
	attachmentTwoResIdx := slices.IndexFunc(memoOneRes.Attachments, func(a *apipb.Attachment) bool { return a.GetName() == attachmentTwo.GetName() })
	require.NotEqual(t, attachmentTwoResIdx, -1)

	attachmentTwoRes := memoOneRes.Attachments[attachmentTwoResIdx]
	require.NotNil(t, attachmentTwoRes)
	require.Equal(t, attachmentTwo.GetName(), attachmentTwoRes.GetName())

	require.Equal(t, attachmentTwo.GetName(), attachmentTwoRes.GetName())
	require.Equal(t, attachmentTwo.GetContent(), attachmentTwoRes.GetContent())

	// verify memoOne's relations
	require.Len(t, memoOneRes.Relations, 1)
	memoOneExpectedRelation := &apipb.MemoRelation{
		Memo:        &apipb.MemoRelation_MemoRef{Name: memoTwo.GetName()},
		RelatedMemo: &apipb.MemoRelation_MemoRef{Name: memoOne.GetName()},
	}
	require.Equal(t, memoOneExpectedRelation.Memo.GetName(), memoOneRes.Relations[0].Memo.GetName())
	require.Equal(t, memoOneExpectedRelation.RelatedMemo.GetName(), memoOneRes.Relations[0].RelatedMemo.GetName())

	// ///////////////
	// VERIFY MEMO TWO
	// ///////////////
	memoTwoResIdx := slices.IndexFunc(memos.Memos, func(m *apipb.Memo) bool { return m.GetName() == memoTwo.GetName() })
	require.NotEqual(t, memoTwoResIdx, -1)

	memoTwoRes := memos.Memos[memoTwoResIdx]
	require.NotNil(t, memoTwoRes)

	require.Equal(t, fmt.Sprintf("users/%s", userTwo.Username), memoTwoRes.GetCreator())
	require.Equal(t, apipb.Visibility_PROTECTED, memoTwoRes.GetVisibility())
	require.Equal(t, memoTwo.Content, memoTwoRes.GetContent())
	require.Empty(t, memoTwoRes.Attachments)
	require.Len(t, memoTwoRes.Relations, 1)
	require.Empty(t, memoTwoRes.Reactions)

	// verify memoTwo's relations
	require.Len(t, memoTwoRes.Relations, 1)
	memoTwoExpectedRelation := &apipb.MemoRelation{
		Memo:        &apipb.MemoRelation_MemoRef{Name: memoTwo.GetName()},
		RelatedMemo: &apipb.MemoRelation_MemoRef{Name: memoOne.GetName()},
	}
	require.Equal(t, memoTwoExpectedRelation.Memo.GetName(), memoTwoRes.Relations[0].Memo.GetName())
	require.Equal(t, memoTwoExpectedRelation.RelatedMemo.GetName(), memoTwoRes.Relations[0].RelatedMemo.GetName())

	// ///////////////
	// VERIFY MEMO THREE
	// ///////////////
	memoThreeResIdx := slices.IndexFunc(memos.Memos, func(m *apipb.Memo) bool { return m.GetName() == memoThree.GetName() })
	require.NotEqual(t, memoThreeResIdx, -1)

	memoThreeRes := memos.Memos[memoThreeResIdx]
	require.NotNil(t, memoThreeRes)

	require.Equal(t, fmt.Sprintf("users/%s", userOne.Username), memoThreeRes.GetCreator())
	require.Equal(t, apipb.Visibility_PROTECTED, memoThreeRes.GetVisibility())
	require.Equal(t, memoThree.Content, memoThreeRes.GetContent())
	require.Empty(t, memoThreeRes.Attachments)
	require.Empty(t, memoThreeRes.Relations)
	require.Len(t, memoThreeRes.Reactions, 2)

	// verify memoThree's reactions
	require.Len(t, memoThreeRes.Reactions, 2)
	// userOne's reaction
	userOneReactionIdx := slices.IndexFunc(memoThreeRes.Reactions, func(r *apipb.Reaction) bool { return r.GetCreator() == fmt.Sprintf("users/%s", userOne.Username) })
	require.NotEqual(t, userOneReactionIdx, -1)

	userOneReaction := memoThreeRes.Reactions[userOneReactionIdx]
	require.NotNil(t, userOneReaction)
	require.Equal(t, "❤️", userOneReaction.ReactionType)

	// userTwo's reaction
	userTwoReactionIdx := slices.IndexFunc(memoThreeRes.Reactions, func(r *apipb.Reaction) bool { return r.GetCreator() == fmt.Sprintf("users/%s", userTwo.Username) })
	require.NotEqual(t, userTwoReactionIdx, -1)

	userTwoReaction := memoThreeRes.Reactions[userTwoReactionIdx]
	require.NotNil(t, userTwoReaction)
	require.Equal(t, "👍", userTwoReaction.ReactionType)
}

func TestListMemosTimeOrderBy(t *testing.T) {
	ctx := context.Background()

	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateHostUser(ctx, "time-order-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	memoEarlyCreateLateUpdate, err := ts.Service.CreateMemo(userCtx, &apipb.CreateMemoRequest{
		Memo: &apipb.Memo{
			Content:    "early create late update",
			Visibility: apipb.Visibility_PRIVATE,
			CreateTime: timestamppb.New(time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)),
			UpdateTime: timestamppb.New(time.Date(2020, 1, 3, 0, 0, 0, 0, time.UTC)),
		},
	})
	require.NoError(t, err)
	memoMiddleCreateEarlyUpdate, err := ts.Service.CreateMemo(userCtx, &apipb.CreateMemoRequest{
		Memo: &apipb.Memo{
			Content:    "middle create early update",
			Visibility: apipb.Visibility_PRIVATE,
			CreateTime: timestamppb.New(time.Date(2020, 1, 2, 0, 0, 0, 0, time.UTC)),
			UpdateTime: timestamppb.New(time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)),
		},
	})
	require.NoError(t, err)
	memoLateCreateMiddleUpdate, err := ts.Service.CreateMemo(userCtx, &apipb.CreateMemoRequest{
		Memo: &apipb.Memo{
			Content:    "late create middle update",
			Visibility: apipb.Visibility_PRIVATE,
			CreateTime: timestamppb.New(time.Date(2020, 1, 3, 0, 0, 0, 0, time.UTC)),
			UpdateTime: timestamppb.New(time.Date(2020, 1, 2, 0, 0, 0, 0, time.UTC)),
		},
	})
	require.NoError(t, err)

	tests := []struct {
		name      string
		orderBy   string
		wantNames []string
	}{
		{
			name:    "default create time",
			orderBy: "",
			wantNames: []string{
				memoLateCreateMiddleUpdate.Name,
				memoMiddleCreateEarlyUpdate.Name,
				memoEarlyCreateLateUpdate.Name,
			},
		},
		{
			name:    "explicit create time",
			orderBy: "create_time desc",
			wantNames: []string{
				memoLateCreateMiddleUpdate.Name,
				memoMiddleCreateEarlyUpdate.Name,
				memoEarlyCreateLateUpdate.Name,
			},
		},
		{
			name:    "explicit update time",
			orderBy: "update_time desc",
			wantNames: []string{
				memoEarlyCreateLateUpdate.Name,
				memoLateCreateMiddleUpdate.Name,
				memoMiddleCreateEarlyUpdate.Name,
			},
		},
		{
			name:    "pinned with explicit create time",
			orderBy: "pinned desc, create_time desc",
			wantNames: []string{
				memoLateCreateMiddleUpdate.Name,
				memoMiddleCreateEarlyUpdate.Name,
				memoEarlyCreateLateUpdate.Name,
			},
		},
		{
			name:    "explicit create time ascending",
			orderBy: "create_time asc",
			wantNames: []string{
				memoEarlyCreateLateUpdate.Name,
				memoMiddleCreateEarlyUpdate.Name,
				memoLateCreateMiddleUpdate.Name,
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			resp, err := ts.Service.ListMemos(userCtx, &apipb.ListMemosRequest{
				PageSize: 10,
				OrderBy:  test.orderBy,
			})
			require.NoError(t, err)
			require.Len(t, resp.Memos, len(test.wantNames))

			gotNames := make([]string, 0, len(resp.Memos))
			for _, memo := range resp.Memos {
				gotNames = append(gotNames, memo.Name)
			}
			require.Equal(t, test.wantNames, gotNames)
		})
	}

	_, err = ts.Service.ListMemos(userCtx, &apipb.ListMemosRequest{
		PageSize: 10,
		OrderBy:  "display_time desc",
	})
	require.Error(t, err)
}

func TestListMemosSkipsReactionsWithMissingCreators(t *testing.T) {
	ctx := context.Background()

	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "memo-owner")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)

	reactor, err := ts.CreateRegularUser(ctx, "memo-reactor")
	require.NoError(t, err)
	reactorCtx := ts.CreateUserContext(ctx, reactor.ID)

	memo, err := ts.Service.CreateMemo(ownerCtx, &apipb.CreateMemoRequest{
		Memo: &apipb.Memo{
			Content:    "memo with orphan reaction",
			Visibility: apipb.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	_, err = ts.Service.UpsertMemoReaction(reactorCtx, &apipb.UpsertMemoReactionRequest{
		Parent: memo.Name,
		Reaction: &apipb.Reaction{
			ReactionType: "👍",
		},
	})
	require.NoError(t, err)

	_, err = ts.Store.DeleteUser(ctx, &store.DeleteUser{ID: reactor.ID})
	require.NoError(t, err)

	resp, err := ts.Service.ListMemos(ownerCtx, &apipb.ListMemosRequest{PageSize: 10})
	require.NoError(t, err)
	require.Len(t, resp.Memos, 1)
	require.Equal(t, memo.Name, resp.Memos[0].Name)
	require.Empty(t, resp.Memos[0].Reactions)
}

func TestListMemosSkipsMemosWithMissingCreators(t *testing.T) {
	ctx := context.Background()

	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "memo-visible-owner")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)

	orphanCreator, err := ts.CreateRegularUser(ctx, "memo-orphan-creator")
	require.NoError(t, err)
	orphanCtx := ts.CreateUserContext(ctx, orphanCreator.ID)

	ownerMemo, err := ts.Service.CreateMemo(ownerCtx, &apipb.CreateMemoRequest{
		Memo: &apipb.Memo{
			Content:    "owner memo",
			Visibility: apipb.Visibility_PRIVATE,
		},
	})
	require.NoError(t, err)

	_, err = ts.Service.CreateMemo(orphanCtx, &apipb.CreateMemoRequest{
		Memo: &apipb.Memo{
			Content:    "orphan memo",
			Visibility: apipb.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	_, err = ts.Store.DeleteUser(ctx, &store.DeleteUser{ID: orphanCreator.ID})
	require.NoError(t, err)

	resp, err := ts.Service.ListMemos(ownerCtx, &apipb.ListMemosRequest{PageSize: 10})
	require.NoError(t, err)
	require.Len(t, resp.Memos, 1)
	require.Equal(t, ownerMemo.Name, resp.Memos[0].Name)
}

func TestListMemoCommentsSkipsCommentsWithMissingCreators(t *testing.T) {
	ctx := context.Background()

	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "comment-owner")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)

	commenter, err := ts.CreateRegularUser(ctx, "comment-orphan")
	require.NoError(t, err)
	commenterCtx := ts.CreateUserContext(ctx, commenter.ID)

	memo, err := ts.Service.CreateMemo(ownerCtx, &apipb.CreateMemoRequest{
		Memo: &apipb.Memo{
			Content:    "memo with comment",
			Visibility: apipb.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	_, err = ts.Service.CreateMemoComment(commenterCtx, &apipb.CreateMemoCommentRequest{
		Parent: memo.Name,
		Comment: &apipb.Memo{
			Content:    "comment to orphan",
			Visibility: apipb.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	_, err = ts.Store.DeleteUser(ctx, &store.DeleteUser{ID: commenter.ID})
	require.NoError(t, err)

	resp, err := ts.Service.ListMemoComments(ownerCtx, &apipb.ListMemoCommentsRequest{Parent: memo.Name})
	require.NoError(t, err)
	require.Empty(t, resp.Comments)
}

func TestCreateMemoCommentRejectsSelfReference(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "comment-self-reference-owner")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)
	memo, err := ts.Service.CreateMemo(ownerCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{
		Content: "comment context", Visibility: apipb.Visibility_PUBLIC,
	}})
	require.NoError(t, err)

	_, err = ts.Service.CreateMemoComment(ownerCtx, &apipb.CreateMemoCommentRequest{
		Parent:    memo.Name,
		CommentId: memo.Name[len("memos/"):],
		Comment:   &apipb.Memo{Content: "self reference", Visibility: apipb.Visibility_PUBLIC},
	})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	comments, err := ts.Service.ListMemoComments(ownerCtx, &apipb.ListMemoCommentsRequest{Parent: memo.Name})
	require.NoError(t, err)
	require.Empty(t, comments.Comments)
}

func TestUpdateMemoPlacementAndAudienceContract(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	sourceAdmin, err := ts.CreateRegularUser(ctx, "placement-source-admin")
	require.NoError(t, err)
	author, err := ts.CreateRegularUser(ctx, "placement-author")
	require.NoError(t, err)
	sourceAdminCtx := ts.CreateUserContext(ctx, sourceAdmin.ID)
	authorCtx := ts.CreateUserContext(ctx, author.ID)

	source, err := ts.Service.CreateSpace(sourceAdminCtx, &apipb.CreateSpaceRequest{
		SpaceId: "placement-source",
		Space:   &apipb.Space{Title: "Placement Source"},
	})
	require.NoError(t, err)
	target, err := ts.Service.CreateSpace(authorCtx, &apipb.CreateSpaceRequest{
		SpaceId: "placement-target",
		Space:   &apipb.Space{Title: "Placement Target"},
	})
	require.NoError(t, err)
	invitation, err := ts.Service.CreateSpaceInvitation(sourceAdminCtx, &apipb.CreateSpaceInvitationRequest{
		Parent: source.Name,
		SpaceInvitation: &apipb.SpaceInvitation{
			Invitee: "users/" + author.Username,
			Role:    apipb.SpaceMember_USER,
		},
	})
	require.NoError(t, err)
	_, err = ts.Service.AcceptSpaceInvitation(authorCtx, &apipb.AcceptSpaceInvitationRequest{Name: invitation.Name})
	require.NoError(t, err)

	protectedMemo, err := ts.Service.CreateMemo(authorCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{
		Content: "assign without audience change", Visibility: apipb.Visibility_PROTECTED,
	}})
	require.NoError(t, err)
	sourceName := source.Name
	protectedMemo, err = ts.Service.UpdateMemo(authorCtx, &apipb.UpdateMemoRequest{
		Memo:       &apipb.Memo{Name: protectedMemo.Name, Space: &sourceName},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"space"}},
	})
	require.NoError(t, err)
	require.Equal(t, source.Name, protectedMemo.GetSpace())
	require.Equal(t, apipb.Visibility_PROTECTED, protectedMemo.Visibility, "assigning must preserve the memo audience")

	_, err = ts.Service.UpdateMemo(sourceAdminCtx, &apipb.UpdateMemoRequest{
		Memo:       &apipb.Memo{Name: protectedMemo.Name},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"space"}},
	})
	require.Equal(t, codes.PermissionDenied, status.Code(err), "Space administrators cannot change another author's memo placement")
	protectedMemo, err = ts.Service.GetMemo(authorCtx, &apipb.GetMemoRequest{Name: protectedMemo.Name})
	require.NoError(t, err)
	require.Equal(t, source.Name, protectedMemo.GetSpace())

	unassigned, err := ts.Service.CreateMemo(authorCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{
		Content: "unassigned", Visibility: apipb.Visibility_PRIVATE,
	}})
	require.NoError(t, err)
	_, err = ts.Service.UpdateMemo(authorCtx, &apipb.UpdateMemoRequest{
		Memo:       &apipb.Memo{Name: unassigned.Name, Visibility: apipb.Visibility_SPACE},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"visibility"}},
	})
	require.Equal(t, codes.InvalidArgument, status.Code(err), "SPACE visibility requires an assigned Space")

	spaceMembersMemo, err := ts.Service.CreateMemo(authorCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{
		Content: "members audience", Visibility: apipb.Visibility_SPACE, Space: &sourceName,
	}})
	require.NoError(t, err)
	targetName := target.Name
	_, err = ts.Service.UpdateMemo(authorCtx, &apipb.UpdateMemoRequest{
		Memo:       &apipb.Memo{Name: spaceMembersMemo.Name, Space: &targetName},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"space"}},
	})
	require.Equal(t, codes.InvalidArgument, status.Code(err), "moving SPACE visibility requires an explicit audience confirmation")
	_, err = ts.Service.UpdateMemo(authorCtx, &apipb.UpdateMemoRequest{
		Memo:       &apipb.Memo{Name: spaceMembersMemo.Name},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"space"}},
	})
	require.Equal(t, codes.InvalidArgument, status.Code(err), "unassigning SPACE visibility requires a replacement audience")
	spaceMembersMemo, err = ts.Service.UpdateMemo(authorCtx, &apipb.UpdateMemoRequest{
		Memo:       &apipb.Memo{Name: spaceMembersMemo.Name, Visibility: apipb.Visibility_PRIVATE},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"space", "visibility"}},
	})
	require.NoError(t, err)
	require.Nil(t, spaceMembersMemo.Space)
	require.Equal(t, apipb.Visibility_PRIVATE, spaceMembersMemo.Visibility)

	moveMemo, err := ts.Service.CreateMemo(authorCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{
		Content: "move original", Visibility: apipb.Visibility_PUBLIC, Space: &sourceName,
	}})
	require.NoError(t, err)
	withdrawMemo, err := ts.Service.CreateMemo(authorCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{
		Content: "withdraw original", Visibility: apipb.Visibility_PUBLIC, Space: &sourceName,
	}})
	require.NoError(t, err)
	membersOnlyMemo, err := ts.Service.CreateMemo(authorCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{
		Content: "members only", Visibility: apipb.Visibility_SPACE, Space: &sourceName,
	}})
	require.NoError(t, err)
	_, err = ts.Service.DeleteSpaceMember(sourceAdminCtx, &apipb.DeleteSpaceMemberRequest{
		Name: source.Name + "/members/" + author.Username,
	})
	require.NoError(t, err)
	_, err = ts.Service.GetMemo(authorCtx, &apipb.GetMemoRequest{Name: membersOnlyMemo.Name})
	require.Equal(t, codes.PermissionDenied, status.Code(err), "the author loses SPACE audience read access after leaving the Space")

	_, err = ts.Service.UpdateMemo(authorCtx, &apipb.UpdateMemoRequest{
		Memo:       &apipb.Memo{Name: moveMemo.Name, Space: &targetName, Content: "smuggled content"},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"space", "content"}},
	})
	require.Equal(t, codes.PermissionDenied, status.Code(err), "a removed author cannot smuggle content into a lifecycle move")
	unchangedMove, err := ts.Service.GetMemo(authorCtx, &apipb.GetMemoRequest{Name: moveMemo.Name})
	require.NoError(t, err)
	require.Equal(t, "move original", unchangedMove.Content)
	require.Equal(t, source.Name, unchangedMove.GetSpace())

	moved, err := ts.Service.UpdateMemo(authorCtx, &apipb.UpdateMemoRequest{
		Memo:       &apipb.Memo{Name: moveMemo.Name, Space: &targetName},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"space"}},
	})
	require.NoError(t, err)
	require.Equal(t, target.Name, moved.GetSpace())
	require.Equal(t, "move original", moved.Content)
	require.Equal(t, apipb.Visibility_PUBLIC, moved.Visibility)

	withdrawn, err := ts.Service.UpdateMemo(authorCtx, &apipb.UpdateMemoRequest{
		Memo:       &apipb.Memo{Name: withdrawMemo.Name},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"space"}},
	})
	require.NoError(t, err)
	require.Nil(t, withdrawn.Space)
	require.Equal(t, "withdraw original", withdrawn.Content)
	require.Equal(t, apipb.Visibility_PUBLIC, withdrawn.Visibility)
}

func TestListMemoCommentsPaginates(t *testing.T) {
	ctx := context.Background()

	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "comment-page-owner")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)

	memo, err := ts.Service.CreateMemo(ownerCtx, &apipb.CreateMemoRequest{
		Memo: &apipb.Memo{
			Content:    "memo with paged comments",
			Visibility: apipb.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	for i := 0; i < 3; i++ {
		_, err = ts.Service.CreateMemoComment(ownerCtx, &apipb.CreateMemoCommentRequest{
			Parent: memo.Name,
			Comment: &apipb.Memo{
				Content:    fmt.Sprintf("comment %d", i),
				Visibility: apipb.Visibility_PUBLIC,
			},
		})
		require.NoError(t, err)
	}

	firstPage, err := ts.Service.ListMemoComments(ownerCtx, &apipb.ListMemoCommentsRequest{Parent: memo.Name, PageSize: 2})
	require.NoError(t, err)
	require.Len(t, firstPage.Comments, 2)
	require.NotEmpty(t, firstPage.NextPageToken)

	secondPage, err := ts.Service.ListMemoComments(ownerCtx, &apipb.ListMemoCommentsRequest{Parent: memo.Name, PageToken: firstPage.NextPageToken})
	require.NoError(t, err)
	require.Len(t, secondPage.Comments, 1)
	require.Empty(t, secondPage.NextPageToken)
}

func TestListMemoCommentsFiltersArchivedBeforePagination(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "comment-archive-page-owner")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)
	memo, err := ts.Service.CreateMemo(ownerCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{
		Content:    "memo with archived comments",
		Visibility: apipb.Visibility_PUBLIC,
	}})
	require.NoError(t, err)

	comments := make([]*apipb.Memo, 0, 5)
	for i := 0; i < 5; i++ {
		comment, err := ts.Service.CreateMemoComment(ownerCtx, &apipb.CreateMemoCommentRequest{
			Parent:  memo.Name,
			Comment: &apipb.Memo{Content: fmt.Sprintf("comment %d", i)},
		})
		require.NoError(t, err)
		comments = append(comments, comment)
	}
	for _, comment := range comments[3:] {
		_, err := ts.Service.UpdateMemo(ownerCtx, &apipb.UpdateMemoRequest{
			Memo:       &apipb.Memo{Name: comment.Name, State: apipb.State_ARCHIVED},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"state"}},
		})
		require.NoError(t, err)
	}

	firstPage, err := ts.Service.ListMemoComments(ownerCtx, &apipb.ListMemoCommentsRequest{Parent: memo.Name, PageSize: 2})
	require.NoError(t, err)
	require.Len(t, firstPage.Comments, 2)
	require.NotEmpty(t, firstPage.NextPageToken)
	secondPage, err := ts.Service.ListMemoComments(ownerCtx, &apipb.ListMemoCommentsRequest{Parent: memo.Name, PageToken: firstPage.NextPageToken})
	require.NoError(t, err)
	require.Len(t, secondPage.Comments, 1)
	require.Empty(t, secondPage.NextPageToken)
}

func TestMemoCommentKeepsIndependentVisibilityAndAllowsAudienceUpdates(t *testing.T) {
	ctx := context.Background()

	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "private-comment-owner")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)

	parent, err := ts.Service.CreateMemo(ownerCtx, &apipb.CreateMemoRequest{
		Memo: &apipb.Memo{
			Content:    "private parent",
			Visibility: apipb.Visibility_PRIVATE,
		},
	})
	require.NoError(t, err)

	comment, err := ts.Service.CreateMemoComment(ownerCtx, &apipb.CreateMemoCommentRequest{
		Parent: parent.Name,
		Comment: &apipb.Memo{
			Content:    "client requested public comment",
			Visibility: apipb.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)
	require.Equal(t, apipb.Visibility_PUBLIC, comment.Visibility)

	_, err = ts.Service.UpdateMemo(ownerCtx, &apipb.UpdateMemoRequest{
		Memo: &apipb.Memo{
			Name:       comment.Name,
			Visibility: apipb.Visibility_PROTECTED,
		},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"visibility"}},
	})
	require.NoError(t, err)

	updatedComment, err := ts.Service.GetMemo(ownerCtx, &apipb.GetMemoRequest{Name: comment.Name})
	require.NoError(t, err)
	require.Equal(t, apipb.Visibility_PROTECTED, updatedComment.Visibility)

	unchangedParent, err := ts.Service.GetMemo(ownerCtx, &apipb.GetMemoRequest{Name: parent.Name})
	require.NoError(t, err)
	require.Equal(t, apipb.Visibility_PRIVATE, unchangedParent.Visibility)
}

func TestCreateMemoCommentDoesNotRevealArchivedPrivateMemo(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "archived-comment-owner")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)
	other, err := ts.CreateRegularUser(ctx, "archived-comment-other")
	require.NoError(t, err)
	otherCtx := ts.CreateUserContext(ctx, other.ID)
	parent, err := ts.Service.CreateMemo(ownerCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{
		Content:    "archived private parent",
		Visibility: apipb.Visibility_PRIVATE,
	}})
	require.NoError(t, err)
	_, err = ts.Service.UpdateMemo(ownerCtx, &apipb.UpdateMemoRequest{
		Memo:       &apipb.Memo{Name: parent.Name, State: apipb.State_ARCHIVED},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"state"}},
	})
	require.NoError(t, err)

	_, err = ts.Service.CreateMemoComment(otherCtx, &apipb.CreateMemoCommentRequest{
		Parent:  parent.Name,
		Comment: &apipb.Memo{Content: "should not reveal parent state"},
	})
	require.Equal(t, codes.NotFound, status.Code(err))

	_, err = ts.Service.CreateMemoComment(ownerCtx, &apipb.CreateMemoCommentRequest{
		Parent:  parent.Name,
		Comment: &apipb.Memo{Content: "owner still cannot comment"},
	})
	require.Equal(t, codes.FailedPrecondition, status.Code(err))
}

func TestGetMemoCommentUsesMemoLocalReadAccessAndConcealsContext(t *testing.T) {
	ctx := context.Background()

	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "legacy-comment-owner")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)

	other, err := ts.CreateRegularUser(ctx, "legacy-comment-other")
	require.NoError(t, err)
	otherCtx := ts.CreateUserContext(ctx, other.ID)

	parent, err := ts.Service.CreateMemo(ownerCtx, &apipb.CreateMemoRequest{
		Memo: &apipb.Memo{
			Content:    "private parent for legacy comment",
			Visibility: apipb.Visibility_PRIVATE,
		},
	})
	require.NoError(t, err)

	createdComment, err := ts.Service.CreateMemoComment(ownerCtx, &apipb.CreateMemoCommentRequest{
		Parent: parent.Name,
		Comment: &apipb.Memo{
			Content:    "public comment with private context",
			Visibility: apipb.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	commentName := createdComment.Name
	publicComment, err := ts.Service.GetMemo(ctx, &apipb.GetMemoRequest{Name: commentName})
	require.NoError(t, err)
	require.Equal(t, parent.Name, publicComment.GetParent(), "parent identity remains available without granting access")

	otherComment, err := ts.Service.GetMemo(otherCtx, &apipb.GetMemoRequest{Name: commentName})
	require.NoError(t, err)
	require.Equal(t, parent.Name, otherComment.GetParent(), "parent identity is independent of parent readability")

	comment, err := ts.Service.GetMemo(ownerCtx, &apipb.GetMemoRequest{Name: commentName})
	require.NoError(t, err)
	require.Equal(t, parent.Name, comment.GetParent())

	_, err = ts.Service.ListMemoComments(ctx, &apipb.ListMemoCommentsRequest{Parent: parent.Name})
	require.Equal(t, codes.Unauthenticated, status.Code(err))

	_, err = ts.Service.ListMemoComments(otherCtx, &apipb.ListMemoCommentsRequest{Parent: parent.Name})
	require.Equal(t, codes.PermissionDenied, status.Code(err))

	comments, err := ts.Service.ListMemoComments(ownerCtx, &apipb.ListMemoCommentsRequest{Parent: parent.Name})
	require.NoError(t, err)
	require.Len(t, comments.Comments, 1)
	require.Equal(t, commentName, comments.Comments[0].Name)
}

func TestAssignedMemoCommentListingUsesMemoLocalReadAccess(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "assigned-comment-owner")
	require.NoError(t, err)
	member, err := ts.CreateRegularUser(ctx, "assigned-comment-member")
	require.NoError(t, err)
	outsider, err := ts.CreateRegularUser(ctx, "assigned-comment-outsider")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)
	memberCtx := ts.CreateUserContext(ctx, member.ID)
	outsiderCtx := ts.CreateUserContext(ctx, outsider.ID)

	space, err := ts.Store.CreateSpace(ctx, &store.Space{UID: "assigned-comment-space", Title: "Assigned comments"}, owner.ID)
	require.NoError(t, err)
	_, err = ts.InviteAndAcceptSpaceMember(ctx, &store.SpaceMember{
		SpaceID: space.ID,
		UserID:  member.ID,
		Role:    store.SpaceMemberRoleAdmin,
	}, owner.ID)
	require.NoError(t, err)
	contextMemo, err := ts.Service.CreateMemo(ownerCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{
		Content:    "assigned public comment context",
		Visibility: apipb.Visibility_PUBLIC,
		Space:      ptr("spaces/" + space.UID),
	}})
	require.NoError(t, err)
	comment, err := ts.Service.CreateMemoComment(memberCtx, &apipb.CreateMemoCommentRequest{
		Parent: contextMemo.Name,
		Comment: &apipb.Memo{
			Content:    "public independently readable comment",
			Visibility: apipb.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	comments, err := ts.Service.ListMemoComments(memberCtx, &apipb.ListMemoCommentsRequest{Parent: contextMemo.Name})
	require.NoError(t, err)
	require.Len(t, comments.Comments, 1)
	require.Equal(t, comment.Name, comments.Comments[0].Name)

	comments, err = ts.Service.ListMemoComments(ctx, &apipb.ListMemoCommentsRequest{Parent: contextMemo.Name})
	require.NoError(t, err)
	require.Len(t, comments.Comments, 1, "anonymous access follows the PUBLIC context and comment audiences")
	comments, err = ts.Service.ListMemoComments(outsiderCtx, &apipb.ListMemoCommentsRequest{Parent: contextMemo.Name})
	require.NoError(t, err)
	require.Len(t, comments.Comments, 1, "Space placement adds no read gate for a signed-in non-member")
	directComment, err := ts.Service.GetMemo(outsiderCtx, &apipb.GetMemoRequest{Name: comment.Name})
	require.NoError(t, err, "the comment memo remains independently readable")
	require.Equal(t, contextMemo.Name, directComment.GetParent(), "two-endpoint relation projection remains memo-local")

	require.NoError(t, ts.Store.DeleteSpaceMember(ctx, &store.DeleteSpaceMember{SpaceID: space.ID, UserID: owner.ID}, owner.ID))
	comments, err = ts.Service.ListMemoComments(ownerCtx, &apipb.ListMemoCommentsRequest{Parent: contextMemo.Name})
	require.NoError(t, err)
	require.Len(t, comments.Comments, 1, "the removed author still reads PUBLIC memos through their audience")
}

func TestMemoCommentDoesNotFollowParentVisibilityChanges(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "dynamic-comment-owner")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)
	parent, err := ts.Service.CreateMemo(ownerCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{
		Content:    "initially private",
		Visibility: apipb.Visibility_PRIVATE,
	}})
	require.NoError(t, err)
	comment, err := ts.Service.CreateMemoComment(ownerCtx, &apipb.CreateMemoCommentRequest{
		Parent:  parent.Name,
		Comment: &apipb.Memo{Content: "independently private"},
	})
	require.NoError(t, err)
	require.Equal(t, apipb.Visibility_PRIVATE, comment.Visibility)

	_, err = ts.Service.UpdateMemo(ownerCtx, &apipb.UpdateMemoRequest{
		Memo:       &apipb.Memo{Name: parent.Name, Visibility: apipb.Visibility_PUBLIC},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"visibility"}},
	})
	require.NoError(t, err)

	_, err = ts.Service.GetMemo(ctx, &apipb.GetMemoRequest{Name: comment.Name})
	require.Equal(t, codes.Unauthenticated, status.Code(err))
	comments, err := ts.Service.ListMemoComments(ctx, &apipb.ListMemoCommentsRequest{Parent: parent.Name})
	require.NoError(t, err)
	require.Empty(t, comments.Comments, "context visibility must not expand a private comment")
}

func TestGlobalFeedExcludesCommentsAndDeletesThemWithContext(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "comment-feed-owner")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)
	contextMemo, err := ts.Service.CreateMemo(ownerCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{
		Content: "context", Visibility: apipb.Visibility_PUBLIC,
	}})
	require.NoError(t, err)
	comment, err := ts.Service.CreateMemoComment(ownerCtx, &apipb.CreateMemoCommentRequest{
		Parent: contextMemo.Name, Comment: &apipb.Memo{Content: "independent comment", Visibility: apipb.Visibility_PUBLIC},
	})
	require.NoError(t, err)

	feed, err := ts.Service.ListMemos(ownerCtx, &apipb.ListMemosRequest{PageSize: 20})
	require.NoError(t, err)
	require.Len(t, feed.Memos, 1)
	require.Equal(t, contextMemo.Name, feed.Memos[0].Name)

	_, err = ts.Service.DeleteMemo(ownerCtx, &apipb.DeleteMemoRequest{Name: contextMemo.Name})
	require.NoError(t, err)
	_, err = ts.Service.GetMemo(ownerCtx, &apipb.GetMemoRequest{Name: comment.Name})
	require.Equal(t, codes.NotFound, status.Code(err))

	feed, err = ts.Service.ListMemos(ownerCtx, &apipb.ListMemosRequest{PageSize: 20})
	require.NoError(t, err)
	require.Empty(t, feed.Memos)
}

// TestCreateMemoWithCustomTimestamps tests that custom timestamps can be set when creating memos and comments.
// This addresses issue #5483: https://github.com/usememos/memos/issues/5483
func TestCreateMemoWithCustomTimestamps(t *testing.T) {
	ctx := context.Background()

	ts := NewTestService(t)
	defer ts.Cleanup()

	// Create a test user
	user, err := ts.CreateRegularUser(ctx, "test-user-timestamps")
	require.NoError(t, err)
	require.NotNil(t, user)

	userCtx := ts.CreateUserContext(ctx, user.ID)

	// Define custom timestamps (January 1, 2020)
	customCreateTime := time.Date(2020, 1, 1, 12, 0, 0, 0, time.UTC)
	customUpdateTime := time.Date(2020, 1, 2, 12, 0, 0, 0, time.UTC)

	// Test 1: Create a memo with custom create_time
	memoWithCreateTime, err := ts.Service.CreateMemo(userCtx, &apipb.CreateMemoRequest{
		Memo: &apipb.Memo{
			Content:    "This memo has a custom creation time",
			Visibility: apipb.Visibility_PRIVATE,
			CreateTime: timestamppb.New(customCreateTime),
		},
	})
	require.NoError(t, err)
	require.NotNil(t, memoWithCreateTime)
	require.Equal(t, customCreateTime.Unix(), memoWithCreateTime.CreateTime.AsTime().Unix(), "create_time should match the custom timestamp")

	// Test 2: Create a memo with custom update_time
	memoWithUpdateTime, err := ts.Service.CreateMemo(userCtx, &apipb.CreateMemoRequest{
		Memo: &apipb.Memo{
			Content:    "This memo has a custom update time",
			Visibility: apipb.Visibility_PRIVATE,
			UpdateTime: timestamppb.New(customUpdateTime),
		},
	})
	require.NoError(t, err)
	require.NotNil(t, memoWithUpdateTime)
	require.Equal(t, customUpdateTime.Unix(), memoWithUpdateTime.UpdateTime.AsTime().Unix(), "update_time should match the custom timestamp")

	// Test 3: Create a memo with all custom timestamps
	memoWithAllTimestamps, err := ts.Service.CreateMemo(userCtx, &apipb.CreateMemoRequest{
		Memo: &apipb.Memo{
			Content:    "This memo has all custom timestamps",
			Visibility: apipb.Visibility_PRIVATE,
			CreateTime: timestamppb.New(customCreateTime),
			UpdateTime: timestamppb.New(customUpdateTime),
		},
	})
	require.NoError(t, err)
	require.NotNil(t, memoWithAllTimestamps)
	require.Equal(t, customCreateTime.Unix(), memoWithAllTimestamps.CreateTime.AsTime().Unix(), "create_time should match the custom timestamp")
	require.Equal(t, customUpdateTime.Unix(), memoWithAllTimestamps.UpdateTime.AsTime().Unix(), "update_time should match the custom timestamp")

	// Test 4: Create a comment (memo relation) with custom timestamps
	parentMemo, err := ts.Service.CreateMemo(userCtx, &apipb.CreateMemoRequest{
		Memo: &apipb.Memo{
			Content:    "This is the parent memo",
			Visibility: apipb.Visibility_PRIVATE,
		},
	})
	require.NoError(t, err)
	require.NotNil(t, parentMemo)

	customCommentCreateTime := time.Date(2021, 6, 15, 10, 30, 0, 0, time.UTC)
	comment, err := ts.Service.CreateMemoComment(userCtx, &apipb.CreateMemoCommentRequest{
		Parent: parentMemo.Name,
		Comment: &apipb.Memo{
			Content:    "This is a comment with custom create time",
			Visibility: apipb.Visibility_PRIVATE,
			CreateTime: timestamppb.New(customCommentCreateTime),
		},
	})
	require.NoError(t, err)
	require.NotNil(t, comment)
	require.Equal(t, customCommentCreateTime.Unix(), comment.CreateTime.AsTime().Unix(), "comment create_time should match the custom timestamp")

	// Test 5: Verify that memos without custom timestamps still get auto-generated ones
	memoWithoutTimestamps, err := ts.Service.CreateMemo(userCtx, &apipb.CreateMemoRequest{
		Memo: &apipb.Memo{
			Content:    "This memo has auto-generated timestamps",
			Visibility: apipb.Visibility_PRIVATE,
		},
	})
	require.NoError(t, err)
	require.NotNil(t, memoWithoutTimestamps)
	require.NotNil(t, memoWithoutTimestamps.CreateTime, "create_time should be auto-generated")
	require.NotNil(t, memoWithoutTimestamps.UpdateTime, "update_time should be auto-generated")
	require.True(t, time.Now().Unix()-memoWithoutTimestamps.CreateTime.AsTime().Unix() < 5, "create_time should be recent (within 5 seconds)")
}
