package configuration

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/internal/version"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/db/sqlite"
)

func newTestStore(t *testing.T) *store.Store {
	t.Helper()
	instanceProfile := &profile.Profile{Data: t.TempDir(), Driver: "sqlite", Version: version.GetCurrentVersion()}
	require.NoError(t, instanceProfile.Validate())
	driver, err := sqlite.NewDB(instanceProfile)
	require.NoError(t, err)
	s := store.New(driver, instanceProfile)
	t.Cleanup(func() { require.NoError(t, s.Close()) })
	require.NoError(t, s.Migrate(context.Background()))
	return s
}

func applyFor(t *testing.T, desired *Desired, s *store.Store) (*Plan, *storepb.InstanceConfigurationState) {
	t.Helper()
	plan, state, err := Apply(context.Background(), desired, s, ApplyMetadata{AppliedBy: "test host", Version: "test", Now: time.Unix(1_800_000_000, 0)})
	require.NoError(t, err)
	return plan, state
}

func requirePassword(t *testing.T, s *store.Store, username, password string) {
	t.Helper()
	user, err := s.GetUser(context.Background(), &store.FindUser{Username: &username})
	require.NoError(t, err)
	require.NotNil(t, user)
	require.NoError(t, bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)))
}

func instanceFiles(title, password string, version string) map[string]string {
	withSecret := `{"name":"identity-providers/sso","type":"OAUTH2","title":"SSO","config":{"oauth2Config":{"clientId":"memos","clientSecret":"file-secret",
	"authUrl":"https://idp.example.com/authorize","tokenUrl":"https://idp.example.com/token","userInfoUrl":"https://idp.example.com/userinfo",
	"fieldMapping":{"identifier":"sub"}}}}`
	return map[string]string{
		"idp.json":     `{"identityProviders":[` + withSecret + `]}`,
		"general.json": generalDocument(title),
		"users.json": `{"users":[{"name":"users/admin","username":"admin","role":"ADMIN","password":"` + password + `"}],
			"lifecycle":[{"resource":"users/admin","writeOnlyVersion":` + version + `}]}`,
	}
}

func TestApplyLifecycle(t *testing.T) {
	ctx := context.Background()
	s := newTestStore(t)

	plan, state := applyFor(t, loadDesired(t, instanceFiles("Company", "first-password", "1")), s)
	require.True(t, plan.Valid())
	require.True(t, plan.HasChanges())
	require.Equal(t, int64(1), state.Serial)
	require.Equal(t, "test host", state.AppliedBy)
	require.Len(t, state.Resources, 3)
	for _, resource := range state.Resources {
		require.Equal(t, int64(1_800_000_000), resource.AppliedTs, resource.Name)
	}

	provider, err := s.GetIdentityProvider(ctx, &store.FindIdentityProvider{UID: new("sso")})
	require.NoError(t, err)
	require.Equal(t, "file-secret", provider.Config.GetOauth2Config().ClientSecret)
	general, err := s.GetInstanceGeneralSetting(ctx)
	require.NoError(t, err)
	require.Equal(t, "Company", general.GetCustomProfile().GetTitle())
	requirePassword(t, s, "admin", "first-password")

	// Applying the same files again changes nothing.
	again, state := applyFor(t, loadDesired(t, instanceFiles("Company", "first-password", "1")), s)
	require.False(t, again.HasChanges())
	require.Equal(t, int64(1), state.Serial)

	// An edit outside the configuration is reverted as drift.
	_, err = s.UpsertInstanceSetting(ctx, generalSetting("Edited in the UI"))
	require.NoError(t, err)
	repaired, state := applyFor(t, loadDesired(t, instanceFiles("Company", "first-password", "1")), s)
	require.True(t, changeFor(t, repaired, "instance/settings/GENERAL").Drift)
	require.Equal(t, int64(2), state.Serial)
	general, err = s.GetInstanceGeneralSetting(ctx)
	require.NoError(t, err)
	require.Equal(t, "Company", general.GetCustomProfile().GetTitle())

	// A new password is sent only when writeOnlyVersion goes up.
	_, _ = applyFor(t, loadDesired(t, instanceFiles("Company", "second-password", "1")), s)
	requirePassword(t, s, "admin", "first-password")
	_, state = applyFor(t, loadDesired(t, instanceFiles("Company", "second-password", "2")), s)
	requirePassword(t, s, "admin", "second-password")
	for _, resource := range state.Resources {
		if resource.Name == "users/admin" {
			require.Equal(t, int32(2), resource.WriteOnlyVersion)
		}
	}
}

func TestApplyInvalidPlanWritesNothing(t *testing.T) {
	ctx := context.Background()
	s := newTestStore(t)
	desired := loadDesired(t, map[string]string{
		"general.json": `{"instanceSettings":[{"name":"instance/settings/GENERAL","generalSetting":{"disallowPasswordAuth":true}}]}`,
	})
	plan, state := applyFor(t, desired, s)
	require.False(t, plan.Valid())
	require.Nil(t, state)
	general, err := s.GetInstanceGeneralSetting(ctx)
	require.NoError(t, err)
	require.False(t, general.DisallowPasswordAuth)
	record, err := s.GetConfigurationState(ctx)
	require.NoError(t, err)
	require.Zero(t, record.Serial)
}

func TestApplyKeepsIgnoredFields(t *testing.T) {
	ctx := context.Background()
	s := newTestStore(t)
	_, err := s.UpsertInstanceSetting(ctx, generalSetting("Chosen in the UI"))
	require.NoError(t, err)

	desired := loadDesired(t, map[string]string{"general.json": `{"instanceSettings":[{"name":"instance/settings/GENERAL","generalSetting":{
		"disallowUserRegistration":true,"customProfile":{"title":"From the file"}}}],
		"lifecycle":[{"resource":"instance/settings/GENERAL","ignoreChanges":["generalSetting.customProfile"]}]}`})
	_, state := applyFor(t, desired, s)
	require.Equal(t, int64(1), state.Serial)
	general, err := s.GetInstanceGeneralSetting(ctx)
	require.NoError(t, err)
	require.True(t, general.DisallowUserRegistration, "managed fields are written")
	require.Equal(t, "Chosen in the UI", general.GetCustomProfile().GetTitle(), "ignored fields keep their stored value")
}

func TestApplyRemovals(t *testing.T) {
	ctx := context.Background()
	s := newTestStore(t)
	declared := map[string]string{
		"idp.json": `{"identityProviders":[` + validIDP + `]}`,
		"settings.json": `{"instanceSettings":[
			{"name":"instance/settings/ACCESS","accessSetting":{"accessMode":"INSTANCE_ACCESS_MODE_PUBLIC"}},
			{"name":"instance/settings/MEMO_RELATED","memoRelatedSetting":{"reactions":["👍"]}}]}`,
	}
	_, state := applyFor(t, loadDesired(t, declared), s)
	require.Len(t, state.Resources, 3)

	_, state = applyFor(t, loadDesired(t, map[string]string{"removed.json": `{"removed":[
		{"resource":"identity-providers/sso","destroy":true},
		{"resource":"instance/settings/ACCESS","destroy":true},
		{"resource":"instance/settings/MEMO_RELATED"}]}`}), s)
	require.Empty(t, state.Resources)

	providers, err := s.ListIdentityProviders(ctx, &store.FindIdentityProvider{})
	require.NoError(t, err)
	require.Empty(t, providers, "a destroyed provider is deleted")
	access, err := s.GetInstanceAccessSetting(ctx)
	require.NoError(t, err)
	require.Equal(t, storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PRIVATE, access.AccessMode, "a reset ACCESS is private")
	memoRelated, err := s.GetUncachedInstanceSetting(ctx, &store.FindInstanceSetting{Name: "MEMO_RELATED"})
	require.NoError(t, err)
	require.Equal(t, []string{"👍"}, memoRelated.GetMemoRelatedSetting().GetReactions(), "a released setting is left as it is")
}

func TestApplyLinkedIdentities(t *testing.T) {
	ctx := context.Background()
	s := newTestStore(t)
	files := func(subject string) map[string]string {
		return map[string]string{"all.json": `{
			"identityProviders":[` + validIDP + `],
			"users":[{"name":"users/admin","username":"admin","role":"ADMIN"}],
			"linkedIdentities":[{"name":"users/admin/linkedIdentities/sso","externalUid":"` + subject + `"}]}`}
	}
	linked := func() *store.UserIdentity {
		username := "admin"
		user, err := s.GetUser(ctx, &store.FindUser{Username: &username})
		require.NoError(t, err)
		require.NotNil(t, user)
		identity, err := s.GetUserIdentity(ctx, &store.FindUserIdentity{UserID: &user.ID, Provider: new("sso")})
		require.NoError(t, err)
		return identity
	}

	// The user and its link are created in one apply; without a declared
	// password the user gets one nobody knows, as SSO provisioning does.
	plan, state := applyFor(t, loadDesired(t, files("subject-1")), s)
	require.True(t, plan.Valid(), plan.Message.Errors)
	require.Len(t, state.Resources, 3)
	require.Equal(t, "subject-1", linked().ExternUID)
	username := "admin"
	admin, err := s.GetUser(ctx, &store.FindUser{Username: &username})
	require.NoError(t, err)
	require.NotEmpty(t, admin.PasswordHash)
	require.Error(t, bcrypt.CompareHashAndPassword([]byte(admin.PasswordHash), []byte("")))

	again, _ := applyFor(t, loadDesired(t, files("subject-1")), s)
	require.False(t, again.HasChanges(), "a second apply changes nothing")

	_, _ = applyFor(t, loadDesired(t, files("subject-2")), s)
	require.Equal(t, "subject-2", linked().ExternUID, "a changed subject replaces the link")

	_, state = applyFor(t, loadDesired(t, map[string]string{"all.json": `{
		"identityProviders":[` + validIDP + `],
		"users":[{"name":"users/admin","username":"admin","role":"ADMIN"}],
		"removed":[{"resource":"users/admin/linkedIdentities/sso","destroy":true}]}`}), s)
	require.Len(t, state.Resources, 2)
	require.Nil(t, linked(), "a destroyed link is deleted")
}

func TestApplyFailureRollsBack(t *testing.T) {
	ctx := context.Background()
	s := newTestStore(t)
	_, err := s.CreateUser(ctx, &store.User{Username: "root", Role: store.RoleAdmin, PasswordHash: "hash"})
	require.NoError(t, err)

	desired := loadDesired(t, map[string]string{
		"idp.json":   `{"identityProviders":[` + validIDP + `]}`,
		"users.json": `{"users":[{"name":"users/root","username":"root","role":"USER","password":"pw"}]}`,
	})
	_, _, err = Apply(ctx, desired, s, ApplyMetadata{Now: time.Now()})
	require.ErrorIs(t, err, store.ErrLastInstanceAdmin)

	providers, err := s.ListIdentityProviders(ctx, &store.FindIdentityProvider{})
	require.NoError(t, err)
	require.Empty(t, providers, "the provider written before the failure rolled back")
	record, err := s.GetConfigurationState(ctx)
	require.NoError(t, err)
	require.Zero(t, record.Serial)
}
