package test

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestInstanceAISettingConnectionCheck(t *testing.T) {
	const settingsRoute = "/api/instance/settings/AI"
	inst := bootInstance(t.Context(), t, instanceOptions{instanceURL: "http://127.0.0.1"})
	inst.createAdmin(t)
	token := inst.signIn(t)
	var listings, rateLimited atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/models":
			listings.Add(1)
			switch r.Header.Get("Authorization") {
			case "Bearer test-key":
				_, _ = io.WriteString(w, `{"data":[]}`)
			case "Bearer quota-key":
				w.WriteHeader(http.StatusTooManyRequests)
				_, _ = io.WriteString(w, `{"error":{"message":"You exceeded your current quota","type":"insufficient_quota","code":"insufficient_quota"}}`)
			case "Bearer slow-key":
				rateLimited.Add(1)
				w.WriteHeader(http.StatusTooManyRequests)
				_, _ = io.WriteString(w, `{"error":{"message":"Rate limit reached","type":"requests","code":"rate_limit_exceeded"}}`)
			case "Bearer no-list-key":
				w.WriteHeader(http.StatusForbidden)
				_, _ = io.WriteString(w, `{"error":{"message":"Missing scopes: api.model.read","type":"invalid_request_error"}}`)
			default:
				w.WriteHeader(http.StatusUnauthorized)
				_, _ = io.WriteString(w, `{"error":{"message":"upstream echoed sensitive info"}}`)
			}
		case "/v1beta/models":
			if r.Header.Get("x-goog-api-key") != "test-key" {
				// Gemini answers a wrong key with 400, not 401.
				w.WriteHeader(http.StatusBadRequest)
				_, _ = io.WriteString(w, `{"error":{"code":400,"message":"API key not valid. upstream echoed sensitive info","status":"INVALID_ARGUMENT","details":[{"@type":"type.googleapis.com/google.rpc.ErrorInfo","reason":"API_KEY_INVALID"}]}}`)
				return
			}
			_, _ = io.WriteString(w, `{"models":[{"name":"models/gemini"}]}`)
		case "/moved/models":
			// Following this would carry the key to /elsewhere.
			http.Redirect(w, r, "/elsewhere", http.StatusTemporaryRedirect)
		case "/no-listing/models":
			// Some OpenAI-compatible services do not serve the listing.
			w.WriteHeader(http.StatusNotFound)
		default:
			t.Errorf("unexpected upstream request: %s", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer upstream.Close()
	save := func(provider map[string]string) (int, string) {
		t.Helper()
		provider["id"], provider["title"] = "p", "test"
		code, body := inst.do(t, http.MethodPatch, settingsRoute, token, map[string]any{"aiSetting": map[string]any{
			"providers":      []any{provider},
			"textGeneration": map[string]string{"providerId": "p", "model": "text"},
		}})
		return code, string(body)
	}

	// A save that does not change the connection does not contact the provider.
	code, body := save(map[string]string{"type": "OPENAI", "endpoint": upstream.URL, "apiKey": "test-key"})
	require.Equal(t, http.StatusOK, code, body)
	require.EqualValues(t, 1, listings.Load())
	code, body = save(map[string]string{"type": "OPENAI", "endpoint": upstream.URL})
	require.Equal(t, http.StatusOK, code, body)
	require.EqualValues(t, 1, listings.Load())
	_, before := inst.do(t, http.MethodGet, settingsRoute, token, nil)

	// A connection that cannot work is refused with a fixed message and an ErrorInfo reason; the provider's words never
	// come back, and nothing is saved.
	for _, tc := range []struct {
		name         string
		provider     map[string]string
		code         int
		reason, text string
	}{
		{"wrong key", map[string]string{"type": "OPENAI", "endpoint": upstream.URL, "apiKey": "wrong"}, http.StatusBadRequest, "AI_PROVIDER_AUTH_FAILED", "denied access"},
		{"gemini wrong key", map[string]string{"type": "GEMINI", "endpoint": upstream.URL, "apiKey": "wrong"}, http.StatusBadRequest, "AI_PROVIDER_AUTH_FAILED", "rejected the API key"},
		{"redirect", map[string]string{"type": "OPENAI", "endpoint": upstream.URL + "/moved", "apiKey": "test-key"}, http.StatusBadRequest, "AI_PROVIDER_REDIRECTED", "redirected"},
		{"nothing listening", map[string]string{"type": "OPENAI", "endpoint": "http://127.0.0.1:1", "apiKey": "test-key"}, http.StatusServiceUnavailable, "AI_PROVIDER_UNREACHABLE", "could not connect"},
		{"not a URL", map[string]string{"type": "OPENAI", "endpoint": "ftp://example.com", "apiKey": "test-key"}, http.StatusBadRequest, "", "http or https"},
		{"key not resent for a new endpoint", map[string]string{"type": "OPENAI", "endpoint": upstream.URL + "/changed"}, http.StatusBadRequest, "", "API key is required"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			code, msg := save(tc.provider)
			require.Equal(t, tc.code, code, msg)
			require.Contains(t, msg, tc.text)
			require.Contains(t, msg, tc.reason)
			require.NotContains(t, msg, "sensitive info")
		})
	}
	_, after := inst.do(t, http.MethodGet, settingsRoute, token, nil)
	require.JSONEq(t, string(before), string(after))

	// Answers about the account or the provider's state, or that say nothing about the key, do not block the save.
	for _, provider := range []map[string]string{
		{"type": "OPENAI", "endpoint": upstream.URL, "apiKey": "quota-key"},
		{"type": "OPENAI", "endpoint": upstream.URL, "apiKey": "slow-key"},
		{"type": "OPENAI", "endpoint": upstream.URL, "apiKey": "no-list-key"},
		{"type": "OPENAI", "endpoint": upstream.URL + "/no-listing", "apiKey": "test-key"},
		{"type": "GEMINI", "endpoint": upstream.URL, "apiKey": "test-key"},
	} {
		code, body := save(provider)
		require.Equal(t, http.StatusOK, code, body)
	}
	require.EqualValues(t, 1, rateLimited.Load(), "the check asks once and takes the first answer")
}

func TestAIProviderTypesAndModels(t *testing.T) {
	const settingsRoute = "/api/instance/settings/AI"
	inst := bootInstance(t.Context(), t, instanceOptions{instanceURL: "http://127.0.0.1"})
	inst.createAdmin(t)
	token := inst.signIn(t)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.URL.Path == "/v1/models" && r.Header.Get("x-api-key") == "claude-key":
			_, _ = io.WriteString(w, `{"data":[{"id":"claude-b","type":"model"},{"id":"claude-a","type":"model"}],"has_more":false}`)
		case r.URL.Path == "/v1/models":
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = io.WriteString(w, `{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}`)
		case r.URL.Path == "/models":
			_, _ = io.WriteString(w, `{"data":[{"id":"llama"}]}`)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer upstream.Close()

	// The catalog is for administrators.
	code, _ := inst.do(t, http.MethodGet, "/api/ai/providerTypes", "", nil)
	require.Equal(t, http.StatusUnauthorized, code)
	code, body := inst.do(t, http.MethodGet, "/api/ai/providerTypes", token, nil)
	require.Equal(t, http.StatusOK, code, string(body))
	var catalog struct {
		ProviderTypes []struct {
			Type            string `json:"type"`
			DefaultEndpoint string `json:"defaultEndpoint"`
			APIKeyRequired  bool   `json:"apiKeyRequired"`
			Capabilities    []struct {
				Kind string `json:"kind"`
			} `json:"capabilities"`
		} `json:"providerTypes"`
	}
	require.NoError(t, json.Unmarshal(body, &catalog))
	require.Equal(t, "OPENAI", catalog.ProviderTypes[0].Type)
	require.Len(t, catalog.ProviderTypes, 8)

	save := func(providers []any, transcription map[string]string) (int, string) {
		t.Helper()
		setting := map[string]any{"providers": providers}
		if transcription != nil {
			setting["transcription"] = transcription
		}
		code, body := inst.do(t, http.MethodPatch, settingsRoute, token, map[string]any{"aiSetting": setting})
		return code, string(body)
	}
	claude := map[string]string{"id": "claude", "title": "Claude", "type": "ANTHROPIC", "endpoint": upstream.URL, "apiKey": "claude-key"}
	local := map[string]string{"id": "local", "title": "Local", "type": "OPENAI_COMPATIBLE", "endpoint": upstream.URL + "/"}
	code, msg := save([]any{claude, local}, nil)
	require.Equal(t, http.StatusOK, code, msg)

	// A type that cannot transcribe is refused for transcription.
	code, msg = save([]any{claude, local}, map[string]string{"providerId": "claude", "model": "claude-a"})
	require.Equal(t, http.StatusBadRequest, code, msg)
	require.Contains(t, msg, "cannot be used for transcription")
	code, msg = save([]any{claude, local}, map[string]string{"providerId": "local", "model": "whisper"})
	require.Equal(t, http.StatusOK, code, msg)

	listModels := func(providerID string) (int, string) {
		t.Helper()
		code, body := inst.do(t, http.MethodGet, "/api/ai/providers/"+providerID+"/models", token, nil)
		return code, string(body)
	}
	code, msg = listModels("claude")
	require.Equal(t, http.StatusOK, code, msg)
	require.JSONEq(t, `{"models":["claude-a","claude-b"]}`, msg)
	code, msg = listModels("local")
	require.Equal(t, http.StatusOK, code, msg)
	require.JSONEq(t, `{"models":["llama"]}`, msg)
	code, _ = listModels("missing")
	require.Equal(t, http.StatusNotFound, code)

	// An unreachable loopback endpoint explains that localhost is the memos server.
	code, msg = save([]any{map[string]string{"id": "o", "title": "Ollama", "type": "OLLAMA", "endpoint": "http://127.0.0.1:1/v1"}}, nil)
	require.Equal(t, http.StatusServiceUnavailable, code, msg)
	require.Contains(t, msg, "AI_PROVIDER_UNREACHABLE")
	require.Contains(t, msg, "host.docker.internal")
}
