package v1

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/provider/ai"
	"github.com/usememos/memos/provider/ai/chat"
	"github.com/usememos/memos/store"
)

// stubCompleter returns a fixed response so the whole review path — routing,
// context, comment authorship, visibility — can run without a provider.
type stubCompleter struct {
	text     string
	requests []chat.Request
}

func (c *stubCompleter) Complete(_ context.Context, req chat.Request) (*chat.Response, error) {
	c.requests = append(c.requests, req)
	return &chat.Response{Text: c.text, FinishReason: chat.FinishStop}, nil
}

// installStubAssistant enables one assistant routed by the given tags, or by
// nothing at all when tags is empty, which makes it the fallback for any memo.
func installStubAssistant(ctx context.Context, t *testing.T, svc *APIV1Service, tags []string, reply string) *stubCompleter {
	t.Helper()
	_, err := svc.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_AI,
		Value: &storepb.InstanceSetting_AiSetting{AiSetting: &storepb.InstanceAISetting{
			Providers: []*storepb.AIProviderConfig{{
				Id: "provider-1", Title: "OpenAI", Type: storepb.AIProviderType_OPENAI, ApiKey: "sk-test",
			}},
			Assistants: &storepb.AssistantsConfig{
				Enabled: true,
				Assistants: []*storepb.AIAssistantConfig{{
					Id: "reading", Title: "读书助手", Icon: "📗",
					Tags: tags, ProviderId: "provider-1", Model: "gpt-4o-mini",
					ContextScope: storepb.AIAssistantContextScope_SAME_TAG_MEMOS,
					ContextLimit: 10, Enabled: true,
				}},
			},
		}},
	})
	require.NoError(t, err)

	completer := &stubCompleter{text: reply}
	svc.assistantCompleterOverride = func(ai.ProviderConfig) (chat.Completer, error) {
		return completer, nil
	}
	return completer
}

// waitForAssistantComments polls until the memo has the expected number of
// comments. Reviews run on a background worker, so creation returns first.
func waitForAssistantComments(ctx context.Context, t *testing.T, svc *APIV1Service, name string, want int) []*v1pb.Memo {
	t.Helper()
	var comments []*v1pb.Memo
	require.Eventually(t, func() bool {
		response, err := svc.ListMemoComments(ctx, &v1pb.ListMemoCommentsRequest{Name: name})
		if err != nil {
			return false
		}
		comments = response.Memos
		return len(comments) == want
	}, 10*time.Second, 10*time.Millisecond, "expected %d comment(s) on %s", want, name)
	return comments
}

func storeMemoByName(ctx context.Context, t *testing.T, svc *APIV1Service, name string) *store.Memo {
	t.Helper()
	uid, err := ExtractMemoUIDFromName(name)
	require.NoError(t, err)
	memo, err := svc.Store.GetMemo(ctx, &store.FindMemo{UID: &uid})
	require.NoError(t, err)
	require.NotNil(t, memo)
	return memo
}

// TestAssistantReview_PrivateMemoCommentIsVisibleToAuthor is the regression test
// for reviews silently disappearing on private memos. A review used to be stored
// under a per-assistant bot account, which the comment authorization rule
// rejects outright on a PRIVATE memo: only the memo's own author may comment
// there. Since the composer defaults to private, no review ever arrived. Storing
// the review under the author fixes both the write and the read, and the
// assistant identity moves into the memo payload.
func TestAssistantReview_PrivateMemoCommentIsVisibleToAuthor(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)
	author := createSpaceTestUser(ctx, t, svc, "reader", store.RoleUser)
	authorCtx := userCtx(ctx, author.ID)
	completer := installStubAssistant(ctx, t, svc, []string{"book"}, "这段笔记让我想到刻意练习。你打算怎么应用？")

	memo, err := svc.CreateMemo(authorCtx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{Content: "#book 今天读完了《认知天性》。", Visibility: v1pb.Visibility_PRIVATE},
	})
	require.NoError(t, err)

	// The author must be able to read the review, which is the part that used to
	// fail: it was never written at all.
	comments := waitForAssistantComments(authorCtx, t, svc, memo.Name, 1)
	require.Len(t, completer.requests, 1)
	assert.Contains(t, completer.requests[0].Input, "认知天性")

	comment := comments[0]
	assert.Equal(t, "这段笔记让我想到刻意练习。你打算怎么应用？", comment.Content)
	// Placement is inherited so a review is never more visible than its memo.
	assert.Equal(t, v1pb.Visibility_PRIVATE, comment.Visibility)
	assert.Equal(t, BuildUserName(author.Username), comment.Creator)
	// Attribution identifies the assistant without needing an account for it.
	require.NotNil(t, comment.Assistant)
	assert.Equal(t, "读书助手", comment.Assistant.GetTitle())
	assert.Equal(t, "📗", comment.Assistant.GetIcon())

	storedComment := storeMemoByName(ctx, t, svc, comment.Name)
	assert.Equal(t, author.ID, storedComment.CreatorID)
	assert.Equal(t, "reading", storedComment.Payload.GetAssistant().GetAssistantId())
	// A tag written by the model must not appear in the author's tag list.
	assert.Empty(t, storedComment.Payload.GetTags())
}

// TestAssistantReview_UntaggedMemoIsSkipped covers the other half of the report:
// a memo no assistant handles must cost nothing.
func TestAssistantReview_UntaggedMemoIsSkipped(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)
	author := createSpaceTestUser(ctx, t, svc, "reader", store.RoleUser)
	authorCtx := userCtx(ctx, author.ID)
	completer := installStubAssistant(ctx, t, svc, []string{"book"}, "不应该出现。")

	memo, err := svc.CreateMemo(authorCtx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{Content: "#work 周报草稿。", Visibility: v1pb.Visibility_PRIVATE},
	})
	require.NoError(t, err)

	comments, err := svc.ListMemoComments(authorCtx, &v1pb.ListMemoCommentsRequest{Name: memo.Name})
	require.NoError(t, err)
	assert.Empty(t, comments.Memos)
	assert.Empty(t, completer.requests)
}

// TestAssistantReview_SkipsExistingReview guards against a review loop. A review
// is now stored under the author like any other memo, so a fallback assistant
// with no tags would otherwise match it and review its own output.
func TestAssistantReview_SkipsExistingReview(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)
	author := createSpaceTestUser(ctx, t, svc, "reader", store.RoleUser)
	authorCtx := userCtx(ctx, author.ID)
	completer := installStubAssistant(ctx, t, svc, nil, "一条自动评论。")

	memo, err := svc.CreateMemo(authorCtx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{Content: "一条普通笔记。", Visibility: v1pb.Visibility_PRIVATE},
	})
	require.NoError(t, err)
	comments := waitForAssistantComments(authorCtx, t, svc, memo.Name, 1)

	// Reviewing the review itself must do nothing, even though the fallback
	// assistant matches every memo.
	require.NoError(t, svc.reviewMemoWithAssistant(ctx, storeMemoByName(ctx, t, svc, comments[0].Name).ID))
	assert.Len(t, completer.requests, 1, "an assistant must not review its own output")
}
