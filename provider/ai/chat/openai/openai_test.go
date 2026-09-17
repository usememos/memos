package openai_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/provider/ai"
	"github.com/usememos/memos/provider/ai/chat"
	chatopenai "github.com/usememos/memos/provider/ai/chat/openai"
)

func TestChatSendsConversationAndParsesReply(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)
		require.Equal(t, "/chat/completions", r.URL.Path)
		require.Equal(t, "Bearer test-key", r.Header.Get("Authorization"))
		require.Equal(t, "memos-test", r.Header.Get("X-Title"))

		var body struct {
			Model               string `json:"model"`
			MaxCompletionTokens int64  `json:"max_completion_tokens"`
			Messages            []struct {
				Role    string `json:"role"`
				Content string `json:"content"`
			} `json:"messages"`
		}
		require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
		require.Equal(t, "openai/gpt-4o-mini", body.Model)
		require.Equal(t, int64(512), body.MaxCompletionTokens)
		require.Len(t, body.Messages, 3)
		require.Equal(t, "system", body.Messages[0].Role)
		require.Equal(t, "you are helpful", body.Messages[0].Content)
		require.Equal(t, "user", body.Messages[1].Role)
		require.Equal(t, "first question", body.Messages[1].Content)
		require.Equal(t, "assistant", body.Messages[2].Role)
		require.Equal(t, "first answer", body.Messages[2].Content)

		w.Header().Set("Content-Type", "application/json")
		require.NoError(t, json.NewEncoder(w).Encode(map[string]any{
			"id":      "chatcmpl-1",
			"object":  "chat.completion",
			"created": 1,
			"model":   "openai/gpt-4o-mini",
			"choices": []map[string]any{{
				"index":         0,
				"finish_reason": "stop",
				"message":       map[string]any{"role": "assistant", "content": "the answer"},
			}},
			"usage": map[string]any{"prompt_tokens": 11, "completion_tokens": 7, "total_tokens": 18},
		}))
	}))
	defer server.Close()

	client, err := chatopenai.New(ai.ProviderConfig{
		Type:     ai.ProviderOpenRouter,
		Endpoint: server.URL,
		APIKey:   "test-key",
	}, chat.ApplyOptions([]chat.ChatterOption{
		chat.WithExtraHeaders(map[string]string{"X-Title": "memos-test"}),
	}))
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	response, err := client.Chat(ctx, chat.Request{
		Model: "openai/gpt-4o-mini",
		Messages: []chat.Message{
			{Role: chat.RoleSystem, Content: "you are helpful"},
			{Role: chat.RoleUser, Content: "first question"},
			{Role: chat.RoleAssistant, Content: "first answer"},
		},
		MaxCompletionTokens: 512,
	})
	require.NoError(t, err)
	require.Equal(t, "the answer", response.Text)
	require.Equal(t, chat.FinishStop, response.FinishReason)
	require.Equal(t, "openai/gpt-4o-mini", response.Model)
	require.Equal(t, chat.Usage{PromptTokens: 11, CompletionTokens: 7, TotalTokens: 18}, response.Usage)
}

func TestChatMapsProviderErrors(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name       string
		statusCode int
		body       string
		wantMsg    string
	}{
		{
			name:       "unauthorized",
			statusCode: http.StatusUnauthorized,
			body:       `{"error":{"message":"No auth credentials found"}}`,
			wantMsg:    "No auth credentials found",
		},
		{
			name:       "payment required",
			statusCode: http.StatusPaymentRequired,
			body:       `{"error":{"message":"Insufficient credits"}}`,
			wantMsg:    "Insufficient credits",
		},
		{
			name:       "plain text body",
			statusCode: http.StatusBadGateway,
			body:       `upstream exploded`,
			wantMsg:    "upstream exploded",
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(testCase.statusCode)
				_, _ = w.Write([]byte(testCase.body))
			}))
			defer server.Close()

			client, err := chatopenai.New(ai.ProviderConfig{
				Type:     ai.ProviderOpenAI,
				Endpoint: server.URL,
				APIKey:   "test-key",
			}, chat.ApplyOptions(nil))
			require.NoError(t, err)

			_, err = client.Chat(context.Background(), chat.Request{
				Model:    "gpt-4o-mini",
				Messages: []chat.Message{{Role: chat.RoleUser, Content: "hi"}},
			})
			require.Error(t, err)

			var apiErr *chat.APIError
			require.True(t, errors.As(err, &apiErr), "expected chat.APIError, got %T", err)
			require.Equal(t, testCase.statusCode, apiErr.StatusCode)
			require.Contains(t, apiErr.Message, testCase.wantMsg)
		})
	}
}

func TestChatRejectsEmptyModelAndMessages(t *testing.T) {
	t.Parallel()

	client, err := chatopenai.New(ai.ProviderConfig{
		Type:     ai.ProviderOpenAI,
		Endpoint: "https://example.invalid/v1",
		APIKey:   "test-key",
	}, chat.ApplyOptions(nil))
	require.NoError(t, err)

	_, err = client.Chat(context.Background(), chat.Request{
		Messages: []chat.Message{{Role: chat.RoleUser, Content: "hi"}},
	})
	require.ErrorContains(t, err, "model is required")

	_, err = client.Chat(context.Background(), chat.Request{Model: "gpt-4o-mini"})
	require.ErrorContains(t, err, "at least one message is required")
}

func TestNewRequiresAPIKey(t *testing.T) {
	t.Parallel()

	_, err := chatopenai.New(ai.ProviderConfig{
		Type:     ai.ProviderOpenAI,
		Endpoint: "https://example.invalid/v1",
	}, chat.ApplyOptions(nil))
	require.ErrorContains(t, err, "API key is required")
}

func TestNewFallsBackToProviderDefaultEndpoint(t *testing.T) {
	t.Parallel()

	// An empty endpoint must resolve to the provider type's default rather than
	// failing, so a provider configured with only a key still works.
	client, err := chatopenai.New(ai.ProviderConfig{
		Type:   ai.ProviderOpenRouter,
		APIKey: "test-key",
	}, chat.ApplyOptions(nil))
	require.NoError(t, err)
	require.NotNil(t, client)
}

func TestListModelsReadsContextLengthWhenReported(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodGet, r.Method)
		require.Equal(t, "/models", r.URL.Path)
		require.Equal(t, "Bearer test-key", r.Header.Get("Authorization"))

		w.Header().Set("Content-Type", "application/json")
		require.NoError(t, json.NewEncoder(w).Encode(map[string]any{
			"data": []map[string]any{
				{"id": "z-ai/model", "context_length": 128000},
				{"id": "a-ai/model", "context_length": 32000},
				{"id": "no-context"},
				{"id": "   "},
			},
		}))
	}))
	defer server.Close()

	client, err := chatopenai.New(ai.ProviderConfig{
		Type:     ai.ProviderOpenRouter,
		Endpoint: server.URL,
		APIKey:   "test-key",
	}, chat.ApplyOptions(nil))
	require.NoError(t, err)

	models, err := client.ListModels(context.Background())
	require.NoError(t, err)
	// Sorted by ID, blank IDs dropped, missing context length reported as 0.
	require.Equal(t, []chat.Model{
		{ID: "a-ai/model", ContextLength: 32000},
		{ID: "no-context"},
		{ID: "z-ai/model", ContextLength: 128000},
	}, models)
}

func TestListModelsMapsProviderErrors(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":{"message":"invalid key"}}`))
	}))
	defer server.Close()

	client, err := chatopenai.New(ai.ProviderConfig{
		Type:     ai.ProviderDeepInfra,
		Endpoint: server.URL,
		APIKey:   "test-key",
	}, chat.ApplyOptions(nil))
	require.NoError(t, err)

	_, err = client.ListModels(context.Background())
	var apiErr *chat.APIError
	require.True(t, errors.As(err, &apiErr), "expected chat.APIError, got %T", err)
	require.Equal(t, http.StatusUnauthorized, apiErr.StatusCode)
	require.Equal(t, "invalid key", apiErr.Message)
}
