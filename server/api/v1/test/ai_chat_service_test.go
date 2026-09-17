package test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// chatProviderServer returns an OpenAI-compatible test server that replies with
// the given assistant content and records the request bodies it received.
func chatProviderServer(t *testing.T, reply string) (*httptest.Server, *[]map[string]any) {
	t.Helper()

	requests := &[]map[string]any{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/chat/completions":
			var body map[string]any
			require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
			*requests = append(*requests, body)

			w.Header().Set("Content-Type", "application/json")
			require.NoError(t, json.NewEncoder(w).Encode(map[string]any{
				"id":      "chatcmpl-test",
				"object":  "chat.completion",
				"created": 1,
				"model":   "test/model",
				"choices": []map[string]any{{
					"index":         0,
					"finish_reason": "stop",
					"message":       map[string]any{"role": "assistant", "content": reply},
				}},
				"usage": map[string]any{"prompt_tokens": 5, "completion_tokens": 6, "total_tokens": 11},
			}))
		case "/models":
			w.Header().Set("Content-Type", "application/json")
			require.NoError(t, json.NewEncoder(w).Encode(map[string]any{
				"data": []map[string]any{
					{"id": "vendor/model-b", "context_length": 64000},
					{"id": "vendor/model-a", "context_length": 32000},
				},
			}))
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(server.Close)
	return server, requests
}

// configureChatProvider persists an AI setting with one OpenAI-compatible
// provider and a chat config pointing at it.
func configureChatProvider(t *testing.T, ts *TestService, endpoint string, chatConfig *storepb.ChatConfig) {
	t.Helper()

	_, err := ts.Store.UpsertInstanceSetting(context.Background(), &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_AI,
		Value: &storepb.InstanceSetting_AiSetting{
			AiSetting: &storepb.InstanceAISetting{
				Providers: []*storepb.AIProviderConfig{{
					Id:       "router-main",
					Title:    "OpenRouter",
					Type:     storepb.AIProviderType_OPENROUTER,
					Endpoint: endpoint,
					ApiKey:   "sk-test",
				}},
				Chat: chatConfig,
			},
		},
	})
	require.NoError(t, err)
}

func TestChatRequiresAuthentication(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	_, err := ts.Service.Chat(ctx, &v1pb.ChatRequest{
		Messages: []*v1pb.ChatMessage{{
			Role:    v1pb.ChatMessageRole_CHAT_MESSAGE_ROLE_USER,
			Content: "hello",
		}},
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "user not authenticated")
}

func TestChatInjectsOnlyNotesMatchingTheFilter(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "chat-context-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	_, err = ts.Store.CreateMemo(ctx, &store.Memo{
		UID: "chat-journal-note", CreatorID: user.ID,
		Content: "journal secret body", Visibility: store.Private,
		Payload: &storepb.MemoPayload{Tags: []string{"journal"}},
	})
	require.NoError(t, err)
	_, err = ts.Store.CreateMemo(ctx, &store.Memo{
		UID: "chat-work-note", CreatorID: user.ID,
		Content: "work unrelated body", Visibility: store.Private,
		Payload: &storepb.MemoPayload{Tags: []string{"work"}},
	})
	require.NoError(t, err)

	server, requests := chatProviderServer(t, "Understood.")
	configureChatProvider(t, ts, server.URL, &storepb.ChatConfig{
		ProviderId: "router-main",
		Model:      "vendor/model-a",
	})

	resp, err := ts.Service.Chat(userCtx, &v1pb.ChatRequest{
		Filter: `"journal" in tags`,
		Messages: []*v1pb.ChatMessage{{
			Role:    v1pb.ChatMessageRole_CHAT_MESSAGE_ROLE_USER,
			Content: "summarize my journal",
		}},
	})
	require.NoError(t, err)
	require.Equal(t, "Understood.", resp.Content)
	require.Equal(t, int64(1), resp.ContextMemoCount, "only the tagged note should be injected")
	require.Equal(t, int64(11), resp.TotalTokens)
	require.False(t, resp.Truncated)

	require.Len(t, *requests, 1)
	messages, ok := (*requests)[0]["messages"].([]any)
	require.True(t, ok)
	require.Len(t, messages, 2)

	system, ok := messages[0].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "system", system["role"])
	systemContent, ok := system["content"].(string)
	require.True(t, ok)
	require.Contains(t, systemContent, "journal secret body")
	require.NotContains(t, systemContent, "work unrelated body", "an unmatched note must never reach the model")
}

func TestChatWithEmptyFilterSendsNoNoteContent(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "chat-nofilter-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	_, err = ts.Store.CreateMemo(ctx, &store.Memo{
		UID: "chat-unselected-note", CreatorID: user.ID,
		Content: "should never be sent", Visibility: store.Private,
	})
	require.NoError(t, err)

	server, requests := chatProviderServer(t, "I have no notes to read.")
	configureChatProvider(t, ts, server.URL, &storepb.ChatConfig{
		ProviderId: "router-main",
		Model:      "vendor/model-a",
	})

	resp, err := ts.Service.Chat(userCtx, &v1pb.ChatRequest{
		Messages: []*v1pb.ChatMessage{{
			Role:    v1pb.ChatMessageRole_CHAT_MESSAGE_ROLE_USER,
			Content: "what did I write?",
		}},
	})
	require.NoError(t, err)
	require.Equal(t, int64(0), resp.ContextMemoCount)

	system := (*requests)[0]["messages"].([]any)[0].(map[string]any)
	require.NotContains(t, system["content"], "should never be sent")
	require.Contains(t, system["content"], "no access to their notes")
}

func TestChatRefusesOverBudgetSelection(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "chat-budget-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	_, err = ts.Store.CreateMemo(ctx, &store.Memo{
		UID: "chat-big-note", CreatorID: user.ID,
		Content: strings.Repeat("x", 4000), Visibility: store.Private,
		Payload: &storepb.MemoPayload{Tags: []string{"big"}},
	})
	require.NoError(t, err)

	server, requests := chatProviderServer(t, "should not be called")
	configureChatProvider(t, ts, server.URL, &storepb.ChatConfig{
		ProviderId:          "router-main",
		Model:               "vendor/model-a",
		ContextBudgetTokens: 100,
	})

	// 4000 chars is about 1000 tokens; a 100-token budget must refuse it.
	_, err = ts.Service.Chat(userCtx, &v1pb.ChatRequest{
		Filter: `"big" in tags`,
		Messages: []*v1pb.ChatMessage{{
			Role:    v1pb.ChatMessageRole_CHAT_MESSAGE_ROLE_USER,
			Content: "summarize",
		}},
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "over the 100 token budget")
	require.Contains(t, err.Error(), "narrow the selection")
	require.Empty(t, *requests, "an over-budget selection must not reach the provider")
}

func TestChatDoesNotCreateMemosFromProposals(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "chat-proposal-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	reply := "Drafting that for you.\n\n```memo-proposal\n" +
		`{"action":"create","content":"# Proposed note\n\nBody #tag"}` + "\n```"
	server, _ := chatProviderServer(t, reply)
	configureChatProvider(t, ts, server.URL, &storepb.ChatConfig{
		ProviderId: "router-main",
		Model:      "vendor/model-a",
	})

	resp, err := ts.Service.Chat(userCtx, &v1pb.ChatRequest{
		Messages: []*v1pb.ChatMessage{{
			Role:    v1pb.ChatMessageRole_CHAT_MESSAGE_ROLE_USER,
			Content: "make a note about the trip",
		}},
	})
	require.NoError(t, err)
	require.Equal(t, "Drafting that for you.", resp.Content, "the proposal block must be stripped from the visible reply")
	require.Len(t, resp.Proposals, 1)
	require.Equal(t, v1pb.ChatProposalAction_CHAT_PROPOSAL_ACTION_CREATE, resp.Proposals[0].Action)
	require.Equal(t, "# Proposed note\n\nBody #tag", resp.Proposals[0].Content)

	// The core guarantee: Chat proposes and never writes.
	normal := store.Normal
	memos, err := ts.Store.ListMemos(ctx, &store.FindMemo{
		CreatorID: &user.ID,
		RowStatus: &normal,
	})
	require.NoError(t, err)
	require.Empty(t, memos, "Chat must never create a memo; the user confirms proposals first")
}

func TestChatUsesStoredModelWhenRequestOmitsIt(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "chat-stored-model-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	server, requests := chatProviderServer(t, "ok")
	configureChatProvider(t, ts, server.URL, &storepb.ChatConfig{
		ProviderId: "router-main",
		Model:      "vendor/model-b",
	})

	_, err = ts.Service.Chat(userCtx, &v1pb.ChatRequest{
		Messages: []*v1pb.ChatMessage{{
			Role:    v1pb.ChatMessageRole_CHAT_MESSAGE_ROLE_USER,
			Content: "hi",
		}},
	})
	require.NoError(t, err)
	require.Equal(t, "vendor/model-b", (*requests)[0]["model"])
}

func TestChatCannotBypassDisabledConfiguration(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "chat-disabled-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	server, requests := chatProviderServer(t, "should not be called")
	configureChatProvider(t, ts, server.URL, nil)

	_, err = ts.Service.Chat(userCtx, &v1pb.ChatRequest{
		Messages: []*v1pb.ChatMessage{{
			Role:    v1pb.ChatMessageRole_CHAT_MESSAGE_ROLE_USER,
			Content: "hi",
		}},
	})
	require.ErrorContains(t, err, "chat is not configured")
	require.Empty(t, *requests, "a request override must not enable disabled chat")
}

func TestChatEnforcesStoredTokenBudgets(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "chat-budget-override-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	_, err = ts.Store.CreateMemo(ctx, &store.Memo{
		UID: "chat-budget-override-note", CreatorID: user.ID,
		Content: strings.Repeat("x", 400), Visibility: store.Private,
		Payload: &storepb.MemoPayload{Tags: []string{"budgeted"}},
	})
	require.NoError(t, err)

	server, requests := chatProviderServer(t, "should not be called")
	configureChatProvider(t, ts, server.URL, &storepb.ChatConfig{
		ProviderId:          "router-main",
		Model:               "vendor/model-a",
		ContextBudgetTokens: 50,
		MaxCompletionTokens: 25,
	})

	_, err = ts.Service.Chat(userCtx, &v1pb.ChatRequest{
		Filter: `"budgeted" in tags`,
		Messages: []*v1pb.ChatMessage{{
			Role:    v1pb.ChatMessageRole_CHAT_MESSAGE_ROLE_USER,
			Content: "summarize",
		}},
	})
	require.ErrorContains(t, err, "over the 50 token budget")
	require.Empty(t, *requests, "request limits must not override administrator limits")
}

func TestChatRequiresConfiguredModel(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "chat-no-model-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	server, _ := chatProviderServer(t, "ok")
	configureChatProvider(t, ts, server.URL, &storepb.ChatConfig{ProviderId: "router-main"})

	_, err = ts.Service.Chat(userCtx, &v1pb.ChatRequest{
		Messages: []*v1pb.ChatMessage{{
			Role:    v1pb.ChatMessageRole_CHAT_MESSAGE_ROLE_USER,
			Content: "hi",
		}},
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "chat model is not configured")
}

func TestChatValidatesMessages(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "chat-validate-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	server, _ := chatProviderServer(t, "ok")
	configureChatProvider(t, ts, server.URL, &storepb.ChatConfig{
		ProviderId: "router-main",
		Model:      "vendor/model-a",
	})

	t.Run("rejects an empty conversation", func(t *testing.T) {
		_, err := ts.Service.Chat(userCtx, &v1pb.ChatRequest{})
		require.ErrorContains(t, err, "at least one message is required")
	})

	t.Run("rejects a trailing assistant message", func(t *testing.T) {
		_, err := ts.Service.Chat(userCtx, &v1pb.ChatRequest{
			Messages: []*v1pb.ChatMessage{{
				Role:    v1pb.ChatMessageRole_CHAT_MESSAGE_ROLE_ASSISTANT,
				Content: "I spoke last",
			}},
		})
		require.ErrorContains(t, err, "last message must be from the user")
	})

	t.Run("rejects an empty message body", func(t *testing.T) {
		_, err := ts.Service.Chat(userCtx, &v1pb.ChatRequest{
			Messages: []*v1pb.ChatMessage{{
				Role:    v1pb.ChatMessageRole_CHAT_MESSAGE_ROLE_USER,
				Content: "   ",
			}},
		})
		require.ErrorContains(t, err, "content is required")
	})

	t.Run("rejects an unspecified role", func(t *testing.T) {
		_, err := ts.Service.Chat(userCtx, &v1pb.ChatRequest{
			Messages: []*v1pb.ChatMessage{{
				Role:    v1pb.ChatMessageRole_CHAT_MESSAGE_ROLE_UNSPECIFIED,
				Content: "who am I",
			}},
		})
		require.ErrorContains(t, err, "unsupported role")
	})
}

func TestChatRejectsUnsupportedProviderType(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "chat-gemini-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	// Gemini is a valid provider for transcription but has no chat path here.
	_, err = ts.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_AI,
		Value: &storepb.InstanceSetting_AiSetting{
			AiSetting: &storepb.InstanceAISetting{
				Providers: []*storepb.AIProviderConfig{{
					Id: "gemini-main", Title: "Gemini",
					Type: storepb.AIProviderType_GEMINI, ApiKey: "k",
				}},
				Chat: &storepb.ChatConfig{ProviderId: "gemini-main", Model: "gemini-2.5-flash"},
			},
		},
	})
	require.NoError(t, err)

	_, err = ts.Service.Chat(userCtx, &v1pb.ChatRequest{
		Messages: []*v1pb.ChatMessage{{
			Role:    v1pb.ChatMessageRole_CHAT_MESSAGE_ROLE_USER,
			Content: "hi",
		}},
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "not supported for chat")
}

func TestChatMapsProviderErrors(t *testing.T) {
	testCases := []struct {
		name         string
		statusCode   int
		body         string
		wantContains string
	}{
		{"bad key", http.StatusUnauthorized, `{"error":{"message":"no auth"}}`, "rejected the API key"},
		{"no credit", http.StatusPaymentRequired, `{"error":{"message":"insufficient credits"}}`, "insufficient credit"},
		{"rate limited", http.StatusTooManyRequests, `{"error":{"message":"slow down"}}`, "rate limit reached"},
		{"unknown model", http.StatusNotFound, `{"error":{"message":"model not found"}}`, "could not find the requested model"},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			ctx := context.Background()
			ts := NewTestService(t)
			defer ts.Cleanup()

			user, err := ts.CreateRegularUser(ctx, "chat-error-user")
			require.NoError(t, err)
			userCtx := ts.CreateUserContext(ctx, user.ID)

			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(testCase.statusCode)
				_, _ = w.Write([]byte(testCase.body))
			}))
			defer server.Close()
			configureChatProvider(t, ts, server.URL, &storepb.ChatConfig{
				ProviderId: "router-main",
				Model:      "vendor/model-a",
			})

			_, err = ts.Service.Chat(userCtx, &v1pb.ChatRequest{
				Messages: []*v1pb.ChatMessage{{
					Role:    v1pb.ChatMessageRole_CHAT_MESSAGE_ROLE_USER,
					Content: "hi",
				}},
			})
			require.Error(t, err)
			require.Contains(t, err.Error(), testCase.wantContains)
		})
	}
}

func TestEstimateChatContextReportsBudgetFit(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "estimate-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	_, err = ts.Store.CreateMemo(ctx, &store.Memo{
		UID: "estimate-note", CreatorID: user.ID,
		Content: strings.Repeat("y", 400), Visibility: store.Private,
		Payload: &storepb.MemoPayload{Tags: []string{"estimable"}},
	})
	require.NoError(t, err)

	server, _ := chatProviderServer(t, "unused")
	configureChatProvider(t, ts, server.URL, &storepb.ChatConfig{
		ProviderId:          "router-main",
		Model:               "vendor/model-a",
		ContextBudgetTokens: 200,
	})

	// 400 chars is about 100 tokens, which fits the stored 200-token budget.
	fits, err := ts.Service.EstimateChatContext(userCtx, &v1pb.EstimateChatContextRequest{
		Filter: `"estimable" in tags`,
	})
	require.NoError(t, err)
	require.Equal(t, int64(1), fits.MemoCount)
	require.Equal(t, int64(400), fits.TotalChars)
	require.Equal(t, int64(100), fits.EstimatedTokens)
	require.True(t, fits.Fits)

	configureChatProvider(t, ts, server.URL, &storepb.ChatConfig{
		ProviderId:          "router-main",
		Model:               "vendor/model-a",
		ContextBudgetTokens: 50,
	})

	// The same selection does not fit the updated stored 50-token budget.
	tooBig, err := ts.Service.EstimateChatContext(userCtx, &v1pb.EstimateChatContextRequest{
		Filter: `"estimable" in tags`,
	})
	require.NoError(t, err)
	require.False(t, tooBig.Fits)
}

func TestEstimateChatContextEmptyFilterSelectsNothing(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "estimate-empty-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	_, err = ts.Store.CreateMemo(ctx, &store.Memo{
		UID: "estimate-unselected", CreatorID: user.ID,
		Content: "body", Visibility: store.Private,
	})
	require.NoError(t, err)

	resp, err := ts.Service.EstimateChatContext(userCtx, &v1pb.EstimateChatContextRequest{})
	require.NoError(t, err)
	require.Equal(t, int64(0), resp.MemoCount, "an empty filter must not select every note")
	require.True(t, resp.Fits)
}

func TestListProviderModels(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "models-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)
	host, err := ts.CreateHostUser(ctx, "models-admin")
	require.NoError(t, err)
	hostCtx := ts.CreateUserContext(ctx, host.ID)

	server, _ := chatProviderServer(t, "unused")
	configureChatProvider(t, ts, server.URL, nil)

	_, err = ts.Service.ListProviderModels(userCtx, &v1pb.ListProviderModelsRequest{ProviderId: "router-main"})
	require.ErrorContains(t, err, "permission denied")

	resp, err := ts.Service.ListProviderModels(hostCtx, &v1pb.ListProviderModelsRequest{ProviderId: "router-main"})
	require.NoError(t, err)
	require.Len(t, resp.Models, 2)
	require.Equal(t, "vendor/model-a", resp.Models[0].Id)
	require.Equal(t, int64(32000), resp.Models[0].ContextLength)
	require.Equal(t, "vendor/model-b", resp.Models[1].Id)

	t.Run("requires a provider id", func(t *testing.T) {
		_, err := ts.Service.ListProviderModels(hostCtx, &v1pb.ListProviderModelsRequest{})
		require.ErrorContains(t, err, "provider_id is required")
	})

	t.Run("rejects an unknown provider", func(t *testing.T) {
		_, err := ts.Service.ListProviderModels(hostCtx, &v1pb.ListProviderModelsRequest{ProviderId: "nope"})
		require.Error(t, err)
		require.Contains(t, err.Error(), "not configured")
	})
}

func TestChatUpdateProposalIncludesTargetSnapshot(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "chat-update-proposal-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	_, err = ts.Store.CreateMemo(ctx, &store.Memo{
		UID: "chat-update-target", CreatorID: user.ID,
		Content: "original body", Visibility: store.Private,
		Payload: &storepb.MemoPayload{Tags: []string{"editable"}},
	})
	require.NoError(t, err)

	reply := "```memo-proposal\n" +
		`{"action":"update","target":"memos/chat-update-target","content":"replacement body"}` + "\n```"
	server, _ := chatProviderServer(t, reply)
	configureChatProvider(t, ts, server.URL, &storepb.ChatConfig{ProviderId: "router-main", Model: "vendor/model-a"})

	resp, err := ts.Service.Chat(userCtx, &v1pb.ChatRequest{
		Filter: `"editable" in tags`,
		Messages: []*v1pb.ChatMessage{{
			Role:    v1pb.ChatMessageRole_CHAT_MESSAGE_ROLE_USER,
			Content: "rewrite it",
		}},
	})
	require.NoError(t, err)
	require.Len(t, resp.Proposals, 1)
	require.Equal(t, "original body", resp.Proposals[0].GetTargetContent())
}

// TestChatRefusesSelectionLargerThanTheNoteCap pins the "never silently subset"
// rule at the note-count boundary. Exceeding the cap must be an error, not a
// quiet truncation, because a receipt that dropped notes would misreport what
// the model actually read.
func TestChatRefusesSelectionLargerThanTheNoteCap(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "chat-cap-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	// One note past the cap, so the over-fetch by one detects the overflow.
	for i := 0; i <= 500; i++ {
		_, err = ts.Store.CreateMemo(ctx, &store.Memo{
			UID:        fmt.Sprintf("chat-cap-note-%d", i),
			CreatorID:  user.ID,
			Content:    "bulk body",
			Visibility: store.Private,
			Payload:    &storepb.MemoPayload{Tags: []string{"bulk"}},
		})
		require.NoError(t, err)
	}

	server, requests := chatProviderServer(t, "should not be called")
	configureChatProvider(t, ts, server.URL, &storepb.ChatConfig{
		ProviderId: "router-main",
		Model:      "vendor/model-a",
	})

	_, err = ts.Service.Chat(userCtx, &v1pb.ChatRequest{
		Filter: `"bulk" in tags`,
		Messages: []*v1pb.ChatMessage{{
			Role:    v1pb.ChatMessageRole_CHAT_MESSAGE_ROLE_USER,
			Content: "summarize everything",
		}},
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "narrow the selection")
	require.Empty(t, *requests, "an over-cap selection must not reach the provider")

	// The estimate refuses too, so the Hub can block sending before a turn.
	_, err = ts.Service.EstimateChatContext(userCtx, &v1pb.EstimateChatContextRequest{Filter: `"bulk" in tags`})
	require.Error(t, err)
	require.Contains(t, err.Error(), "narrow the selection")
}
