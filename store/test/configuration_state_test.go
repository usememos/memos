package test

import (
	"context"
	"fmt"
	"sync"
	"testing"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func managedResource(name string) *storepb.InstanceConfigurationState_ManagedResource {
	return &storepb.InstanceConfigurationState_ManagedResource{
		Name:          name,
		Kind:          "InstanceSetting",
		Source:        "instance.json",
		ManagedFields: []string{"*"},
	}
}

func TestConfigurationStateSerial(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	t.Cleanup(func() { require.NoError(t, ts.Close()) })

	initial, err := ts.GetConfigurationState(ctx)
	require.NoError(t, err)
	require.Zero(t, initial.Serial, "before any apply the record is empty")
	require.Empty(t, initial.Resources)

	// The first change creates the row with serial 1, whatever serial the body sets.
	stored, err := ts.RunConfigurationTransaction(ctx, func(_ context.Context, tx *store.ConfigurationTransaction) (*storepb.InstanceConfigurationState, error) {
		require.Zero(t, tx.State().Serial)
		return &storepb.InstanceConfigurationState{Serial: 99, ConfigDigest: "a", Resources: []*storepb.InstanceConfigurationState_ManagedResource{
			managedResource("instance/settings/ACCESS"),
		}}, nil
	})
	require.NoError(t, err)
	require.Equal(t, int64(1), stored.Serial)

	// A body with no change commits nothing and keeps the serial.
	unchanged, err := ts.RunConfigurationTransaction(ctx, func(_ context.Context, tx *store.ConfigurationTransaction) (*storepb.InstanceConfigurationState, error) {
		require.Equal(t, int64(1), tx.State().Serial)
		return nil, nil
	})
	require.NoError(t, err)
	require.True(t, proto.Equal(stored, unchanged))

	// A failing body rolls back.
	failure := errors.New("plan failed")
	_, err = ts.RunConfigurationTransaction(ctx, func(context.Context, *store.ConfigurationTransaction) (*storepb.InstanceConfigurationState, error) {
		return &storepb.InstanceConfigurationState{ConfigDigest: "discarded"}, failure
	})
	require.ErrorIs(t, err, failure)

	// A second change updates the row.
	stored, err = ts.RunConfigurationTransaction(ctx, func(_ context.Context, tx *store.ConfigurationTransaction) (*storepb.InstanceConfigurationState, error) {
		next := tx.State()
		next.ConfigDigest = "b"
		next.Resources = append(next.Resources, managedResource("instance/settings/GENERAL"))
		return next, nil
	})
	require.NoError(t, err)
	require.Equal(t, int64(2), stored.Serial)

	read, err := ts.GetConfigurationState(ctx)
	require.NoError(t, err)
	require.True(t, proto.Equal(stored, read))
	require.Equal(t, "b", read.ConfigDigest)
	require.Len(t, read.Resources, 2)
}

func TestConfigurationStateIsNotAnInstanceSetting(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	t.Cleanup(func() { require.NoError(t, ts.Close()) })

	_, err := ts.RunConfigurationTransaction(ctx, func(context.Context, *store.ConfigurationTransaction) (*storepb.InstanceConfigurationState, error) {
		return &storepb.InstanceConfigurationState{Resources: []*storepb.InstanceConfigurationState_ManagedResource{managedResource("instance/settings/ACCESS")}}, nil
	})
	require.NoError(t, err)

	settings, err := ts.ListInstanceSettings(ctx, &store.FindInstanceSetting{})
	require.NoError(t, err)
	for _, setting := range settings {
		require.NotEqual(t, storepb.InstanceSettingKey_CONFIGURATION_STATE, setting.Key)
	}
	setting, err := ts.GetInstanceSetting(ctx, &store.FindInstanceSetting{Name: storepb.InstanceSettingKey_CONFIGURATION_STATE.String()})
	require.NoError(t, err)
	require.Nil(t, setting)
}

// TestConfigurationStateConcurrentApplies runs transactions that each add one
// managed resource, as replicas starting together each apply at boot.
// Serializable isolation plus the conditional write must serialize them, and
// the retries must absorb the conflicts: every transaction commits once and
// none overwrites another.
func TestConfigurationStateConcurrentApplies(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	t.Cleanup(func() { require.NoError(t, ts.Close()) })

	const applies = 6
	var wg sync.WaitGroup
	errs := make(chan error, applies)
	for i := range applies {
		wg.Go(func() {
			_, err := ts.RunConfigurationTransaction(ctx, func(_ context.Context, tx *store.ConfigurationTransaction) (*storepb.InstanceConfigurationState, error) {
				next := tx.State()
				next.Resources = append(next.Resources, managedResource(fmt.Sprintf("users/user-%d", i)))
				return next, nil
			})
			errs <- err
		})
	}
	wg.Wait()
	close(errs)

	for err := range errs {
		require.NoError(t, err)
	}
	state, err := ts.GetConfigurationState(ctx)
	require.NoError(t, err)
	require.Equal(t, int64(applies), state.Serial)
	require.Len(t, state.Resources, applies)
}

// TestConfigurationTransactionWrites runs every write apply makes inside one
// transaction: the transaction reads what it wrote, and the commit makes it
// visible through the store's cached reads.
func TestConfigurationTransactionWrites(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	t.Cleanup(func() { require.NoError(t, ts.Close()) })

	// Prime the setting cache, so the test sees whether the commit invalidates it.
	_, err := ts.GetInstanceGeneralSetting(ctx)
	require.NoError(t, err)
	existing, err := ts.CreateUser(ctx, &store.User{Username: "existing", Role: store.RoleAdmin, PasswordHash: "hash"})
	require.NoError(t, err)

	_, err = ts.RunConfigurationTransaction(ctx, func(ctx context.Context, tx *store.ConfigurationTransaction) (*storepb.InstanceConfigurationState, error) {
		require.NoError(t, tx.CreateIdentityProvider(ctx, createTestOAuth2IDP("SSO", "sso")))
		providers, err := tx.ListIdentityProviders(ctx, &store.FindIdentityProvider{})
		require.NoError(t, err)
		require.Len(t, providers, 1, "the transaction reads its own write")
		replaced := proto.CloneOf(providers[0])
		replaced.Name = "Renamed SSO"
		replaced.Config.GetOauth2Config().Scopes = []string{"openid"}
		require.NoError(t, tx.ReplaceIdentityProvider(ctx, providers[0].Id, replaced))

		require.NoError(t, tx.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{Key: storepb.InstanceSettingKey_GENERAL, Value: &storepb.InstanceSetting_GeneralSetting{
			GeneralSetting: &storepb.InstanceGeneralSetting{CustomProfile: &storepb.InstanceCustomProfile{Title: "Configured"}},
		}}))
		general, err := tx.GetUncachedInstanceSetting(ctx, &store.FindInstanceSetting{Name: "GENERAL"})
		require.NoError(t, err)
		require.Equal(t, "Configured", general.GetGeneralSetting().GetCustomProfile().GetTitle())
		require.NoError(t, tx.DeleteInstanceSetting(ctx, storepb.InstanceSettingKey_MEMO_RELATED))

		created, err := tx.CreateUser(ctx, &store.User{Username: "admin", Role: store.RoleAdmin, Email: " Admin@Example.com ", PasswordHash: "hash"})
		require.NoError(t, err)
		role := store.RoleUser
		nickname := "Demoted"
		require.NoError(t, tx.UpdateUser(ctx, &store.UpdateUser{ID: existing.ID, Role: &role, Nickname: &nickname}))
		users, err := tx.ListUsers(ctx, &store.FindUser{UsernameList: []string{"admin", "existing"}})
		require.NoError(t, err)
		require.Len(t, users, 2)
		require.Equal(t, "admin@example.com", created.Email, "the email is normalized as the store's writes do")
		return &storepb.InstanceConfigurationState{}, nil
	})
	require.NoError(t, err)

	provider, err := ts.GetIdentityProvider(ctx, &store.FindIdentityProvider{UID: new("sso")})
	require.NoError(t, err)
	require.Equal(t, "Renamed SSO", provider.Name)
	require.Equal(t, []string{"openid"}, provider.Config.GetOauth2Config().Scopes)
	general, err := ts.GetInstanceGeneralSetting(ctx)
	require.NoError(t, err)
	require.Equal(t, "Configured", general.GetCustomProfile().GetTitle(), "the commit invalidated the cached setting")
	memoRelated, err := ts.GetUncachedInstanceSetting(ctx, &store.FindInstanceSetting{Name: "MEMO_RELATED"})
	require.NoError(t, err)
	require.Nil(t, memoRelated)
	demoted, err := ts.GetUser(ctx, &store.FindUser{ID: &existing.ID})
	require.NoError(t, err)
	require.Equal(t, store.RoleUser, demoted.Role)
	require.Equal(t, "Demoted", demoted.Nickname, "the commit invalidated the cached user")
}

func TestConfigurationTransactionRollsBack(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	t.Cleanup(func() { require.NoError(t, ts.Close()) })
	only, err := ts.CreateUser(ctx, &store.User{Username: "only", Role: store.RoleAdmin, PasswordHash: "hash"})
	require.NoError(t, err)

	_, err = ts.RunConfigurationTransaction(ctx, func(ctx context.Context, tx *store.ConfigurationTransaction) (*storepb.InstanceConfigurationState, error) {
		require.NoError(t, tx.CreateIdentityProvider(ctx, createTestOAuth2IDP("SSO", "sso")))
		role := store.RoleUser
		// Demoting the last administrator fails as it does through the API,
		// and the whole transaction rolls back with it.
		return nil, tx.UpdateUser(ctx, &store.UpdateUser{ID: only.ID, Role: &role})
	})
	require.ErrorIs(t, err, store.ErrLastInstanceAdmin)

	providers, err := ts.ListIdentityProviders(ctx, &store.FindIdentityProvider{})
	require.NoError(t, err)
	require.Empty(t, providers, "nothing from the failed transaction remains")
	state, err := ts.GetConfigurationState(ctx)
	require.NoError(t, err)
	require.Zero(t, state.Serial)
}
