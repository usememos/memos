package test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

// TestUsageLimitRefusalOnBothTransports proves the quota refusal contract on
// the wire: HTTP 429 with an ErrorInfo of reason QUOTA_EXCEEDED and a
// QuotaFailure, and no Retry-After or RateLimit fields, because waiting does
// not lift a usage limit. It also proves that the usage limits setting and
// the user usage routes reach their handlers. Admins are limited like
// everyone else, so the first user is enough.
func TestUsageLimitRefusalOnBothTransports(t *testing.T) {
	ctx := context.Background()
	inst := bootInstance(ctx, t, instanceOptions{instanceURL: "http://127.0.0.1"})
	inst.createAdmin(t)
	token := inst.signIn(t)

	send := func(method, path string, body any, headers map[string]string) *http.Response {
		t.Helper()
		encoded, err := json.Marshal(body)
		require.NoError(t, err)
		req, err := http.NewRequestWithContext(ctx, method, inst.baseURL+path, bytes.NewReader(encoded))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		for key, value := range headers {
			req.Header.Set(key, value)
		}
		resp, err := inst.client.Do(req)
		require.NoError(t, err)
		return resp
	}

	status, body := inst.do(t, http.MethodPatch, "/api/instance/settings/USAGE_LIMITS", token, map[string]any{
		"usageLimitsSetting": map[string]any{
			"limits": []map[string]any{{"allUsers": true, "memoCount": "1", "memoContentBytes": "8192", "uploadBytes": "33554432"}},
		},
	})
	require.Equal(t, http.StatusOK, status, "replacing the usage limits should succeed: %s", body)

	status, body = inst.do(t, http.MethodGet, "/api/instance/settings/USAGE_LIMITS", token, nil)
	require.Equal(t, http.StatusOK, status, "%s", body)
	var setting struct {
		Name               string `json:"name"`
		UsageLimitsSetting struct {
			Limits []struct {
				AllUsers         bool   `json:"allUsers"`
				MemoCount        string `json:"memoCount"`
				MemoContentBytes string `json:"memoContentBytes"`
				UploadBytes      string `json:"uploadBytes"`
			} `json:"limits"`
		} `json:"usageLimitsSetting"`
	}
	require.NoError(t, json.Unmarshal(body, &setting))
	require.Equal(t, "instance/settings/USAGE_LIMITS", setting.Name)
	require.Len(t, setting.UsageLimitsSetting.Limits, 1)
	require.True(t, setting.UsageLimitsSetting.Limits[0].AllUsers)
	require.Equal(t, "1", setting.UsageLimitsSetting.Limits[0].MemoCount)
	require.Equal(t, "8192", setting.UsageLimitsSetting.Limits[0].MemoContentBytes)
	require.Equal(t, "33554432", setting.UsageLimitsSetting.Limits[0].UploadBytes)

	inst.createMemo(t, token, "first", "the only memo the limit allows")

	userName := "users/" + testAdminUsername
	status, body = inst.do(t, http.MethodGet, "/api/"+userName+"/usage", token, nil)
	require.Equal(t, http.StatusOK, status, "%s", body)
	var usage struct {
		Name      string `json:"name"`
		MemoCount string `json:"memoCount"`
		Limits    struct {
			MemoCount string `json:"memoCount"`
		} `json:"limits"`
		LimitIndex int `json:"limitIndex"`
	}
	require.NoError(t, json.Unmarshal(body, &usage))
	require.Equal(t, userName+"/usage", usage.Name)
	require.Equal(t, "1", usage.MemoCount)
	require.Equal(t, "1", usage.Limits.MemoCount)
	require.Equal(t, 0, usage.LimitIndex)

	requireNoWaitHeaders := func(resp *http.Response) {
		t.Helper()
		require.Empty(t, resp.Header.Get("Retry-After"))
		require.Empty(t, resp.Header.Get("RateLimit"))
		require.Empty(t, resp.Header.Get("RateLimit-Policy"))
	}
	memo := map[string]any{"content": "over the limit", "visibility": "PRIVATE"}

	refused := send(http.MethodPost, "/api/memos", memo, nil)
	defer refused.Body.Close()
	require.Equal(t, http.StatusTooManyRequests, refused.StatusCode)
	requireNoWaitHeaders(refused)
	var gatewayError struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Details []struct {
			Type       string            `json:"@type"`
			Reason     string            `json:"reason"`
			Domain     string            `json:"domain"`
			Metadata   map[string]string `json:"metadata"`
			Violations []struct {
				Subject string `json:"subject"`
			} `json:"violations"`
		} `json:"details"`
	}
	require.NoError(t, json.NewDecoder(refused.Body).Decode(&gatewayError))
	require.Equal(t, 8, gatewayError.Code, "RESOURCE_EXHAUSTED")
	require.Equal(t, "quota exceeded", gatewayError.Message)
	types := []string{}
	for _, detail := range gatewayError.Details {
		types = append(types, detail.Type)
		switch detail.Type {
		case "type.googleapis.com/google.rpc.ErrorInfo":
			require.Equal(t, "QUOTA_EXCEEDED", detail.Reason)
			require.Equal(t, "memos.api", detail.Domain)
			require.Equal(t, map[string]string{"metric": "MEMO_COUNT", "limit": "1", "usage": "1"}, detail.Metadata)
		case "type.googleapis.com/google.rpc.QuotaFailure":
			require.Len(t, detail.Violations, 1)
			require.Equal(t, userName, detail.Violations[0].Subject)
		default:
			t.Fatalf("unexpected error detail %s", detail.Type)
		}
	}
	require.ElementsMatch(t, []string{"type.googleapis.com/google.rpc.ErrorInfo", "type.googleapis.com/google.rpc.QuotaFailure"}, types)

	connectResp := send(http.MethodPost, "/memos.api.MemoService/CreateMemo", map[string]any{"memo": memo}, map[string]string{"Connect-Protocol-Version": "1"})
	defer connectResp.Body.Close()
	require.Equal(t, http.StatusTooManyRequests, connectResp.StatusCode)
	requireNoWaitHeaders(connectResp)
	var connectError struct {
		Code    string `json:"code"`
		Message string `json:"message"`
		Details []struct {
			Type string `json:"type"`
		} `json:"details"`
	}
	require.NoError(t, json.NewDecoder(connectResp.Body).Decode(&connectError))
	require.Equal(t, "resource_exhausted", connectError.Code)
	require.Equal(t, "quota exceeded", connectError.Message)
	connectTypes := []string{}
	for _, detail := range connectError.Details {
		connectTypes = append(connectTypes, detail.Type)
	}
	require.ElementsMatch(t, []string{"google.rpc.ErrorInfo", "google.rpc.QuotaFailure"}, connectTypes)
}
