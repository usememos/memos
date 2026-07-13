package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestAuthenticationConfigurationMutation(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	t.Cleanup(func() { require.NoError(t, ts.Close()) })

	general := &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_GENERAL,
		Value: &storepb.InstanceSetting_GeneralSetting{GeneralSetting: &storepb.InstanceGeneralSetting{
			DisallowPasswordAuth: true,
		}},
	}
	_, err := ts.UpsertInstanceGeneralSettingSafely(ctx, general)
	require.ErrorIs(t, err, store.ErrUnsafeAuthenticationConfiguration)

	provider, err := ts.CreateIdentityProvider(ctx, createTestOAuth2IDP("Primary", "primary-sso"))
	require.NoError(t, err)
	_, err = ts.UpsertInstanceGeneralSettingSafely(ctx, general)
	require.NoError(t, err)

	err = ts.DeleteIdentityProviderSafely(ctx, &store.DeleteIdentityProvider{ID: provider.Id})
	require.ErrorIs(t, err, store.ErrUnsafeAuthenticationConfiguration)
}
