package webhook

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"
)

func resetPrivateDestinationPolicy(t *testing.T) {
	t.Helper()
	previousAllowPrivateIPs := AllowPrivateIPs
	AllowPrivateIPs = false
	require.NoError(t, ConfigurePrivateDestinationAllowlist(nil))
	t.Cleanup(func() {
		AllowPrivateIPs = previousAllowPrivateIPs
		require.NoError(t, ConfigurePrivateDestinationAllowlist(nil))
	})
}

func TestConfigurePrivateDestinationAllowlist(t *testing.T) {
	t.Run("exact hostname is normalized", func(t *testing.T) {
		resetPrivateDestinationPolicy(t)
		require.NoError(t, ConfigurePrivateDestinationAllowlist([]string{" LOCALHOST. "}))
		require.NoError(t, ValidateURL("http://localhost:8080/hook"))
	})

	t.Run("exact IP is allowed", func(t *testing.T) {
		resetPrivateDestinationPolicy(t)
		require.NoError(t, ConfigurePrivateDestinationAllowlist([]string{"127.0.0.42"}))
		require.NoError(t, ValidateURL("http://127.0.0.42/hook"))
		require.Error(t, ValidateURL("http://127.0.0.43/hook"))
	})

	t.Run("CIDR is normalized and allowed", func(t *testing.T) {
		resetPrivateDestinationPolicy(t)
		require.NoError(t, ConfigurePrivateDestinationAllowlist([]string{"127.0.0.99/24"}))
		require.NoError(t, ValidateURL("http://127.0.0.42/hook"))
		require.Error(t, ValidateURL("http://127.0.1.42/hook"))
	})

	t.Run("invalid entry leaves prior policy intact", func(t *testing.T) {
		resetPrivateDestinationPolicy(t)
		require.NoError(t, ConfigurePrivateDestinationAllowlist([]string{"localhost"}))

		invalidEntries := []string{
			"",
			"http://localhost",
			"localhost:8080",
			"*.example.com",
			"bad_name",
			"127.0.0.1/999",
			"-invalid.example",
		}
		for _, entry := range invalidEntries {
			require.Error(t, ConfigurePrivateDestinationAllowlist([]string{entry}), entry)
			require.NoError(t, ValidateURL("http://localhost/hook"), "failed configuration must not replace the active policy")
		}
	})

	t.Run("nonmatching private target remains blocked", func(t *testing.T) {
		resetPrivateDestinationPolicy(t)
		require.NoError(t, ConfigurePrivateDestinationAllowlist([]string{"10.0.0.0/8", "hooks.internal"}))
		require.Error(t, ValidateURL("http://127.0.0.1/hook"))
	})

	t.Run("public target remains allowed", func(t *testing.T) {
		resetPrivateDestinationPolicy(t)
		require.False(t, isBlockedDestination("dns.google", net.ParseIP("8.8.8.8")))
	})
}

func TestPrivateDestinationPolicyConcurrentAccess(t *testing.T) {
	resetPrivateDestinationPolicy(t)

	privateIP := net.ParseIP("127.0.0.1")
	var waitGroup sync.WaitGroup
	for range 8 {
		waitGroup.Go(func() {
			for range 100 {
				_ = isPrivateDestinationAllowed("localhost", privateIP)
			}
		})
		waitGroup.Go(func() {
			for range 100 {
				if err := ConfigurePrivateDestinationAllowlist([]string{"localhost", "127.0.0.0/8"}); err != nil {
					t.Errorf("ConfigurePrivateDestinationAllowlist() error = %v", err)
				}
			}
		})
	}
	waitGroup.Wait()
}

func TestAllowPrivateIPsCompatibility(t *testing.T) {
	resetPrivateDestinationPolicy(t)
	AllowPrivateIPs = true
	require.NoError(t, ValidateURL("http://127.0.0.1/hook"))
}

func TestPostChecksRedirectDestinationAtDialTime(t *testing.T) {
	resetPrivateDestinationPolicy(t)
	require.NoError(t, ConfigurePrivateDestinationAllowlist([]string{"localhost"}))

	var redirectedRequestReceived atomic.Bool
	redirectTarget := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		redirectedRequestReceived.Store(true)
		_, _ = w.Write([]byte(`{"code":0}`))
	}))
	defer redirectTarget.Close()

	redirectSource := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Location", redirectTarget.URL)
		w.WriteHeader(http.StatusFound)
	}))
	defer redirectSource.Close()

	sourceURL := strings.Replace(redirectSource.URL, "127.0.0.1", "localhost", 1)
	err := Post(&WebhookRequestPayload{URL: sourceURL})
	require.ErrorContains(t, err, "connection to reserved/private IP address is not allowed")
	require.False(t, redirectedRequestReceived.Load())
}

func TestPostAllowsExplicitPrivateIPPolicyAtDialTime(t *testing.T) {
	tests := []struct {
		name      string
		allowlist []string
	}{
		{name: "exact IP", allowlist: []string{"127.0.0.1"}},
		{name: "CIDR", allowlist: []string{"127.0.0.99/8"}},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resetPrivateDestinationPolicy(t)
			require.NoError(t, ConfigurePrivateDestinationAllowlist(tc.allowlist))

			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				_, _ = w.Write([]byte(`{"code":0}`))
			}))
			defer server.Close()

			require.NoError(t, Post(&WebhookRequestPayload{URL: server.URL}))
		})
	}
}

func TestPostAsyncNilPayloadDoesNotPanic(t *testing.T) {
	require.NotPanics(t, func() {
		PostAsync(nil)
	})
}

func TestResolveSigningKey(t *testing.T) {
	rawKey := []byte("0123456789abcdef")
	whsec := "whsec_" + base64.StdEncoding.EncodeToString(rawKey)

	t.Run("plain secret used as-is", func(t *testing.T) {
		key, err := resolveSigningKey("my-plain-secret")
		require.NoError(t, err)
		require.Equal(t, []byte("my-plain-secret"), key)
	})

	t.Run("whsec_ prefix is base64-decoded", func(t *testing.T) {
		key, err := resolveSigningKey(whsec)
		require.NoError(t, err)
		require.Equal(t, rawKey, key)
	})

	t.Run("whsec_ with invalid base64 fails loudly", func(t *testing.T) {
		_, err := resolveSigningKey("whsec_not!valid!base64!")
		require.Error(t, err)
	})
}

func TestGenerateSigningSecret(t *testing.T) {
	secret, err := GenerateSigningSecret()
	require.NoError(t, err)
	require.True(t, strings.HasPrefix(secret, "whsec_"), "generated secret must use the whsec_ prefix")
	require.NoError(t, ValidateSigningSecret(secret), "generated secret must pass validation")

	key, err := resolveSigningKey(secret)
	require.NoError(t, err)
	require.Len(t, key, 32, "generated secret must decode to 32 raw bytes")

	other, err := GenerateSigningSecret()
	require.NoError(t, err)
	require.NotEqual(t, secret, other, "each generated secret must be unique")
}

func TestValidateSigningSecret(t *testing.T) {
	tests := []struct {
		name    string
		secret  string
		wantErr bool
	}{
		{name: "empty is allowed", secret: "", wantErr: false},
		{name: "printable ascii", secret: "abcDEF123!@#", wantErr: false},
		{name: "valid whsec_", secret: "whsec_" + base64.StdEncoding.EncodeToString([]byte("key")), wantErr: false},
		{name: "newline rejected", secret: "abc\ndef", wantErr: true},
		{name: "carriage return rejected", secret: "abc\rdef", wantErr: true},
		{name: "tab rejected", secret: "abc\tdef", wantErr: true},
		{name: "non-ascii rejected", secret: "abc€def", wantErr: true},
		{name: "whsec_ with invalid base64 rejected", secret: "whsec_not!base64", wantErr: true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateSigningSecret(tc.secret)
			if tc.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

// TestPostSignsRequest verifies the end-to-end Standard Webhooks signature so a
// receiver following the documented verification recipe will accept our requests.
func TestPostSignsRequest(t *testing.T) {
	// httptest listens on 127.0.0.1, which the SSRF guard blocks by default.
	prev := AllowPrivateIPs
	AllowPrivateIPs = true
	defer func() { AllowPrivateIPs = prev }()

	rawKey := []byte("0123456789abcdef0123456789abcdef")
	cases := []struct {
		name   string
		secret string
		key    []byte
	}{
		{name: "plain secret", secret: "plain-secret-value", key: []byte("plain-secret-value")},
		{name: "whsec_ secret", secret: "whsec_" + base64.StdEncoding.EncodeToString(rawKey), key: rawKey},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var gotID, gotTimestamp, gotSignature string
			var gotBody []byte
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				gotID = r.Header.Get("webhook-id")
				gotTimestamp = r.Header.Get("webhook-timestamp")
				gotSignature = r.Header.Get("webhook-signature")
				gotBody, _ = io.ReadAll(r.Body)
				_, _ = w.Write([]byte(`{"code":0}`))
			}))
			defer server.Close()

			err := Post(&WebhookRequestPayload{
				URL:           server.URL,
				ActivityType:  "memos.memo.created",
				Creator:       "users/1",
				SigningSecret: tc.secret,
			})
			require.NoError(t, err)

			require.True(t, strings.HasPrefix(gotID, "msg_"), "webhook-id should be prefixed with msg_")
			require.NotEmpty(t, gotTimestamp)
			require.True(t, strings.HasPrefix(gotSignature, "v1,"), "signature should carry the v1 version tag")

			// Recompute the signature the way a receiver would and confirm it matches.
			mac := hmac.New(sha256.New, tc.key)
			mac.Write([]byte(gotID + "." + gotTimestamp + "."))
			mac.Write(gotBody)
			want := base64.StdEncoding.EncodeToString(mac.Sum(nil))
			require.Equal(t, "v1,"+want, gotSignature)
		})
	}
}

// TestPostWithoutSecretSetsNoSignatureHeaders ensures unsigned webhooks stay unsigned.
func TestPostWithoutSecretSetsNoSignatureHeaders(t *testing.T) {
	prev := AllowPrivateIPs
	AllowPrivateIPs = true
	defer func() { AllowPrivateIPs = prev }()

	var hasSignatureHeaders bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hasSignatureHeaders = r.Header.Get("webhook-id") != "" ||
			r.Header.Get("webhook-timestamp") != "" ||
			r.Header.Get("webhook-signature") != ""
		_, _ = w.Write([]byte(`{"code":0}`))
	}))
	defer server.Close()

	err := Post(&WebhookRequestPayload{
		URL:          server.URL,
		ActivityType: "memos.memo.created",
		Creator:      "users/1",
	})
	require.NoError(t, err)
	require.False(t, hasSignatureHeaders, "no signature headers should be set when no secret is configured")
}
