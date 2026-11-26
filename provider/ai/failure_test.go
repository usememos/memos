package ai

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/openai/openai-go/v3"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
	"google.golang.org/genai"
)

func TestClassifyFailure(t *testing.T) {
	openAI := func(status int, code, kind string) error {
		return errors.Wrap(&openai.Error{StatusCode: status, Code: code, Type: kind}, "failed to send request")
	}
	gemini := func(status int, state string, reason string) error {
		e := genai.APIError{Code: status, Status: state, Message: "API key not valid. sk-secret"}
		if reason != "" {
			e.Details = []map[string]any{{"@type": "type.googleapis.com/google.rpc.ErrorInfo", "reason": reason}}
		}
		return errors.Wrap(e, "failed to send Gemini request")
	}
	for _, tc := range []struct {
		name string
		err  error
		want Failure
	}{
		{"openai wrong key", openAI(401, "invalid_api_key", "invalid_request_error"), Failure{Kind: FailureAuth, Status: 401, Code: "invalid_api_key"}},
		{"openai forbidden", openAI(403, "", ""), Failure{Kind: FailureAuth, Status: 403}},
		{"openai wrong key as 400", openAI(400, "invalid_api_key", ""), Failure{Kind: FailureAuth, Status: 400, Code: "invalid_api_key"}},
		{"openai out of credit", openAI(429, "insufficient_quota", "insufficient_quota"), Failure{Kind: FailureQuota, Status: 429, Code: "insufficient_quota"}},
		{"openai billing type only", openAI(429, "", "insufficient_quota"), Failure{Kind: FailureQuota, Status: 429, Code: "insufficient_quota"}},
		{"openai spend limit", openAI(429, "project_spend_limit_exceeded", ""), Failure{Kind: FailureQuota, Status: 429, Code: "project_spend_limit_exceeded"}},
		{"openai rate limit", openAI(429, "rate_limit_exceeded", "requests"), Failure{Kind: FailureRateLimited, Status: 429, Code: "rate_limit_exceeded"}},
		{"openai unknown model", openAI(404, "model_not_found", ""), Failure{Kind: FailureNotFound, Status: 404, Code: "model_not_found"}},
		{"openai unknown model as 400", openAI(400, "model_not_found", ""), Failure{Kind: FailureNotFound, Status: 400, Code: "model_not_found"}},
		{"openai bad parameter", openAI(400, "unsupported_parameter", ""), Failure{Kind: FailureRejected, Status: 400, Code: "unsupported_parameter"}},
		{"openai overloaded", openAI(503, "", ""), Failure{Kind: FailureServer, Status: 503}},
		{"prose in the code field is dropped", openAI(400, "see https://example.com for <b>help</b>", ""), Failure{Kind: FailureRejected, Status: 400}},
		{"gemini wrong key is a 400", gemini(400, "INVALID_ARGUMENT", "API_KEY_INVALID"), Failure{Kind: FailureAuth, Status: 400, Code: "API_KEY_INVALID"}},
		{"gemini restricted key", gemini(403, "PERMISSION_DENIED", "API_KEY_SERVICE_BLOCKED"), Failure{Kind: FailureAuth, Status: 403, Code: "API_KEY_SERVICE_BLOCKED"}},
		{"gemini missing key", gemini(403, "PERMISSION_DENIED", ""), Failure{Kind: FailureAuth, Status: 403, Code: "PERMISSION_DENIED"}},
		{"gemini bad request", gemini(400, "INVALID_ARGUMENT", ""), Failure{Kind: FailureRejected, Status: 400, Code: "INVALID_ARGUMENT"}},
		{"gemini unknown model", gemini(404, "NOT_FOUND", ""), Failure{Kind: FailureNotFound, Status: 404, Code: "NOT_FOUND"}},
		{"gemini billing off", gemini(403, "PERMISSION_DENIED", "BILLING_DISABLED"), Failure{Kind: FailureQuota, Status: 403, Code: "BILLING_DISABLED"}},
		{"gemini too many requests", gemini(429, "RESOURCE_EXHAUSTED", ""), Failure{Kind: FailureRateLimited, Status: 429, Code: "RESOURCE_EXHAUSTED"}},
		{"gemini quota reason", gemini(429, "RESOURCE_EXHAUSTED", "RESOURCE_QUOTA_EXCEEDED"), Failure{Kind: FailureQuota, Status: 429, Code: "RESOURCE_QUOTA_EXCEEDED"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, ClassifyFailure(tc.err))
		})
	}
}

func TestClassifyFailureWithoutResponse(t *testing.T) {
	refused := &url.Error{Op: "Get", URL: "http://127.0.0.1:1/models", Err: &net.OpError{Op: "dial", Net: "tcp", Err: errors.New("connection refused")}}
	failure := ClassifyFailure(errors.Wrap(refused, "list models"))
	require.Equal(t, FailureUnreachable, failure.Kind)
	require.Contains(t, failure.Detail, "connection refused")

	unknownHost := &url.Error{Op: "Post", URL: "http://nowhere.invalid/chat/completions", Err: &net.DNSError{Err: "no such host", Name: "nowhere.invalid", IsNotFound: true}}
	require.Equal(t, FailureUnreachable, ClassifyFailure(unknownHost).Kind)

	require.Equal(t, FailureRedirected, ClassifyFailure(&url.Error{Op: "Get", URL: "http://a/models", Err: ErrRedirected}).Kind)
	require.Equal(t, FailureTimeout, ClassifyFailure(&url.Error{Op: "Get", URL: "http://a/models", Err: context.DeadlineExceeded}).Kind)

	ours := ClassifyFailure(errors.Wrap(ErrUnusableResponse, "incomplete text generation"))
	require.Equal(t, FailureResponse, ours.Kind)
	require.Contains(t, ours.Detail, "incomplete text generation")

	// An error this package did not write may quote the response it failed on.
	foreign := ClassifyFailure(errors.New(`decode: unexpected body "internal-secret"`))
	require.Equal(t, Failure{Kind: FailureResponse}, foreign)

	multiline := ClassifyFailure(&url.Error{Op: "Get", URL: "http://a", Err: errors.New("first\nsecond\tthird")})
	require.NotContains(t, multiline.Detail, "\n")
	require.NotContains(t, multiline.Detail, "\t")
}

func TestHTTPClientRefusesRedirects(t *testing.T) {
	var followed bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/moved" {
			followed = true
			return
		}
		http.Redirect(w, r, "/moved", http.StatusTemporaryRedirect)
	}))
	defer server.Close()

	request, err := http.NewRequestWithContext(t.Context(), http.MethodGet, server.URL+"/models", nil)
	require.NoError(t, err)
	request.Header.Set("x-goog-api-key", "test-key")
	response, err := NewHTTPClient(0).Do(request)
	if response != nil {
		response.Body.Close()
	}
	require.ErrorIs(t, err, ErrRedirected)
	require.False(t, followed, "the key must not travel to the redirect target")
	require.Equal(t, FailureRedirected, ClassifyFailure(err).Kind)
}

func TestRequestOptions(t *testing.T) {
	require.Empty(t, RequestOptions(t.Context()))
	require.Len(t, RequestOptions(WithSingleAttempt(t.Context())), 1)
}

func TestValidateEndpoint(t *testing.T) {
	for _, valid := range []string{"", "  ", "https://api.openai.com/v1", "http://localhost:11434/v1/"} {
		require.NoError(t, ValidateEndpoint(valid), valid)
	}
	for _, invalid := range []string{"api.openai.com/v1", "ftp://example.com", "https://", "/v1"} {
		require.Error(t, ValidateEndpoint(invalid), invalid)
	}
}
