package test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"
)

// TestStartupRateLimitOnBothTransports proves the refusal contract on the
// wire, which only a booted server can: HTTP 429, Retry-After and the IETF
// RateLimit fields, and an ErrorInfo detail with reason RATE_LIMITED, from
// both the gRPC gateway and the Connect handler. The sign-in address budget
// counts failures for an unknown user, so no password hashing is involved.
func TestStartupRateLimitOnBothTransports(t *testing.T) {
	ctx := context.Background()
	inst := bootInstance(ctx, t, instanceOptions{instanceURL: "http://127.0.0.1", rateLimit: true})
	inst.createAdmin(t)

	post := func(path string, body map[string]any, headers map[string]string) *http.Response {
		t.Helper()
		encoded, err := json.Marshal(body)
		require.NoError(t, err)
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, inst.baseURL+path, bytes.NewReader(encoded))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		for key, value := range headers {
			req.Header.Set(key, value)
		}
		resp, err := inst.client.Do(req)
		require.NoError(t, err)
		return resp
	}
	// Each attempt names a different account so the per-account limit never
	// trips and the refusal under test is the per-address one.
	attempt := 0
	nextBody := func() map[string]any {
		attempt++
		return map[string]any{"passwordCredentials": map[string]any{"username": "nobody-" + strconv.Itoa(attempt), "password": "wrong"}}
	}

	// Exhaust the address budget over the gateway. The default is 30 failures
	// per 15 minutes, so the refusal arrives well within the loop bound.
	var refused *http.Response
	for range 40 {
		resp := post("/api/v1/auth/signin", nextBody(), nil)
		if resp.StatusCode == http.StatusTooManyRequests {
			refused = resp
			break
		}
		require.Equal(t, http.StatusBadRequest, resp.StatusCode, "a wrong credential is a plain failure until the budget is spent")
		resp.Body.Close()
	}
	require.NotNil(t, refused, "the gateway never refused")
	defer refused.Body.Close()

	require.NotEmpty(t, refused.Header.Get("Retry-After"))
	require.Contains(t, refused.Header.Get("RateLimit"), `"signin_ip";r=0;t=`)
	require.Contains(t, refused.Header.Get("RateLimit-Policy"), `"signin_ip";q=30;w=900`)
	var gatewayError struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Details []struct {
			Type   string `json:"@type"`
			Reason string `json:"reason"`
			Domain string `json:"domain"`
		} `json:"details"`
	}
	require.NoError(t, json.NewDecoder(refused.Body).Decode(&gatewayError))
	require.Equal(t, 8, gatewayError.Code, "RESOURCE_EXHAUSTED")
	types := map[string]string{}
	for _, detail := range gatewayError.Details {
		types[detail.Type] = detail.Reason
	}
	require.Equal(t, "RATE_LIMITED", types["type.googleapis.com/google.rpc.ErrorInfo"])
	require.Contains(t, types, "type.googleapis.com/google.rpc.RetryInfo")

	// The Connect transport shares the same budget and speaks the same contract.
	connectResp := post("/memos.api.v1.AuthService/SignIn", nextBody(), map[string]string{"Connect-Protocol-Version": "1"})
	defer connectResp.Body.Close()
	require.Equal(t, http.StatusTooManyRequests, connectResp.StatusCode)
	require.NotEmpty(t, connectResp.Header.Get("Retry-After"))
	require.Contains(t, connectResp.Header.Get("RateLimit"), `"signin_ip";r=0;t=`)
	var connectError struct {
		Code    string `json:"code"`
		Details []struct {
			Type string `json:"type"`
		} `json:"details"`
	}
	require.NoError(t, json.NewDecoder(connectResp.Body).Decode(&connectError))
	require.Equal(t, "resource_exhausted", connectError.Code)
	connectTypes := []string{}
	for _, detail := range connectError.Details {
		connectTypes = append(connectTypes, detail.Type)
	}
	require.ElementsMatch(t, []string{"google.rpc.ErrorInfo", "google.rpc.RetryInfo"}, connectTypes)

	// A forged forwarding header from an untrusted peer does not open a fresh
	// budget. The test client connects from loopback, which the default
	// trusted-proxy set includes, so the forged header must name a trusted
	// address to be walked past and still land on the peer.
	forged := post("/api/v1/auth/signin", nextBody(), map[string]string{"X-Forwarded-For": "10.0.0.9"})
	defer forged.Body.Close()
	require.Equal(t, http.StatusTooManyRequests, forged.StatusCode)
}
