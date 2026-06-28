package llm_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/ai/llm"
)

func TestGenerateSummary(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)
		require.Equal(t, "/api/chat", r.URL.Path)
		require.Equal(t, "application/json", r.Header.Get("Content-Type"))

		var request struct {
			Model    string `json:"model"`
			Stream   bool   `json:"stream"`
			Format   string `json:"format"`
			Options  map[string]any `json:"options"`
			Messages []struct {
				Role    string `json:"role"`
				Content string `json:"content"`
			} `json:"messages"`
		}
		require.NoError(t, json.NewDecoder(r.Body).Decode(&request))
		require.Equal(t, "llama3", request.Model)
		require.False(t, request.Stream)
		require.Equal(t, "json", request.Format)
		require.Equal(t, "你是严谨的笔记摘要器。只输出 JSON，格式必须是 {\"summary\":\"...\"}，不要输出多余解释。", request.Messages[0].Content)
		require.Contains(t, request.Messages[1].Content, "请为下面笔记生成摘要")

		w.Header().Set("Content-Type", "application/json")
		require.NoError(t, json.NewEncoder(w).Encode(map[string]any{
			"message": map[string]any{
				"content": `{"summary":"hello summary"}`,
			},
		}))
	}))
	defer server.Close()

	provider, err := llm.NewOllamaProvider(llm.Config{BaseURL: server.URL, Timeout: 5 * time.Second})
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	summary, err := provider.GenerateSummary(ctx, "first line\nsecond line")
	require.NoError(t, err)
	require.Equal(t, "hello summary", summary)
}

func TestExtractTags(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request struct {
			Messages []struct {
				Role    string `json:"role"`
				Content string `json:"content"`
			} `json:"messages"`
		}
		require.NoError(t, json.NewDecoder(r.Body).Decode(&request))
		require.Len(t, request.Messages, 2)
		require.Equal(t, "system", request.Messages[0].Role)
		require.Equal(t, "user", request.Messages[1].Role)

		w.Header().Set("Content-Type", "application/json")
		require.NoError(t, json.NewEncoder(w).Encode(map[string]any{
			"message": map[string]any{
				"content": `{"tags":["golang","notes",""]}`,
			},
		}))
	}))
	defer server.Close()

	provider, err := llm.NewOllamaProvider(llm.Config{BaseURL: server.URL})
	require.NoError(t, err)

	tags, err := provider.ExtractTags(context.Background(), "Go notes about local models")
	require.NoError(t, err)
	require.Equal(t, []string{"golang", "notes"}, tags)
}

func TestDeriveRelations(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request struct {
			Messages []struct {
				Role    string `json:"role"`
				Content string `json:"content"`
			} `json:"messages"`
		}
		require.NoError(t, json.NewDecoder(r.Body).Decode(&request))
		require.Contains(t, request.Messages[1].Content, "[0] candidate one")
		require.Contains(t, request.Messages[1].Content, "[1] candidate two")

		w.Header().Set("Content-Type", "application/json")
		require.NoError(t, json.NewEncoder(w).Encode(map[string]any{
			"message": map[string]any{
				"content": `{"relations":[{"candidate_index":1,"score":0.87,"reason":"shared topic"}]}`,
			},
		}))
	}))
	defer server.Close()

	provider, err := llm.NewOllamaProvider(llm.Config{BaseURL: server.URL})
	require.NoError(t, err)

	relations, err := provider.DeriveRelations(context.Background(), "current memo", []string{"candidate one", "candidate two"})
	require.NoError(t, err)
	require.Equal(t, []llm.RelationSuggestion{{CandidateIndex: 1, Score: 0.87, Reason: "shared topic"}}, relations)
}

func TestRejectsInvalidJSON(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"message":{"content":"not json"}}`))
	}))
	defer server.Close()

	provider, err := llm.NewOllamaProvider(llm.Config{BaseURL: server.URL})
	require.NoError(t, err)

	_, err = provider.GenerateSummary(context.Background(), strings.Repeat("a", 10))
	require.Error(t, err)
	require.Contains(t, err.Error(), "invalid structured output")
}
