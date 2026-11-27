package ai

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSuggestTagsOverAnthropic(t *testing.T) {
	var requests []map[string]any
	refuseStructuredOutputs := false
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/v1/messages", r.URL.Path)
		require.Equal(t, "Bearer key", r.Header.Get("Authorization"))
		require.Equal(t, "key", r.Header.Get("x-api-key"))
		var body map[string]any
		require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
		requests = append(requests, body)
		// A service that copies the Messages API without structured outputs refuses the parameter.
		if _, ok := body["output_config"]; ok && refuseStructuredOutputs {
			w.WriteHeader(http.StatusBadRequest)
			_, _ = io.WriteString(w, `{"type":"error","error":{"type":"invalid_request_error","message":"unknown field"}}`)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"id":"m","type":"message","role":"assistant","model":"claude","stop_reason":"end_turn",
			"content":[{"type":"text","text":"Here you go: {\"tags\":[\"travel\"]}"}],"usage":{"input_tokens":1,"output_tokens":1}}`)
	}))
	defer upstream.Close()

	t.Run("native", func(t *testing.T) {
		requests = nil
		tags, err := SuggestTags(t.Context(), ProviderConfig{Type: ProviderAnthropic, Endpoint: upstream.URL, APIKey: "key"}, "claude", "Kyoto trip", []string{"travel", "work"})
		require.NoError(t, err)
		require.Equal(t, []string{"travel"}, tags)
		require.Len(t, requests, 1)
		require.NotNil(t, requests[0]["output_config"], "structured outputs constrain the reply")
		require.EqualValues(t, anthropicMaxTokens, requests[0]["max_tokens"])
	})
	t.Run("compatible", func(t *testing.T) {
		requests, refuseStructuredOutputs = nil, true
		tags, err := SuggestTags(t.Context(), ProviderConfig{Type: ProviderAnthropicCompatible, Endpoint: upstream.URL, APIKey: "key"}, "claude", "Kyoto trip", []string{"travel"})
		require.NoError(t, err)
		require.Equal(t, []string{"travel"}, tags)
		require.Len(t, requests, 2, "retried without structured outputs")
		require.Nil(t, requests[1]["output_config"])
	})
}

func TestSuggestTagsRetriesWithoutJSONModeForCompatibleServers(t *testing.T) {
	var formats []any
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
		formats = append(formats, body["response_format"])
		if body["response_format"] != nil {
			w.WriteHeader(http.StatusBadRequest)
			_, _ = io.WriteString(w, `{"error":{"message":"response_format is not supported"}}`)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, "{\"choices\":[{\"index\":0,\"finish_reason\":\"stop\",\"message\":{\"role\":\"assistant\",\"content\":\"```json\\n{\\\"tags\\\":[\\\"work\\\"]}\\n```\"}}]}")
	}))
	defer upstream.Close()

	tags, err := SuggestTags(t.Context(), ProviderConfig{Type: ProviderOpenAICompatible, Endpoint: upstream.URL}, "llama", "Standup notes", []string{"work"})
	require.NoError(t, err)
	require.Equal(t, []string{"work"}, tags)
	require.Len(t, formats, 2)

	// A named service with a JSON mode does not get the second attempt.
	formats = nil
	_, err = SuggestTags(t.Context(), ProviderConfig{Type: ProviderDeepSeek, Endpoint: upstream.URL, APIKey: "k"}, "deepseek", "Standup notes", []string{"work"})
	require.Error(t, err)
	require.Len(t, formats, 1)
}

func TestOpenAIClientIgnoresServerEnvironment(t *testing.T) {
	t.Setenv("OPENAI_API_KEY", "env-key")
	t.Setenv("OPENAI_ORG_ID", "env-org")
	t.Setenv("OPENAI_PROJECT_ID", "env-project")
	t.Setenv("OPENAI_CUSTOM_HEADERS", "X-Internal-Token: secret\nAuthorization: Bearer env-header")
	var headers []http.Header
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		headers = append(headers, r.Header.Clone())
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"object":"list","data":[{"id":"b"},{"id":"a"}]}`)
	}))
	defer upstream.Close()

	models, err := ListModels(t.Context(), ProviderConfig{Type: ProviderOllama, Endpoint: upstream.URL})
	require.NoError(t, err)
	require.Equal(t, []string{"a", "b"}, models)
	_, err = ListModels(t.Context(), ProviderConfig{Type: ProviderOpenAI, Endpoint: upstream.URL, APIKey: "configured"})
	require.NoError(t, err)

	require.Len(t, headers, 2)
	for _, header := range headers {
		require.Empty(t, header.Get("OpenAI-Organization"))
		require.Empty(t, header.Get("OpenAI-Project"))
		require.Empty(t, header.Get("X-Internal-Token"))
	}
	require.Empty(t, headers[0].Get("Authorization"), "a provider without a key sends none")
	require.Equal(t, "Bearer configured", headers[1].Get("Authorization"))
}

func TestClassifyAnthropicFailure(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("request-id", "req_1")
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = io.WriteString(w, `{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}`)
	}))
	defer upstream.Close()

	_, err := ListModels(WithSingleAttempt(t.Context()), ProviderConfig{Type: ProviderAnthropic, Endpoint: upstream.URL, APIKey: "bad"})
	failure := ClassifyFailure(err)
	require.Equal(t, FailureAuth, failure.Kind)
	require.Equal(t, http.StatusUnauthorized, failure.Status)
	require.Equal(t, "authentication_error", failure.Code)
}
