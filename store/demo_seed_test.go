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

func TestDemoSeedRequiresIdentityProviderSignIn(t *testing.T) {
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
	require.True(t, generalSetting.DisallowPasswordAuth)
	require.False(t, generalSetting.DisallowUserRegistration, "SSO first-login provisioning must remain enabled")

	demoUsername := "demo"
	demoUser, err := stores.GetUser(ctx, &store.FindUser{Username: &demoUsername})
	require.NoError(t, err)
	require.NotNil(t, demoUser)
	require.Equal(t, store.RoleAdmin, demoUser.Role)
	require.Error(t, bcrypt.CompareHashAndPassword([]byte(demoUser.PasswordHash), []byte("demo")))
	demoCost, err := bcrypt.Cost([]byte(demoUser.PasswordHash))
	require.NoError(t, err)
	require.GreaterOrEqual(t, demoCost, 12)

	aliceUsername := "alice"
	aliceUser, err := stores.GetUser(ctx, &store.FindUser{Username: &aliceUsername})
	require.NoError(t, err)
	require.NotNil(t, aliceUser)
	require.Error(t, bcrypt.CompareHashAndPassword([]byte(aliceUser.PasswordHash), []byte("demo")))
	require.NotEqual(t, demoUser.PasswordHash, aliceUser.PasswordHash)
}
