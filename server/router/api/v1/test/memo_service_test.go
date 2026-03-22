package test

import (
	"context"
	"fmt"
	"slices"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/timestamppb"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
)

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
	attachmentOne, err := ts.Service.CreateAttachment(userOneCtx, &apiv1.CreateAttachmentRequest{
		Attachment: &apiv1.Attachment{
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
	attachmentTwo, err := ts.Service.CreateAttachment(userOneCtx, &apiv1.CreateAttachmentRequest{
		Attachment: &apiv1.Attachment{
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
	memoOne, err := ts.Service.CreateMemo(userOneCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "Hellooo, any words after this sentence won't be in the snippet. This is the next sentence. And I also have two attachments.",
			Visibility: apiv1.Visibility_PROTECTED,
			Attachments: []*apiv1.Attachment{
				&apiv1.Attachment{
					Name: attachmentOne.Name,
				},
				&apiv1.Attachment{
					Name: attachmentTwo.Name,
				},
			},
		},
	})

	require.NoError(t, err)
	require.NotNil(t, memoOne)

	// Create memoTwo by userTwo referencing memoOne
	memoTwo, err := ts.Service.CreateMemo(userTwoCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "This is a memo reminding you to check the attachment attached to memoOne. I have referenced the memo below.⬇️",
			Visibility: apiv1.Visibility_PROTECTED,
			Relations: []*apiv1.MemoRelation{
				&apiv1.MemoRelation{
					RelatedMemo: &apiv1.MemoRelation_Memo{
						Name: memoOne.Name,
					},
				},
			},
		},
	})

	require.NoError(t, err)
	require.NotNil(t, memoTwo)

	// Create memoThree by userOne
	memoThree, err := ts.Service.CreateMemo(userOneCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "This is a very popular memo. I have 2 reactions!",
			Visibility: apiv1.Visibility_PROTECTED,
		},
	})

	require.NoError(t, err)
	require.NotNil(t, memoThree)

	// Create reaction from userOne on memoThree
	reactionOne, err := ts.Service.UpsertMemoReaction(userOneCtx, &apiv1.UpsertMemoReactionRequest{
		Name: memoThree.Name,
		Reaction: &apiv1.Reaction{
			ContentId:    memoThree.Name,
			ReactionType: "❤️",
		},
	})

	require.NoError(t, err)
	require.NotNil(t, reactionOne)

	// Create reaction from userTwo on memoThree
	reactionTwo, err := ts.Service.UpsertMemoReaction(userTwoCtx, &apiv1.UpsertMemoReactionRequest{
		Name: memoThree.Name,
		Reaction: &apiv1.Reaction{
			ContentId:    memoThree.Name,
			ReactionType: "👍",
		},
	})

	require.NoError(t, err)
	require.NotNil(t, reactionTwo)

	memos, err := ts.Service.ListMemos(userOneCtx, &apiv1.ListMemosRequest{PageSize: 10})

	require.NoError(t, err)
	require.NotNil(t, memos)
	require.Equal(t, 3, len(memos.Memos))

	// ///////////////
	// VERIFY MEMO ONE
	// ///////////////
	memoOneResIdx := slices.IndexFunc(memos.Memos, func(m *apiv1.Memo) bool { return m.GetName() == memoOne.GetName() })
	require.NotEqual(t, memoOneResIdx, -1)

	memoOneRes := memos.Memos[memoOneResIdx]
	require.NotNil(t, memoOneRes)

	require.Equal(t, fmt.Sprintf("users/%d", userOne.ID), memoOneRes.GetCreator())
	require.Equal(t, apiv1.Visibility_PROTECTED, memoOneRes.GetVisibility())
	require.Equal(t, memoOne.Content, memoOneRes.GetContent())
	require.Equal(t, memoOne.Content[:64]+"...", memoOneRes.GetSnippet(), "memoOne's content is snipped past the 64 char limit")
	require.Len(t, memoOneRes.Attachments, 2)
	require.Len(t, memoOneRes.Relations, 1)
	require.Empty(t, memoOneRes.Reactions)

	// verify memoOne's attachments
	// attachment one
	attachmentOneResIdx := slices.IndexFunc(memoOneRes.Attachments, func(a *apiv1.Attachment) bool { return a.GetName() == attachmentOne.GetName() })
	require.NotEqual(t, attachmentOneResIdx, -1)

	attachmentOneRes := memoOneRes.Attachments[attachmentOneResIdx]
	require.NotNil(t, attachmentOneRes)

	require.Equal(t, attachmentOne.GetName(), attachmentOneRes.GetName())
	require.Equal(t, attachmentOne.GetContent(), attachmentOneRes.GetContent())

	// attachment two
	attachmentTwoResIdx := slices.IndexFunc(memoOneRes.Attachments, func(a *apiv1.Attachment) bool { return a.GetName() == attachmentTwo.GetName() })
	require.NotEqual(t, attachmentTwoResIdx, -1)

	attachmentTwoRes := memoOneRes.Attachments[attachmentTwoResIdx]
	require.NotNil(t, attachmentTwoRes)
	require.Equal(t, attachmentTwo.GetName(), attachmentTwoRes.GetName())

	require.Equal(t, attachmentTwo.GetName(), attachmentTwoRes.GetName())
	require.Equal(t, attachmentTwo.GetContent(), attachmentTwoRes.GetContent())

	// verify memoOne's relations
	require.Len(t, memoOneRes.Relations, 1)
	memoOneExpectedRelation := &apiv1.MemoRelation{
		Memo:        &apiv1.MemoRelation_Memo{Name: memoTwo.GetName()},
		RelatedMemo: &apiv1.MemoRelation_Memo{Name: memoOne.GetName()},
	}
	require.Equal(t, memoOneExpectedRelation.Memo.GetName(), memoOneRes.Relations[0].Memo.GetName())
	require.Equal(t, memoOneExpectedRelation.RelatedMemo.GetName(), memoOneRes.Relations[0].RelatedMemo.GetName())

	// ///////////////
	// VERIFY MEMO TWO
	// ///////////////
	memoTwoResIdx := slices.IndexFunc(memos.Memos, func(m *apiv1.Memo) bool { return m.GetName() == memoTwo.GetName() })
	require.NotEqual(t, memoTwoResIdx, -1)

	memoTwoRes := memos.Memos[memoTwoResIdx]
	require.NotNil(t, memoTwoRes)

	require.Equal(t, fmt.Sprintf("users/%d", userTwo.ID), memoTwoRes.GetCreator())
	require.Equal(t, apiv1.Visibility_PROTECTED, memoTwoRes.GetVisibility())
	require.Equal(t, memoTwo.Content, memoTwoRes.GetContent())
	require.Empty(t, memoTwoRes.Attachments)
	require.Len(t, memoTwoRes.Relations, 1)
	require.Empty(t, memoTwoRes.Reactions)

	// verify memoTwo's relations
	require.Len(t, memoTwoRes.Relations, 1)
	memoTwoExpectedRelation := &apiv1.MemoRelation{
		Memo:        &apiv1.MemoRelation_Memo{Name: memoTwo.GetName()},
		RelatedMemo: &apiv1.MemoRelation_Memo{Name: memoOne.GetName()},
	}
	require.Equal(t, memoTwoExpectedRelation.Memo.GetName(), memoTwoRes.Relations[0].Memo.GetName())
	require.Equal(t, memoTwoExpectedRelation.RelatedMemo.GetName(), memoTwoRes.Relations[0].RelatedMemo.GetName())

	// ///////////////
	// VERIFY MEMO THREE
	// ///////////////
	memoThreeResIdx := slices.IndexFunc(memos.Memos, func(m *apiv1.Memo) bool { return m.GetName() == memoThree.GetName() })
	require.NotEqual(t, memoThreeResIdx, -1)

	memoThreeRes := memos.Memos[memoThreeResIdx]
	require.NotNil(t, memoThreeRes)

	require.Equal(t, fmt.Sprintf("users/%d", userOne.ID), memoThreeRes.GetCreator())
	require.Equal(t, apiv1.Visibility_PROTECTED, memoThreeRes.GetVisibility())
	require.Equal(t, memoThree.Content, memoThreeRes.GetContent())
	require.Empty(t, memoThreeRes.Attachments)
	require.Empty(t, memoThreeRes.Relations)
	require.Len(t, memoThreeRes.Reactions, 2)

	// verify memoThree's reactions
	require.Len(t, memoThreeRes.Reactions, 2)
	// userOne's reaction
	userOneReactionIdx := slices.IndexFunc(memoThreeRes.Reactions, func(r *apiv1.Reaction) bool { return r.GetCreator() == fmt.Sprintf("users/%d", userOne.ID) })
	require.NotEqual(t, userOneReactionIdx, -1)

	userOneReaction := memoThreeRes.Reactions[userOneReactionIdx]
	require.NotNil(t, userOneReaction)
	require.Equal(t, "❤️", userOneReaction.ReactionType)

	// userTwo's reaction
	userTwoReactionIdx := slices.IndexFunc(memoThreeRes.Reactions, func(r *apiv1.Reaction) bool { return r.GetCreator() == fmt.Sprintf("users/%d", userTwo.ID) })
	require.NotEqual(t, userTwoReactionIdx, -1)

	userTwoReaction := memoThreeRes.Reactions[userTwoReactionIdx]
	require.NotNil(t, userTwoReaction)
	require.Equal(t, "👍", userTwoReaction.ReactionType)
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
	customDisplayTime := time.Date(2020, 1, 3, 12, 0, 0, 0, time.UTC)

	// Test 1: Create a memo with custom create_time
	memoWithCreateTime, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "This memo has a custom creation time",
			Visibility: apiv1.Visibility_PRIVATE,
			CreateTime: timestamppb.New(customCreateTime),
		},
	})
	require.NoError(t, err)
	require.NotNil(t, memoWithCreateTime)
	require.Equal(t, customCreateTime.Unix(), memoWithCreateTime.CreateTime.AsTime().Unix(), "create_time should match the custom timestamp")

	// Test 2: Create a memo with custom update_time
	memoWithUpdateTime, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "This memo has a custom update time",
			Visibility: apiv1.Visibility_PRIVATE,
			UpdateTime: timestamppb.New(customUpdateTime),
		},
	})
	require.NoError(t, err)
	require.NotNil(t, memoWithUpdateTime)
	require.Equal(t, customUpdateTime.Unix(), memoWithUpdateTime.UpdateTime.AsTime().Unix(), "update_time should match the custom timestamp")

	// Test 3: Create a memo with custom display_time
	// Note: display_time is computed from either created_ts or updated_ts based on instance setting
	// Since DisplayWithUpdateTime defaults to false, display_time maps to created_ts
	memoWithDisplayTime, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:     "This memo has a custom display time",
			Visibility:  apiv1.Visibility_PRIVATE,
			DisplayTime: timestamppb.New(customDisplayTime),
		},
	})
	require.NoError(t, err)
	require.NotNil(t, memoWithDisplayTime)
	// Since DisplayWithUpdateTime is false by default, display_time sets created_ts
	require.Equal(t, customDisplayTime.Unix(), memoWithDisplayTime.DisplayTime.AsTime().Unix(), "display_time should match the custom timestamp")
	require.Equal(t, customDisplayTime.Unix(), memoWithDisplayTime.CreateTime.AsTime().Unix(), "create_time should also match since display_time maps to created_ts")

	// Test 4: Create a memo with all custom timestamps
	// When both display_time and create_time are provided, create_time takes precedence
	memoWithAllTimestamps, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:     "This memo has all custom timestamps",
			Visibility:  apiv1.Visibility_PRIVATE,
			CreateTime:  timestamppb.New(customCreateTime),
			UpdateTime:  timestamppb.New(customUpdateTime),
			DisplayTime: timestamppb.New(customDisplayTime),
		},
	})
	require.NoError(t, err)
	require.NotNil(t, memoWithAllTimestamps)
	require.Equal(t, customCreateTime.Unix(), memoWithAllTimestamps.CreateTime.AsTime().Unix(), "create_time should match the custom timestamp")
	require.Equal(t, customUpdateTime.Unix(), memoWithAllTimestamps.UpdateTime.AsTime().Unix(), "update_time should match the custom timestamp")
	// display_time is computed from created_ts when DisplayWithUpdateTime is false
	require.Equal(t, customCreateTime.Unix(), memoWithAllTimestamps.DisplayTime.AsTime().Unix(), "display_time should be derived from create_time")

	// Test 5: Create a comment (memo relation) with custom timestamps
	parentMemo, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "This is the parent memo",
			Visibility: apiv1.Visibility_PRIVATE,
		},
	})
	require.NoError(t, err)
	require.NotNil(t, parentMemo)

	customCommentCreateTime := time.Date(2021, 6, 15, 10, 30, 0, 0, time.UTC)
	comment, err := ts.Service.CreateMemoComment(userCtx, &apiv1.CreateMemoCommentRequest{
		Name: parentMemo.Name,
		Comment: &apiv1.Memo{
			Content:    "This is a comment with custom create time",
			Visibility: apiv1.Visibility_PRIVATE,
			CreateTime: timestamppb.New(customCommentCreateTime),
		},
	})
	require.NoError(t, err)
	require.NotNil(t, comment)
	require.Equal(t, customCommentCreateTime.Unix(), comment.CreateTime.AsTime().Unix(), "comment create_time should match the custom timestamp")

	// Test 6: Verify that memos without custom timestamps still get auto-generated ones
	memoWithoutTimestamps, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "This memo has auto-generated timestamps",
			Visibility: apiv1.Visibility_PRIVATE,
		},
	})
	require.NoError(t, err)
	require.NotNil(t, memoWithoutTimestamps)
	require.NotNil(t, memoWithoutTimestamps.CreateTime, "create_time should be auto-generated")
	require.NotNil(t, memoWithoutTimestamps.UpdateTime, "update_time should be auto-generated")
	require.True(t, time.Now().Unix()-memoWithoutTimestamps.CreateTime.AsTime().Unix() < 5, "create_time should be recent (within 5 seconds)")
}
