package api

import (
	"strings"
	"sync"
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

func TestSSOAuthStateStoreThrottlesIssuanceRatePerCaller(t *testing.T) {
	t.Parallel()

	states := newSSOAuthStateStoreWithLimits(time.Minute, 100, 100)
	states.maxPerWindow = 3

	issued := make([]string, 0, states.maxPerWindow)
	for range states.maxPerWindow {
		state, _, err := states.issue("idp-a", "http://localhost:8080/auth/callback", false, "caller-a")
		require.NoError(t, err)
		issued = append(issued, state)
	}
	_, _, err := states.issue("idp-a", "http://localhost:8080/auth/callback", false, "caller-a")
	require.ErrorIs(t, err, errSSOAuthStateIssuanceRateLimited)

	// Redeeming frees the live-state cap but must not reset the throttle:
	// a caller that burns through the verifier check and re-issues stays bound.
	for _, state := range issued {
		_, err := states.redeem(state, "idp-a")
		require.NoError(t, err)
	}
	require.Zero(t, states.callerCounts["caller-a"])
	_, _, err = states.issue("idp-a", "http://localhost:8080/auth/callback", false, "caller-a")
	require.ErrorIs(t, err, errSSOAuthStateIssuanceRateLimited)

	_, _, err = states.issue("idp-a", "http://localhost:8080/auth/callback", false, "caller-b")
	require.NoError(t, err, "one caller's throttle must not affect another caller")
	_, _, err = states.issue("idp-a", "http://localhost:8080/auth/callback", false, "")
	require.NoError(t, err, "unkeyed issuance (limiter configured) ignores the throttle")
}

func TestSSOAuthStateStoreIssuanceThrottleWindowSlides(t *testing.T) {
	t.Parallel()

	now := time.Now()
	states := newSSOAuthStateStoreWithLimits(time.Minute, 100, 100)
	states.maxPerWindow = 1
	states.clock = func() time.Time { return now }

	_, _, err := states.issue("idp-a", "http://localhost:8080/auth/callback", false, "caller-a")
	require.NoError(t, err)
	_, _, err = states.issue("idp-a", "http://localhost:8080/auth/callback", false, "caller-a")
	require.ErrorIs(t, err, errSSOAuthStateIssuanceRateLimited)

	now = now.Add(states.issueWindow + time.Second)
	_, _, err = states.issue("idp-a", "http://localhost:8080/auth/callback", false, "caller-a")
	require.NoError(t, err, "issuances older than the window must stop throttling")
}

func TestSSOAuthStateStoreDropsStaleCallerHistory(t *testing.T) {
	t.Parallel()

	now := time.Now()
	states := newSSOAuthStateStoreWithLimits(10*time.Minute, 100, 100)
	states.clock = func() time.Time { return now }

	state, _, err := states.issue("idp-a", "http://localhost:8080/auth/callback", false, "caller-a")
	require.NoError(t, err)

	now = now.Add(states.issueWindow + time.Second)
	_, err = states.redeem(state, "idp-a")
	require.NoError(t, err)
	require.NotContains(t, states.callerIssued, "caller-a",
		"once a caller holds no live states and no in-window issuances, its throttle history must be dropped")
}

func TestSSOAuthStateStoreKeepsExpiryOrderUnderConcurrentIssue(t *testing.T) {
	t.Parallel()

	// Regression test: the expiry timestamp must come from a clock read taken
	// under the store mutex. Reading it before the lock let concurrent issuers
	// insert out of expiry order, and since the reaper stops at the first live
	// entry, a skewed insert could strand an expired entry behind a live one
	// and surface false store-full rejections.
	states := newSSOAuthStateStoreWithLimits(time.Minute, 256, 256)

	const issuers = 16
	const perIssuer = 8
	var wg sync.WaitGroup
	errs := make(chan error, issuers*perIssuer)
	for range issuers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for range perIssuer {
				if _, _, err := states.issue("idp-a", "http://localhost:8080/auth/callback", false, ""); err != nil {
					errs <- err
				}
			}
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		require.NoError(t, err)
	}

	require.Equal(t, issuers*perIssuer, len(states.states))
	previous := time.Time{}
	for elem := states.queue.Front(); elem != nil; elem = elem.Next() {
		queued := elem.Value.(*ssoStateQueueEntry)
		require.False(t, queued.state.expiresAt.Before(previous),
			"queue must stay in expiry order so reaping never strands an expired entry behind a live one")
		previous = queued.state.expiresAt
	}
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
