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

func TestGeneralSettingRejectsStaleMergeBase(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	t.Cleanup(func() { require.NoError(t, ts.Close()) })
	expected, err := ts.GetInstanceGeneralSetting(ctx)
	require.NoError(t, err)
	setting := &storepb.InstanceSetting{
		Key:   storepb.InstanceSettingKey_GENERAL,
		Value: &storepb.InstanceSetting_GeneralSetting{GeneralSetting: &storepb.InstanceGeneralSetting{AdditionalStyle: "first"}},
	}
	_, err = ts.UpsertInstanceGeneralSettingSafely(ctx, setting)
	require.NoError(t, err)
	setting.GetGeneralSetting().AdditionalStyle = "stale"
	_, err = ts.UpdateInstanceGeneralSettingIfUnchanged(ctx, setting, expected)
	require.ErrorIs(t, err, store.ErrInstanceSettingChanged)
	stored, err := ts.GetUncachedInstanceSetting(ctx, &store.FindInstanceSetting{Name: "GENERAL"})
	require.NoError(t, err)
	require.Equal(t, "first", stored.GetGeneralSetting().GetAdditionalStyle())
}
