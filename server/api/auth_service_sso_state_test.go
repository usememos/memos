package api

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestSSOAuthStateStoreIssueAndRedeem(t *testing.T) {
	t.Parallel()

	states := newSSOAuthStateStore(time.Minute)
	state, expiresAt, err := states.issue("idp-a", "http://localhost:8080/auth/callback", true)
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
	state, _, err := states.issue("idp-a", "http://localhost:8080/auth/callback", false)
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

	state, _, err := states.issue("idp-a", "http://localhost:8080/auth/callback", false)
	require.NoError(t, err)
	_, err = states.redeem(state, "idp-b")
	require.Error(t, err, "a state must not redeem for a different provider")
}

func TestSSOAuthStateStoreExpiresTokens(t *testing.T) {
	t.Parallel()

	states := newSSOAuthStateStore(-time.Second)
	state, _, err := states.issue("idp-a", "http://localhost:8080/auth/callback", false)
	require.NoError(t, err)

	_, err = states.redeem(state, "idp-a")
	require.Error(t, err, "an expired state must not redeem")
}
