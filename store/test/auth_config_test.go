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

type pausedGeneralRead struct {
	store.Driver
	read    chan struct{}
	release chan struct{}
}

func (d *pausedGeneralRead) ListInstanceSettings(ctx context.Context, find *store.FindInstanceSetting) ([]*store.InstanceSetting, error) {
	rows, err := d.Driver.ListInstanceSettings(ctx, find)
	close(d.read)
	<-d.release
	return rows, err
}

func TestGeneralMergeBaseReadCannotOverwriteNewerCacheEntry(t *testing.T) {
	ctx := context.Background()
	db := NewTestingStore(ctx, t)
	t.Cleanup(func() { require.NoError(t, db.Close()) })
	driver := &pausedGeneralRead{Driver: db.GetDriver(), read: make(chan struct{}), release: make(chan struct{})}
	s := store.New(driver, nil)
	setting := &storepb.InstanceSetting{
		Key:   storepb.InstanceSettingKey_GENERAL,
		Value: &storepb.InstanceSetting_GeneralSetting{GeneralSetting: &storepb.InstanceGeneralSetting{AdditionalStyle: "first"}},
	}
	_, err := s.UpsertInstanceGeneralSettingSafely(ctx, setting)
	require.NoError(t, err)

	done := make(chan error, 1)
	go func() {
		_, err := s.GetUncachedInstanceSetting(ctx, &store.FindInstanceSetting{Name: "GENERAL"})
		done <- err
	}()
	<-driver.read
	setting.GetGeneralSetting().AdditionalStyle = "second"
	_, err = s.UpsertInstanceGeneralSettingSafely(ctx, setting)
	close(driver.release)
	require.NoError(t, err)
	require.NoError(t, <-done)
	cached, err := s.GetInstanceGeneralSetting(ctx)
	require.NoError(t, err)
	require.Equal(t, "second", cached.GetAdditionalStyle())
}
