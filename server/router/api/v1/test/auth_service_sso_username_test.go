package test

import (
	"context"
	"strings"
	"sync"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	apiv1 "github.com/usememos/memos/server/router/api/v1"
	"github.com/usememos/memos/store"
)

func TestSSOSignInUsesValidIdentifierAsUsername(t *testing.T) {
	tests := []struct {
		name       string
		identifier string
	}{
		{name: "single character", identifier: "a"},
		{name: "common username", identifier: "alice"},
		{name: "uppercase and hyphens", identifier: "Alice-01"},
		{name: "maximum length", identifier: strings.Repeat("a", 36)},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			ts := NewTestService(t)
			defer ts.Cleanup()

			ctx := context.Background()
			mockIDP := newMockOAuthServer(t, "valid-code", "valid-token", map[string]any{
				"sub":   test.identifier,
				"name":  "Different Display Name",
				"email": "alice@example.com",
			})
			defer mockIDP.Close()

			idpName := createTestingOAuthIdentityProvider(ctx, t, ts, mockIDP.URL, "valid-identifier")
			response, err := signInWithTestingSSO(ctx, ts, idpName, "valid-code")
			require.NoError(t, err)
			require.Equal(t, test.identifier, response.User.Username)

			assertSingleSSOLink(ctx, t, ts, "valid-identifier", test.identifier, response.User.Username)
		})
	}
}

func TestSSOSignInFallsBackForInvalidIdentifier(t *testing.T) {
	tests := []struct {
		name       string
		identifier string
	}{
		{name: "numeric", identifier: "12345"},
		{name: "email", identifier: "alice@example.com"},
		{name: "underscore", identifier: "alice_example"},
		{name: "leading hyphen", identifier: "-alice"},
		{name: "trailing hyphen", identifier: "alice-"},
		{name: "surrounding whitespace", identifier: " alice "},
		{name: "too long", identifier: strings.Repeat("a", 37)},
		{name: "non ASCII", identifier: "爱丽丝"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			ts := NewTestService(t)
			defer ts.Cleanup()

			ctx := context.Background()
			mockIDP := newMockOAuthServer(t, "invalid-code", "invalid-token", map[string]any{
				"sub":  test.identifier,
				"name": "Alice Example",
			})
			defer mockIDP.Close()

			idpName := createTestingOAuthIdentityProvider(ctx, t, ts, mockIDP.URL, "invalid-identifier")
			response, err := signInWithTestingSSO(ctx, ts, idpName, "invalid-code")
			require.NoError(t, err)
			require.NotEqual(t, test.identifier, response.User.Username)
			_, err = uuid.Parse(response.User.Username)
			require.NoError(t, err, "fallback username must be a UUID")

			assertSingleSSOLink(ctx, t, ts, "invalid-identifier", test.identifier, response.User.Username)
		})
	}
}

func TestSSOSignInDoesNotTakeOverExistingUsername(t *testing.T) {
	ts := NewTestService(t)
	defer ts.Cleanup()

	ctx := context.Background()
	existingUser, err := ts.CreateRegularUser(ctx, "alice")
	require.NoError(t, err)

	mockIDP := newMockOAuthServer(t, "collision-code", "collision-token", map[string]any{
		"sub":   "alice",
		"name":  "SSO Alice",
		"email": "sso-alice@example.com",
	})
	defer mockIDP.Close()

	idpName := createTestingOAuthIdentityProvider(ctx, t, ts, mockIDP.URL, "username-collision")
	response, err := signInWithTestingSSO(ctx, ts, idpName, "collision-code")
	require.NoError(t, err)
	require.NotEqual(t, existingUser.Username, response.User.Username)
	_, err = uuid.Parse(response.User.Username)
	require.NoError(t, err)
	repeated, err := signInWithTestingSSO(ctx, ts, idpName, "collision-code")
	require.NoError(t, err)
	require.Equal(t, response.User.Name, repeated.User.Name)

	stillExisting, err := ts.Store.GetUser(ctx, &store.FindUser{ID: &existingUser.ID})
	require.NoError(t, err)
	require.Equal(t, "alice", stillExisting.Username)

	users, err := ts.Store.ListUsers(ctx, &store.FindUser{})
	require.NoError(t, err)
	require.Len(t, users, 2)
	assertSingleSSOLink(ctx, t, ts, "username-collision", "alice", response.User.Username)
}

func TestSSOSignInDoesNotAdoptReservedUsername(t *testing.T) {
	for _, identifier := range []string{"admin", "Admin", "support", "root"} {
		t.Run(identifier, func(t *testing.T) {
			ts := NewTestService(t)
			defer ts.Cleanup()

			ctx := context.Background()
			mockIDP := newMockOAuthServer(t, "reserved-code", "reserved-token", map[string]any{"sub": identifier})
			defer mockIDP.Close()

			idpName := createTestingOAuthIdentityProvider(ctx, t, ts, mockIDP.URL, "reserved-provider")
			response, err := signInWithTestingSSO(ctx, ts, idpName, "reserved-code")
			require.NoError(t, err)
			require.NotEqual(t, identifier, response.User.Username)
			_, err = uuid.Parse(response.User.Username)
			require.NoError(t, err, "reserved identifier must fall back to a UUID")
		})
	}
}

func TestSSOSignInReusesLinkedUser(t *testing.T) {
	tests := []struct {
		name       string
		identifier string
	}{
		{name: "preferred username", identifier: "alice"},
		{name: "UUID fallback", identifier: "alice@example.com"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			ts := NewTestService(t)
			defer ts.Cleanup()

			ctx := context.Background()
			mockIDP := newMockOAuthServer(t, "repeat-code", "repeat-token", map[string]any{
				"sub":  test.identifier,
				"name": "Alice Example",
			})
			defer mockIDP.Close()

			idpName := createTestingOAuthIdentityProvider(ctx, t, ts, mockIDP.URL, "repeat-provider")
			first, err := signInWithTestingSSO(ctx, ts, idpName, "repeat-code")
			require.NoError(t, err)
			second, err := signInWithTestingSSO(ctx, ts, idpName, "repeat-code")
			require.NoError(t, err)
			require.Equal(t, first.User.Name, second.User.Name)
			require.Equal(t, first.User.Username, second.User.Username)

			users, err := ts.Store.ListUsers(ctx, &store.FindUser{})
			require.NoError(t, err)
			require.Len(t, users, 1)
			assertSingleSSOLink(ctx, t, ts, "repeat-provider", test.identifier, first.User.Username)
		})
	}
}

func TestSSOSignInScopesSameIdentifierByProvider(t *testing.T) {
	ts := NewTestService(t)
	defer ts.Cleanup()

	ctx := context.Background()
	firstMockIDP := newMockOAuthServer(t, "first-code", "first-token", map[string]any{"sub": "alice"})
	defer firstMockIDP.Close()
	secondMockIDP := newMockOAuthServer(t, "second-code", "second-token", map[string]any{"sub": "alice"})
	defer secondMockIDP.Close()

	firstIDPName := createTestingOAuthIdentityProvider(ctx, t, ts, firstMockIDP.URL, "provider-one")
	secondIDPName := createTestingOAuthIdentityProvider(ctx, t, ts, secondMockIDP.URL, "provider-two")

	first, err := signInWithTestingSSO(ctx, ts, firstIDPName, "first-code")
	require.NoError(t, err)
	second, err := signInWithTestingSSO(ctx, ts, secondIDPName, "second-code")
	require.NoError(t, err)
	require.Equal(t, "alice", first.User.Username)
	require.NotEqual(t, first.User.Name, second.User.Name)
	_, err = uuid.Parse(second.User.Username)
	require.NoError(t, err)

	users, err := ts.Store.ListUsers(ctx, &store.FindUser{})
	require.NoError(t, err)
	require.Len(t, users, 2)
	identities, err := ts.Store.ListUserIdentities(ctx, &store.FindUserIdentity{ExternUID: ptr("alice")})
	require.NoError(t, err)
	require.Len(t, identities, 2)
}

func TestConcurrentSSOFirstSignInConvergesOnOneUser(t *testing.T) {
	ts := NewTestService(t)
	defer ts.Cleanup()

	ctx := context.Background()
	mockIDP := newMockOAuthServer(t, "concurrent-code", "concurrent-token", map[string]any{
		"sub":  "alice",
		"name": "Alice Example",
	})
	defer mockIDP.Close()
	idpName := createTestingOAuthIdentityProvider(ctx, t, ts, mockIDP.URL, "concurrent-provider")

	const signInCount = 8
	start := make(chan struct{})
	results := make(chan *v1pb.SignInResponse, signInCount)
	errs := make(chan error, signInCount)
	var waitGroup sync.WaitGroup
	for range signInCount {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			<-start
			response, err := signInWithTestingSSO(ctx, ts, idpName, "concurrent-code")
			results <- response
			errs <- err
		}()
	}

	close(start)
	waitGroup.Wait()
	close(results)
	close(errs)

	for err := range errs {
		require.NoError(t, err)
	}
	var userName string
	for response := range results {
		require.NotNil(t, response)
		if userName == "" {
			userName = response.User.Name
		} else {
			require.Equal(t, userName, response.User.Name)
		}
	}

	users, err := ts.Store.ListUsers(ctx, &store.FindUser{})
	require.NoError(t, err)
	require.Len(t, users, 1)
	assertSingleSSOLink(ctx, t, ts, "concurrent-provider", "alice", "alice")
}

func TestSSOSignInRejectsEmptyIdentifierWithoutCreatingUser(t *testing.T) {
	ts := NewTestService(t)
	defer ts.Cleanup()

	ctx := context.Background()
	mockIDP := newMockOAuthServer(t, "empty-code", "empty-token", map[string]any{"sub": ""})
	defer mockIDP.Close()
	idpName := createTestingOAuthIdentityProvider(ctx, t, ts, mockIDP.URL, "empty-identifier")

	// An empty subject must never provision an account. The OAuth2 layer rejects it
	// today, and resolveSSOUser guards it independently, so assert the invariant
	// that matters — no user or identity is created — rather than which layer's
	// error code surfaces.
	_, err := signInWithTestingSSO(ctx, ts, idpName, "empty-code")
	require.Error(t, err)
	require.NotEqual(t, codes.OK, status.Code(err))

	users, listErr := ts.Store.ListUsers(ctx, &store.FindUser{})
	require.NoError(t, listErr)
	require.Empty(t, users)
	identities, listErr := ts.Store.ListUserIdentities(ctx, &store.FindUserIdentity{})
	require.NoError(t, listErr)
	require.Empty(t, identities)
}

func TestSSOSignInHonorsRegistrationGate(t *testing.T) {
	ts := NewTestService(t)
	defer ts.Cleanup()

	ctx := context.Background()
	_, err := ts.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_GENERAL,
		Value: &storepb.InstanceSetting_GeneralSetting{
			GeneralSetting: &storepb.InstanceGeneralSetting{DisallowUserRegistration: true},
		},
	})
	require.NoError(t, err)

	mockIDP := newMockOAuthServer(t, "blocked-code", "blocked-token", map[string]any{"sub": "alice"})
	defer mockIDP.Close()
	idpName := createTestingOAuthIdentityProvider(ctx, t, ts, mockIDP.URL, "blocked-provider")

	_, err = signInWithTestingSSO(ctx, ts, idpName, "blocked-code")
	require.Error(t, err)
	require.Equal(t, codes.PermissionDenied, status.Code(err))

	users, listErr := ts.Store.ListUsers(ctx, &store.FindUser{})
	require.NoError(t, listErr)
	require.Empty(t, users)
}

func TestSSOSignInAllowsLinkedUserWhenRegistrationDisabled(t *testing.T) {
	ts := NewTestService(t)
	defer ts.Cleanup()

	ctx := context.Background()
	mockIDP := newMockOAuthServer(t, "linked-code", "linked-token", map[string]any{"sub": "alice"})
	defer mockIDP.Close()
	idpName := createTestingOAuthIdentityProvider(ctx, t, ts, mockIDP.URL, "linked-provider")

	first, err := signInWithTestingSSO(ctx, ts, idpName, "linked-code")
	require.NoError(t, err)
	_, err = ts.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_GENERAL,
		Value: &storepb.InstanceSetting_GeneralSetting{
			GeneralSetting: &storepb.InstanceGeneralSetting{DisallowUserRegistration: true},
		},
	})
	require.NoError(t, err)

	second, err := signInWithTestingSSO(ctx, ts, idpName, "linked-code")
	require.NoError(t, err)
	require.Equal(t, first.User.Name, second.User.Name)

	users, err := ts.Store.ListUsers(ctx, &store.FindUser{})
	require.NoError(t, err)
	require.Len(t, users, 1)
}

func signInWithTestingSSO(ctx context.Context, ts *TestService, idpName, code string) (*v1pb.SignInResponse, error) {
	return ts.Service.SignIn(apiv1.WithHeaderCarrier(ctx), &v1pb.SignInRequest{
		Credentials: &v1pb.SignInRequest_SsoCredentials{
			SsoCredentials: &v1pb.SignInRequest_SSOCredentials{
				IdpName:     idpName,
				Code:        code,
				RedirectUri: "http://localhost:8080/auth/callback",
			},
		},
	})
}

func assertSingleSSOLink(ctx context.Context, t *testing.T, ts *TestService, provider, externUID, username string) {
	t.Helper()

	identity, err := ts.Store.GetUserIdentity(ctx, &store.FindUserIdentity{
		Provider:  &provider,
		ExternUID: &externUID,
	})
	require.NoError(t, err)
	require.NotNil(t, identity)

	user, err := ts.Store.GetUser(ctx, &store.FindUser{ID: &identity.UserID})
	require.NoError(t, err)
	require.NotNil(t, user)
	require.Equal(t, username, user.Username)

	identities, err := ts.Store.ListUserIdentities(ctx, &store.FindUserIdentity{
		Provider:  &provider,
		ExternUID: &externUID,
	})
	require.NoError(t, err)
	require.Len(t, identities, 1)
}

func ptr[T any](value T) *T {
	return &value
}
