package store_test

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/db/sqlite"
)

func TestDemoSeedUsesDeploymentAuthenticationPolicy(t *testing.T) {
	ctx := context.Background()
	p := &profile.Profile{
		Demo:   true,
		Data:   t.TempDir(),
		Driver: "sqlite",
		DSN:    filepath.Join(t.TempDir(), "demo.db"),
	}
	driver, err := sqlite.NewDB(p)
	require.NoError(t, err)
	stores := store.New(driver, p)
	t.Cleanup(func() {
		require.NoError(t, stores.Close())
	})

	require.NoError(t, stores.Migrate(ctx))
	generalSetting, err := stores.GetInstanceGeneralSetting(ctx)
	require.NoError(t, err)
	require.False(t, generalSetting.DisallowPasswordAuth, "authentication policy must come from deployment configuration")
	require.False(t, generalSetting.DisallowUserRegistration, "SSO first-login provisioning must remain enabled")

	secretDir := t.TempDir()
	writeDeploymentIdentityProvider(t, filepath.Join(secretDir, "memos-idp-primary-sso.json"), "primary-sso", "Primary SSO", "secret")
	writeDeploymentGeneralSetting(t, filepath.Join(secretDir, "memos-instance-setting-general.json"), 0, true)
	require.NoError(t, stores.LoadDeploymentConfigurationDir(ctx, secretDir))
	generalSetting, err = stores.GetInstanceGeneralSetting(ctx)
	require.NoError(t, err)
	require.True(t, generalSetting.DisallowPasswordAuth)
	require.False(t, generalSetting.DisallowUserRegistration, "SSO first-login provisioning must remain enabled")
	provider, err := stores.GetIdentityProvider(ctx, &store.FindIdentityProvider{UID: ptr("primary-sso")})
	require.NoError(t, err)
	require.NotNil(t, provider)

	adminUsername := "steven"
	adminUser, err := stores.GetUser(ctx, &store.FindUser{Username: &adminUsername})
	require.NoError(t, err)
	require.NotNil(t, adminUser)
	require.Equal(t, store.RoleAdmin, adminUser.Role)
	require.Error(t, bcrypt.CompareHashAndPassword([]byte(adminUser.PasswordHash), []byte("demo")))
	adminCost, err := bcrypt.Cost([]byte(adminUser.PasswordHash))
	require.NoError(t, err)
	require.GreaterOrEqual(t, adminCost, 12)

	aliceUsername := "alice"
	aliceUser, err := stores.GetUser(ctx, &store.FindUser{Username: &aliceUsername})
	require.NoError(t, err)
	require.NotNil(t, aliceUser)
	require.Error(t, bcrypt.CompareHashAndPassword([]byte(aliceUser.PasswordHash), []byte("demo")))
	require.NotEqual(t, adminUser.PasswordHash, aliceUser.PasswordHash)
}
