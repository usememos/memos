package store_test

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/db/sqlite"
)

func TestApplyIdentityProviderBootstrapCreatesAndUpdatesProvider(t *testing.T) {
	ctx := context.Background()
	stores := newIdentityProviderBootstrapTestStore(t)
	bootstrapDir := t.TempDir()
	bootstrapPath := filepath.Join(bootstrapDir, "memos-idp-primary.json")

	writeIdentityProviderBootstrap(t, bootstrapPath, "Initial SSO", "initial-secret")
	require.NoError(t, stores.ApplyIdentityProviderBootstrapDir(ctx, bootstrapDir))

	provider, err := stores.GetIdentityProvider(ctx, &store.FindIdentityProvider{UID: ptr("primary-sso")})
	require.NoError(t, err)
	require.NotNil(t, provider)
	assert.Equal(t, "Initial SSO", provider.Name)
	assert.Equal(t, "initial-secret", provider.Config.GetOauth2Config().ClientSecret)
	providerID := provider.Id

	writeIdentityProviderBootstrap(t, bootstrapPath, "Updated SSO", "rotated-secret")
	require.NoError(t, stores.ApplyIdentityProviderBootstrapDir(ctx, bootstrapDir))

	provider, err = stores.GetIdentityProvider(ctx, &store.FindIdentityProvider{UID: ptr("primary-sso")})
	require.NoError(t, err)
	require.NotNil(t, provider)
	assert.Equal(t, providerID, provider.Id)
	assert.Equal(t, "Updated SSO", provider.Name)
	assert.Equal(t, "rotated-secret", provider.Config.GetOauth2Config().ClientSecret)
}

func TestApplyIdentityProviderBootstrapValidatesEntireFileBeforeWriting(t *testing.T) {
	ctx := context.Background()
	stores := newIdentityProviderBootstrapTestStore(t)
	bootstrapDir := t.TempDir()
	writeIdentityProviderBootstrap(t, filepath.Join(bootstrapDir, "memos-idp-a-valid.json"), "Valid Provider", "must-not-appear-in-errors")
	invalidContent := `{
  "uid": "invalid/provider",
  "name": "Invalid Provider",
  "type": "OAUTH2",
  "config": {
    "oauth2Config": {
      "clientId": "client-id",
      "clientSecret": "another-secret",
      "authUrl": "https://example.com/authorize",
      "tokenUrl": "https://example.com/token",
      "userInfoUrl": "https://example.com/userinfo",
      "scopes": ["profile"],
      "fieldMapping": {"identifier": "sub"}
    }
  }
}`
	require.NoError(t, os.WriteFile(filepath.Join(bootstrapDir, "memos-idp-z-invalid.json"), []byte(invalidContent), 0600))

	err := stores.ApplyIdentityProviderBootstrapDir(ctx, bootstrapDir)
	require.Error(t, err)
	assert.ErrorContains(t, err, "identityProviders[1].uid is invalid")
	assert.NotContains(t, err.Error(), "must-not-appear-in-errors")
	assert.NotContains(t, err.Error(), "another-secret")

	providers, err := stores.ListIdentityProviders(ctx, &store.FindIdentityProvider{})
	require.NoError(t, err)
	assert.Empty(t, providers)
}

func TestApplyIdentityProviderBootstrapRejectsUnknownFields(t *testing.T) {
	stores := newIdentityProviderBootstrapTestStore(t)
	bootstrapDir := t.TempDir()
	bootstrapPath := filepath.Join(bootstrapDir, "memos-idp-invalid.json")
	require.NoError(t, os.WriteFile(bootstrapPath, []byte(`{"uid":"primary-sso","unexpected":true}`), 0600))

	err := stores.ApplyIdentityProviderBootstrapDir(context.Background(), bootstrapDir)
	require.Error(t, err)
	assert.ErrorContains(t, err, `unknown field "unexpected"`)
}

func TestApplyIdentityProviderBootstrapDirRejectsDuplicateUIDsAcrossFiles(t *testing.T) {
	stores := newIdentityProviderBootstrapTestStore(t)
	bootstrapDir := t.TempDir()
	writeIdentityProviderBootstrap(t, filepath.Join(bootstrapDir, "memos-idp-first.json"), "First Provider", "first-secret")
	writeIdentityProviderBootstrap(t, filepath.Join(bootstrapDir, "memos-idp-second.json"), "Second Provider", "second-secret")

	err := stores.ApplyIdentityProviderBootstrapDir(context.Background(), bootstrapDir)
	require.Error(t, err)
	assert.ErrorContains(t, err, `uid duplicates "primary-sso"`)

	providers, listErr := stores.ListIdentityProviders(context.Background(), &store.FindIdentityProvider{})
	require.NoError(t, listErr)
	assert.Empty(t, providers)
}

func TestApplyIdentityProviderBootstrapDirIgnoresUnrelatedSecretFiles(t *testing.T) {
	stores := newIdentityProviderBootstrapTestStore(t)
	bootstrapDir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(bootstrapDir, ".env"), []byte("DATABASE_PASSWORD=secret"), 0600))
	writeIdentityProviderBootstrap(t, filepath.Join(bootstrapDir, "memos-idp-primary.json"), "Primary SSO", "oauth-secret")

	require.NoError(t, stores.ApplyIdentityProviderBootstrapDir(context.Background(), bootstrapDir))
	provider, err := stores.GetIdentityProvider(context.Background(), &store.FindIdentityProvider{UID: ptr("primary-sso")})
	require.NoError(t, err)
	require.NotNil(t, provider)
}

func TestApplyIdentityProviderBootstrapDirIgnoresDirectoryWithoutMatchingFiles(t *testing.T) {
	stores := newIdentityProviderBootstrapTestStore(t)
	bootstrapDir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(bootstrapDir, "database-password"), []byte("secret"), 0600))

	require.NoError(t, stores.ApplyIdentityProviderBootstrapDir(context.Background(), bootstrapDir))
}

func TestApplyIdentityProviderBootstrapDirIgnoresMissingDirectory(t *testing.T) {
	stores := newIdentityProviderBootstrapTestStore(t)
	bootstrapDir := filepath.Join(t.TempDir(), "missing")

	require.NoError(t, stores.ApplyIdentityProviderBootstrapDir(context.Background(), bootstrapDir))
}

func newIdentityProviderBootstrapTestStore(t *testing.T) *store.Store {
	t.Helper()
	p := &profile.Profile{
		Data:   t.TempDir(),
		Driver: "sqlite",
		DSN:    filepath.Join(t.TempDir(), "bootstrap.db"),
	}
	driver, err := sqlite.NewDB(p)
	require.NoError(t, err)
	stores := store.New(driver, p)
	require.NoError(t, stores.Migrate(context.Background()))
	t.Cleanup(func() {
		require.NoError(t, stores.Close())
	})
	return stores
}

func writeIdentityProviderBootstrap(t *testing.T, path, title, secret string) {
	t.Helper()
	content := `{
  "uid": "primary-sso",
  "name": "` + title + `",
  "type": "OAUTH2",
  "identifierFilter": "",
  "config": {
    "oauth2Config": {
      "clientId": "client-id",
      "clientSecret": "` + secret + `",
      "authUrl": "https://example.com/authorize",
      "tokenUrl": "https://example.com/token",
      "userInfoUrl": "https://example.com/userinfo",
      "scopes": ["profile", "email"],
      "fieldMapping": {
        "identifier": "sub",
        "displayName": "name",
        "email": "email",
        "avatarUrl": "picture"
      }
    }
  }
}`
	require.False(t, strings.Contains(title, `"`))
	require.False(t, strings.Contains(secret, `"`))
	require.NoError(t, os.WriteFile(path, []byte(content), 0600))
}

func ptr[T any](value T) *T {
	return &value
}
