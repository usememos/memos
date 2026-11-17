package api

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/profile"
)

func TestSSOAuthStateStoreIssueAndRedeem(t *testing.T) {
	t.Parallel()

	states := newSSOAuthStateStore(time.Minute)
	state, expiresAt, err := states.issue("idp-a", "http://localhost:8080/auth/callback", true, "")
	require.NoError(t, err)
	require.NotEmpty(t, state)
	require.True(t, expiresAt.After(time.Now()))

	entry, err := states.redeem(state, "idp-a")
	require.NoError(t, err)
	require.Equal(t, "idp-a", entry.identityProviderUID)
	require.Equal(t, "http://localhost:8080/auth/callback", entry.redirectURI)
	require.True(t, entry.pkceRequired)
}

func TestSSOAuthStateStoreRedeemIsSingleUse(t *testing.T) {
	t.Parallel()

	states := newSSOAuthStateStore(time.Minute)
	state, _, err := states.issue("idp-a", "http://localhost:8080/auth/callback", false, "")
	require.NoError(t, err)

	_, err = states.redeem(state, "idp-a")
	require.NoError(t, err)
	_, err = states.redeem(state, "idp-a")
	require.Error(t, err)
}

func TestSSOAuthStateStoreRejectsUnknownAndForeignTokens(t *testing.T) {
	t.Parallel()

	states := newSSOAuthStateStore(time.Minute)
	_, err := states.redeem("never-issued", "idp-a")
	require.Error(t, err)

	state, _, err := states.issue("idp-a", "http://localhost:8080/auth/callback", false, "")
	require.NoError(t, err)
	_, err = states.redeem(state, "idp-b")
	require.Error(t, err, "a state must not redeem for a different provider")
}

func TestSSOAuthStateStoreExpiresTokens(t *testing.T) {
	t.Parallel()

	states := newSSOAuthStateStore(-time.Second)
	state, _, err := states.issue("idp-a", "http://localhost:8080/auth/callback", false, "")
	require.NoError(t, err)

	_, err = states.redeem(state, "idp-a")
	require.Error(t, err, "an expired state must not redeem")
}

func TestSSOAuthStateStoreRejectsOversizedRedirectURI(t *testing.T) {
	t.Parallel()

	states := newSSOAuthStateStore(time.Minute)
	uri := "https://memos.example.com/" + strings.Repeat("a", maxSSOAuthStateRedirectURILength)
	_, _, err := states.issue("idp-a", uri, false, "")
	require.ErrorIs(t, err, errSSOAuthStateRedirectURITooLong)

	uri = "https://memos.example.com/" + strings.Repeat("a", maxSSOAuthStateRedirectURILength-len("https://memos.example.com/"))
	_, _, err = states.issue("idp-a", uri, false, "")
	require.NoError(t, err, "a URI at the length limit must still issue")
}

func TestSSOAuthStateStoreRejectsNewFlowsWhenFull(t *testing.T) {
	t.Parallel()

	states := newSSOAuthStateStoreWithLimits(time.Minute, 2, 10)
	first, _, err := states.issue("idp-a", "http://localhost:8080/auth/callback", false, "")
	require.NoError(t, err)
	second, _, err := states.issue("idp-a", "http://localhost:8080/auth/callback", false, "")
	require.NoError(t, err)

	_, _, err = states.issue("idp-a", "http://localhost:8080/auth/callback", false, "")
	require.ErrorIs(t, err, errSSOAuthStateStoreFull)

	// A full store must not evict live flows to make room.
	_, err = states.redeem(first, "idp-a")
	require.NoError(t, err)
	_, err = states.redeem(second, "idp-a")
	require.NoError(t, err)

	_, _, err = states.issue("idp-a", "http://localhost:8080/auth/callback", false, "")
	require.NoError(t, err, "redemptions free capacity for new flows")
}

func TestSSOAuthStateStoreCapsInFlightFlowsPerCaller(t *testing.T) {
	t.Parallel()

	states := newSSOAuthStateStoreWithLimits(time.Minute, 10, 2)
	_, _, err := states.issue("idp-a", "http://localhost:8080/auth/callback", false, "caller-a")
	require.NoError(t, err)
	_, _, err = states.issue("idp-a", "http://localhost:8080/auth/callback", false, "caller-a")
	require.NoError(t, err)
	_, _, err = states.issue("idp-a", "http://localhost:8080/auth/callback", false, "caller-a")
	require.ErrorIs(t, err, errSSOAuthStateTooManyForCaller)

	_, _, err = states.issue("idp-a", "http://localhost:8080/auth/callback", false, "caller-b")
	require.NoError(t, err, "one caller's cap must not affect another caller")
	_, _, err = states.issue("idp-a", "http://localhost:8080/auth/callback", false, "")
	require.NoError(t, err, "uncapped issuance (limiter configured) ignores the per-caller cap")
}

func TestSSOAuthStateStoreExpiryReclaimsCallerCapacity(t *testing.T) {
	t.Parallel()

	states := newSSOAuthStateStoreWithLimits(-time.Second, 10, 1)
	stale, _, err := states.issue("idp-a", "http://localhost:8080/auth/callback", false, "caller-a")
	require.NoError(t, err)

	// The next issuance reaps the expired head entry, including its caller count.
	_, _, err = states.issue("idp-a", "http://localhost:8080/auth/callback", false, "caller-a")
	require.NoError(t, err, "an expired state must not keep the caller's slot")

	_, err = states.redeem(stale, "idp-a")
	require.Error(t, err, "the reaped state is gone")
}

func TestValidateSSORedirectURI(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		instanceURL string
		uri         string
		wantErr     bool
	}{
		{name: "absolute https allowed without instance URL", uri: "https://memos.example.com/auth/callback"},
		{name: "relative URI rejected", uri: "/auth/callback", wantErr: true},
		{name: "non-http scheme rejected", uri: "ftp://memos.example.com/auth/callback", wantErr: true},
		{name: "empty host rejected", uri: "https:///auth/callback", wantErr: true},
		{
			name:        "callback on the instance origin allowed",
			instanceURL: "https://memos.example.com",
			uri:         "https://memos.example.com/auth/callback",
		},
		{
			name:        "origin comparison is case-insensitive",
			instanceURL: "https://MEMOS.example.com",
			uri:         "https://memos.example.com/auth/callback",
		},
		{
			name:        "foreign origin rejected",
			instanceURL: "https://memos.example.com",
			uri:         "https://attacker.example/callback",
			wantErr:     true,
		},
		{
			name:        "different port rejected",
			instanceURL: "https://memos.example.com:5230",
			uri:         "https://memos.example.com/auth/callback",
			wantErr:     true,
		},
		{
			name:        "unparseable instance URL falls back to the absolute check",
			instanceURL: "://not-a-url",
			uri:         "https://memos.example.com/auth/callback",
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			p := &profile.Profile{InstanceURL: tc.instanceURL}
			err := validateSSORedirectURI(p, tc.uri)
			if tc.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}
