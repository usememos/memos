package auth

import (
	"context"
	stderrors "errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/internal/profile"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/db"

	// sqlite driver for focused authenticator tests.
	_ "modernc.org/sqlite"
)

// TestAuthenticateNoCredentials covers the store-free paths: absent or malformed
// credentials must resolve to "unauthenticated" without touching the store.
// Token-valid paths are exercised by the API/fileserver integration tests.
func TestAuthenticateNoCredentials(t *testing.T) {
	ctx := context.Background()
	a := &Authenticator{secret: "test-secret"} // nil store: these paths never reach it.

	t.Run("Authenticate returns nil without an Authorization header", func(t *testing.T) {
		assert.Nil(t, a.Authenticate(ctx, ""))
	})
	t.Run("Authenticate returns nil for a malformed bearer token", func(t *testing.T) {
		assert.Nil(t, a.Authenticate(ctx, "Bearer not-a-valid-jwt"))
	})

	t.Run("AuthenticateToUser returns nil without any credentials", func(t *testing.T) {
		user, err := a.AuthenticateToUser(ctx, "", "")
		assert.NoError(t, err)
		assert.Nil(t, user)
	})
	t.Run("AuthenticateToUser returns nil for a malformed bearer and no cookie", func(t *testing.T) {
		user, err := a.AuthenticateToUser(ctx, "Bearer not-a-valid-jwt", "")
		assert.NoError(t, err)
		assert.Nil(t, user)
	})
}

// TestAuthenticateToUserCredentialFailuresBecomeAnonymous verifies bad stored credentials do not surface as server errors.
func TestAuthenticateToUserCredentialFailuresBecomeAnonymous(t *testing.T) {
	ctx := context.Background()
	st := newAuthenticatorTestingStore(ctx, t)
	t.Cleanup(func() { st.Close() })
	user, err := st.CreateUser(ctx, &store.User{Username: "auth-credential-user", Role: store.RoleUser})
	require.NoError(t, err)
	a := NewAuthenticator(st, "test-secret")

	t.Run("unknown PAT", func(t *testing.T) {
		viewer, err := a.AuthenticateToUser(ctx, "Bearer "+PersonalAccessTokenPrefix+"missing", "")
		require.NoError(t, err)
		require.Nil(t, viewer)
	})

	t.Run("revoked refresh token", func(t *testing.T) {
		refreshToken, _, err := GenerateRefreshToken(user.ID, "revoked-token", []byte("test-secret"))
		require.NoError(t, err)
		viewer, err := a.AuthenticateToUser(ctx, "", RefreshTokenCookieName+"="+refreshToken)
		require.NoError(t, err)
		require.Nil(t, viewer)
	})

	t.Run("expired refresh token", func(t *testing.T) {
		const tokenID = "expired-token"
		refreshToken, _, err := GenerateRefreshToken(user.ID, tokenID, []byte("test-secret"))
		require.NoError(t, err)
		require.NoError(t, st.AddUserRefreshToken(ctx, user.ID, &storepb.RefreshTokensUserSetting_RefreshToken{
			TokenId:   tokenID,
			ExpiresAt: timestamppb.New(time.Now().Add(-time.Hour)),
			CreatedAt: timestamppb.Now(),
		}))
		viewer, err := a.AuthenticateToUser(ctx, "", RefreshTokenCookieName+"="+refreshToken)
		require.NoError(t, err)
		require.Nil(t, viewer)
	})
}

// TestAuthenticateToUserStoreFailuresPropagate verifies outages are not hidden as invalid credentials.
func TestAuthenticateToUserStoreFailuresPropagate(t *testing.T) {
	ctx := context.Background()
	storeErr := stderrors.New("store unavailable")

	t.Run("access token user lookup", func(t *testing.T) {
		token, _, err := GenerateAccessTokenV2(1, "auth-store-user", string(store.RoleUser), string(store.Normal), []byte("test-secret"))
		require.NoError(t, err)
		a := NewAuthenticator(store.New(failingAuthDriver{listUsersErr: storeErr}, &profile.Profile{}), "test-secret")
		viewer, err := a.AuthenticateToUser(ctx, "Bearer "+token, "")
		require.ErrorIs(t, err, storeErr)
		require.Nil(t, viewer)
	})

	t.Run("PAT lookup", func(t *testing.T) {
		a := NewAuthenticator(store.New(failingAuthDriver{patErr: storeErr}, &profile.Profile{}), "test-secret")
		viewer, err := a.AuthenticateToUser(ctx, "Bearer "+PersonalAccessTokenPrefix+"unavailable", "")
		require.ErrorIs(t, err, storeErr)
		require.Nil(t, viewer)
	})

	t.Run("refresh token lookup", func(t *testing.T) {
		refreshToken, _, err := GenerateRefreshToken(1, "store-failure-token", []byte("test-secret"))
		require.NoError(t, err)
		a := NewAuthenticator(store.New(failingAuthDriver{listUserSettingsErr: storeErr}, &profile.Profile{}), "test-secret")
		viewer, err := a.AuthenticateToUser(ctx, "", RefreshTokenCookieName+"="+refreshToken)
		require.ErrorIs(t, err, storeErr)
		require.Nil(t, viewer)
	})
}

type failingAuthDriver struct {
	store.Driver
	listUsersErr        error
	patErr              error
	listUserSettingsErr error
}

func (d failingAuthDriver) ListUsers(context.Context, *store.FindUser) ([]*store.User, error) {
	return nil, d.listUsersErr
}

func (d failingAuthDriver) GetUserByPATHash(context.Context, string) (*store.PATQueryResult, error) {
	return nil, d.patErr
}

func (d failingAuthDriver) ListUserSettings(context.Context, *store.FindUserSetting) ([]*store.UserSetting, error) {
	return nil, d.listUserSettingsErr
}

// newAuthenticatorTestingStore returns a migrated SQLite store for authenticator behavior tests.
func newAuthenticatorTestingStore(ctx context.Context, t *testing.T) *store.Store {
	t.Helper()
	p := &profile.Profile{Data: t.TempDir(), Driver: "sqlite", DSN: ":memory:"}
	driver, err := db.NewDBDriver(p)
	require.NoError(t, err)
	st := store.New(driver, p)
	require.NoError(t, st.Migrate(ctx))
	return st
}
