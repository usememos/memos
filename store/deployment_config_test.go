package store_test

import (
	"context"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"

	"github.com/usememos/memos/internal/profile"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/db/sqlite"
)

func TestLoadDeploymentConfigurationPublishesRuntimeOnlyIdentityProvider(t *testing.T) {
	ctx := context.Background()
	stores := newDeploymentConfigurationTestStore(t)
	dir := t.TempDir()
	writeDeploymentIdentityProvider(t, filepath.Join(dir, "memos-idp-primary.json"), "primary-sso", "File SSO", "file-secret")

	require.NoError(t, stores.LoadDeploymentConfigurationDir(ctx, dir))

	effective, err := stores.GetIdentityProvider(ctx, &store.FindIdentityProvider{UID: ptr("primary-sso")})
	require.NoError(t, err)
	require.NotNil(t, effective)
	assert.Zero(t, effective.Id)
	assert.Equal(t, "File SSO", effective.Name)
	assert.Equal(t, "file-secret", effective.Config.GetOauth2Config().ClientSecret)
	assert.True(t, stores.IsIdentityProviderDeploymentConfigured("primary-sso"))

	stored, err := stores.GetStoredIdentityProvider(ctx, &store.FindIdentityProvider{UID: ptr("primary-sso")})
	require.NoError(t, err)
	assert.Nil(t, stored)
}

func TestLoadDeploymentConfigurationShadowsWithoutChangingStoredResources(t *testing.T) {
	ctx := context.Background()
	stores := newDeploymentConfigurationTestStore(t)
	stored, err := stores.CreateIdentityProvider(ctx, deploymentIdentityProvider("primary-sso", "Stored SSO", "stored-secret"))
	require.NoError(t, err)
	storedID := stored.Id
	_, err = stores.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_GENERAL,
		Value: &storepb.InstanceSetting_GeneralSetting{GeneralSetting: &storepb.InstanceGeneralSetting{
			WeekStartDayOffset: 1,
		}},
	})
	require.NoError(t, err)

	dir := t.TempDir()
	writeDeploymentIdentityProvider(t, filepath.Join(dir, "memos-idp-primary.json"), "primary-sso", "File SSO", "file-secret")
	writeDeploymentGeneralSetting(t, filepath.Join(dir, "memos-instance-setting-general.json"), 4, true)
	require.NoError(t, stores.LoadDeploymentConfigurationDir(ctx, dir))

	effectiveProvider, err := stores.GetIdentityProvider(ctx, &store.FindIdentityProvider{UID: ptr("primary-sso")})
	require.NoError(t, err)
	assert.Equal(t, "File SSO", effectiveProvider.Name)
	storedProvider, err := stores.GetStoredIdentityProvider(ctx, &store.FindIdentityProvider{UID: ptr("primary-sso")})
	require.NoError(t, err)
	assert.Equal(t, storedID, storedProvider.Id)
	assert.Equal(t, "Stored SSO", storedProvider.Name)

	effectiveGeneral, err := stores.GetInstanceGeneralSetting(ctx)
	require.NoError(t, err)
	assert.Equal(t, int32(4), effectiveGeneral.WeekStartDayOffset)
	assert.True(t, effectiveGeneral.DisallowPasswordAuth)
	rawGeneral, err := stores.GetStoredInstanceSetting(ctx, &store.FindInstanceSetting{Name: storepb.InstanceSettingKey_GENERAL.String()})
	require.NoError(t, err)
	require.NotNil(t, rawGeneral)
	assert.Equal(t, int32(1), rawGeneral.GetGeneralSetting().WeekStartDayOffset)
}

func TestLoadDeploymentConfigurationReturnsDefensiveClones(t *testing.T) {
	ctx := context.Background()
	stores := newDeploymentConfigurationTestStore(t)
	dir := t.TempDir()
	writeDeploymentIdentityProvider(t, filepath.Join(dir, "memos-idp-primary.json"), "primary-sso", "File SSO", "file-secret")
	writeDeploymentGeneralSetting(t, filepath.Join(dir, "memos-instance-setting-general.json"), 2, false)
	require.NoError(t, stores.LoadDeploymentConfigurationDir(ctx, dir))

	provider, err := stores.GetIdentityProvider(ctx, &store.FindIdentityProvider{UID: ptr("primary-sso")})
	require.NoError(t, err)
	provider.Name = "Mutated"
	provider.Config.GetOauth2Config().ClientSecret = "mutated-secret"
	providerAgain, err := stores.GetIdentityProvider(ctx, &store.FindIdentityProvider{UID: ptr("primary-sso")})
	require.NoError(t, err)
	assert.Equal(t, "File SSO", providerAgain.Name)
	assert.Equal(t, "file-secret", providerAgain.Config.GetOauth2Config().ClientSecret)

	general, err := stores.GetInstanceGeneralSetting(ctx)
	require.NoError(t, err)
	general.WeekStartDayOffset = 6
	generalAgain, err := stores.GetInstanceGeneralSetting(ctx)
	require.NoError(t, err)
	assert.Equal(t, int32(2), generalAgain.WeekStartDayOffset)
}

func TestLoadDeploymentConfigurationPublishesAtomically(t *testing.T) {
	ctx := context.Background()
	stores := newDeploymentConfigurationTestStore(t)
	validDir := t.TempDir()
	writeDeploymentIdentityProvider(t, filepath.Join(validDir, "memos-idp-primary.json"), "primary-sso", "File SSO", "file-secret")
	require.NoError(t, stores.LoadDeploymentConfigurationDir(ctx, validDir))

	invalidDir := t.TempDir()
	writeDeploymentIdentityProvider(t, filepath.Join(invalidDir, "memos-idp-primary.json"), "primary-sso", "Changed SSO", "changed-secret")
	require.NoError(t, os.WriteFile(filepath.Join(invalidDir, "memos-instance-setting-invalid.json"), []byte(`{"key":"GENERAL","unknown":true}`), 0600))
	err := stores.LoadDeploymentConfigurationDir(ctx, invalidDir)
	require.Error(t, err)
	assert.ErrorContains(t, err, `unknown field "unknown"`)

	provider, getErr := stores.GetIdentityProvider(ctx, &store.FindIdentityProvider{UID: ptr("primary-sso")})
	require.NoError(t, getErr)
	assert.Equal(t, "File SSO", provider.Name)
}

func TestLoadDeploymentConfigurationRejectsDuplicateResources(t *testing.T) {
	stores := newDeploymentConfigurationTestStore(t)
	dir := t.TempDir()
	writeDeploymentIdentityProvider(t, filepath.Join(dir, "memos-idp-first.json"), "primary-sso", "First", "first-secret")
	writeDeploymentIdentityProvider(t, filepath.Join(dir, "memos-idp-second.json"), "primary-sso", "Second", "second-secret")

	err := stores.LoadDeploymentConfigurationDir(context.Background(), dir)
	require.Error(t, err)
	assert.ErrorContains(t, err, `identity provider UID "primary-sso" is declared by both`)
}

func TestLoadDeploymentConfigurationValidatesAffectedAuthState(t *testing.T) {
	ctx := context.Background()

	t.Run("managed GENERAL cannot disable regular password auth without SSO", func(t *testing.T) {
		stores := newDeploymentConfigurationTestStore(t)
		dir := t.TempDir()
		writeDeploymentGeneralSetting(t, filepath.Join(dir, "memos-instance-setting-general.json"), 0, true)
		err := stores.LoadDeploymentConfigurationDir(ctx, dir)
		require.Error(t, err)
		assert.ErrorContains(t, err, "has no effective identity provider")
	})

	t.Run("unrelated file does not reject unmanaged legacy state", func(t *testing.T) {
		stores := newDeploymentConfigurationTestStore(t)
		_, err := stores.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
			Key: storepb.InstanceSettingKey_GENERAL,
			Value: &storepb.InstanceSetting_GeneralSetting{GeneralSetting: &storepb.InstanceGeneralSetting{
				DisallowPasswordAuth: true,
			}},
		})
		require.NoError(t, err)
		dir := t.TempDir()
		require.NoError(t, os.WriteFile(filepath.Join(dir, "memos-instance-setting-storage.json"), []byte(`{
  "key": "STORAGE",
  "storageSetting": {"storageType": "LOCAL"}
}`), 0600))
		require.NoError(t, stores.LoadDeploymentConfigurationDir(ctx, dir))
	})
}

func TestLoadDeploymentConfigurationIgnoresUnrelatedFilesAndMissingDirectory(t *testing.T) {
	ctx := context.Background()
	stores := newDeploymentConfigurationTestStore(t)
	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, ".env"), []byte("DATABASE_PASSWORD=secret"), 0600))
	require.NoError(t, stores.LoadDeploymentConfigurationDir(ctx, dir))
	require.NoError(t, stores.LoadDeploymentConfigurationDir(ctx, filepath.Join(t.TempDir(), "missing")))
}

func TestLoadDeploymentConfigurationSupportsLegacyIdentityProviderFilenames(t *testing.T) {
	ctx := context.Background()
	stores := newDeploymentConfigurationTestStore(t)
	dir := t.TempDir()
	writeDeploymentIdentityProvider(t, filepath.Join(dir, "memos-idp-Primary_SSO.json"), "primary-sso", "Primary", "secret")

	require.NoError(t, stores.LoadDeploymentConfigurationDir(ctx, dir))
	assert.True(t, stores.IsIdentityProviderDeploymentConfigured("primary-sso"))

	invalidDir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(invalidDir, "memos-idp-Bad.json"), []byte("not-json"), 0600))
	require.Error(t, stores.LoadDeploymentConfigurationDir(ctx, invalidDir))
}

func TestLoadDeploymentConfigurationAcceptsSaturdayWeekStart(t *testing.T) {
	stores := newDeploymentConfigurationTestStore(t)
	dir := t.TempDir()
	writeDeploymentGeneralSetting(t, filepath.Join(dir, "memos-instance-setting-general.json"), -1, false)
	require.NoError(t, stores.LoadDeploymentConfigurationDir(context.Background(), dir))

	general, err := stores.GetInstanceGeneralSetting(context.Background())
	require.NoError(t, err)
	assert.Equal(t, int32(-1), general.WeekStartDayOffset)
}

func TestLoadDeploymentConfigurationAcceptsRegularFileSymlink(t *testing.T) {
	ctx := context.Background()
	stores := newDeploymentConfigurationTestStore(t)
	dir := t.TempDir()
	target := filepath.Join(t.TempDir(), "provider.json")
	writeDeploymentIdentityProvider(t, target, "primary-sso", "Primary", "secret")
	require.NoError(t, os.Symlink(target, filepath.Join(dir, "memos-idp-primary.json")))
	require.NoError(t, stores.LoadDeploymentConfigurationDir(ctx, dir))
	assert.True(t, stores.IsIdentityProviderDeploymentConfigured("primary-sso"))
}

func TestLoadDeploymentConfigurationSupportsEveryProvisionableSettingGroup(t *testing.T) {
	ctx := context.Background()
	stores := newDeploymentConfigurationTestStore(t)
	dir := t.TempDir()
	settings := map[string]*storepb.InstanceSetting{
		"memos-instance-setting-general.json": {
			Key:   storepb.InstanceSettingKey_GENERAL,
			Value: &storepb.InstanceSetting_GeneralSetting{GeneralSetting: &storepb.InstanceGeneralSetting{WeekStartDayOffset: 1}},
		},
		"memos-instance-setting-storage.json": {
			Key:   storepb.InstanceSettingKey_STORAGE,
			Value: &storepb.InstanceSetting_StorageSetting{StorageSetting: &storepb.InstanceStorageSetting{StorageType: storepb.InstanceStorageSetting_LOCAL}},
		},
		"memos-instance-setting-memo-related.json": {
			Key: storepb.InstanceSettingKey_MEMO_RELATED,
			Value: &storepb.InstanceSetting_MemoRelatedSetting{MemoRelatedSetting: &storepb.InstanceMemoRelatedSetting{
				ContentLengthLimit: store.DefaultContentLengthLimit,
				Reactions:          []string{"👍"},
			}},
		},
		"memos-instance-setting-notification.json": {
			Key:   storepb.InstanceSettingKey_NOTIFICATION,
			Value: &storepb.InstanceSetting_NotificationSetting{NotificationSetting: &storepb.InstanceNotificationSetting{}},
		},
		"memos-instance-setting-ai.json": {
			Key: storepb.InstanceSettingKey_AI,
			Value: &storepb.InstanceSetting_AiSetting{AiSetting: &storepb.InstanceAISetting{Providers: []*storepb.AIProviderConfig{
				{Id: "primary", Title: "Primary", Type: storepb.AIProviderType_OPENAI, ApiKey: "ai-secret"},
			}}},
		},
	}
	for filename, setting := range settings {
		writeDeploymentMessage(t, filepath.Join(dir, filename), setting)
	}
	require.NoError(t, stores.LoadDeploymentConfigurationDir(ctx, dir))
	for _, setting := range settings {
		assert.True(t, stores.IsInstanceSettingDeploymentConfigured(setting.Key))
	}
	ai, err := stores.GetInstanceAISetting(ctx)
	require.NoError(t, err)
	require.Len(t, ai.Providers, 1)
	assert.Equal(t, "https://api.openai.com/v1", ai.Providers[0].Endpoint)
}

func TestLoadDeploymentConfigurationRejectsInvalidSettingResources(t *testing.T) {
	tests := []struct {
		name        string
		content     string
		errorString string
	}{
		{name: "BASIC", content: `{"key":"BASIC","basicSetting":{}}`, errorString: "cannot be deployment configured"},
		{name: "TAGS", content: `{"key":"TAGS","tagsSetting":{}}`, errorString: "cannot be deployment configured"},
		{name: "mismatched oneof", content: `{"key":"GENERAL","storageSetting":{}}`, errorString: "generalSetting must be populated"},
		{name: "invalid week start", content: `{"key":"GENERAL","generalSetting":{"weekStartDayOffset":-2}}`, errorString: "must be between -1 and 6"},
		{name: "unknown field", content: `{"key":"GENERAL","generalSetting":{},"typo":true}`, errorString: `unknown field "typo"`},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			stores := newDeploymentConfigurationTestStore(t)
			dir := t.TempDir()
			require.NoError(t, os.WriteFile(filepath.Join(dir, "memos-instance-setting-invalid.json"), []byte(test.content), 0600))
			err := stores.LoadDeploymentConfigurationDir(context.Background(), dir)
			require.Error(t, err)
			assert.ErrorContains(t, err, test.errorString)
		})
	}
}

func TestLoadDeploymentConfigurationBoundsFilesAndRedactsDecodeErrors(t *testing.T) {
	t.Run("oversized file", func(t *testing.T) {
		stores := newDeploymentConfigurationTestStore(t)
		dir := t.TempDir()
		require.NoError(t, os.WriteFile(filepath.Join(dir, "memos-idp-oversized.json"), []byte(strings.Repeat("x", (1<<20)+1)), 0600))
		err := stores.LoadDeploymentConfigurationDir(context.Background(), dir)
		require.Error(t, err)
		assert.ErrorContains(t, err, "exceeds 1048576 bytes")
	})

	t.Run("secret value is not included in a type error", func(t *testing.T) {
		stores := newDeploymentConfigurationTestStore(t)
		dir := t.TempDir()
		content := `{
  "uid":"primary-sso",
  "name":"Primary",
  "type":"OAUTH2",
  "config":{"oauth2Config":{"clientSecret":{"value":"must-not-appear"}}}
}`
		require.NoError(t, os.WriteFile(filepath.Join(dir, "memos-idp-primary.json"), []byte(content), 0600))
		err := stores.LoadDeploymentConfigurationDir(context.Background(), dir)
		require.Error(t, err)
		assert.NotContains(t, err.Error(), "must-not-appear")
	})
}

func TestAuthenticationConfigurationMutationsAreSafe(t *testing.T) {
	ctx := context.Background()

	t.Run("rejects disabling regular password auth without an IdP", func(t *testing.T) {
		stores := newDeploymentConfigurationTestStore(t)
		_, err := stores.UpsertInstanceGeneralSettingSafely(ctx, &storepb.InstanceSetting{
			Key: storepb.InstanceSettingKey_GENERAL,
			Value: &storepb.InstanceSetting_GeneralSetting{GeneralSetting: &storepb.InstanceGeneralSetting{
				DisallowPasswordAuth: true,
			}},
		})
		require.ErrorIs(t, err, store.ErrUnsafeAuthenticationConfiguration)
		stored, getErr := stores.GetStoredInstanceSetting(ctx, &store.FindInstanceSetting{Name: storepb.InstanceSettingKey_GENERAL.String()})
		require.NoError(t, getErr)
		assert.Nil(t, stored)
	})

	t.Run("rejects deleting the last effective IdP", func(t *testing.T) {
		stores := newDeploymentConfigurationTestStore(t)
		provider, err := stores.CreateIdentityProvider(ctx, deploymentIdentityProvider("primary-sso", "Primary", "secret"))
		require.NoError(t, err)
		_, err = stores.UpsertInstanceGeneralSettingSafely(ctx, &storepb.InstanceSetting{
			Key: storepb.InstanceSettingKey_GENERAL,
			Value: &storepb.InstanceSetting_GeneralSetting{GeneralSetting: &storepb.InstanceGeneralSetting{
				DisallowPasswordAuth: true,
			}},
		})
		require.NoError(t, err)
		err = stores.DeleteIdentityProviderSafely(ctx, &store.DeleteIdentityProvider{ID: provider.Id})
		require.ErrorIs(t, err, store.ErrUnsafeAuthenticationConfiguration)
		stored, getErr := stores.GetStoredIdentityProvider(ctx, &store.FindIdentityProvider{ID: &provider.Id})
		require.NoError(t, getErr)
		assert.NotNil(t, stored)
	})

	t.Run("file-backed IdP satisfies the invariant", func(t *testing.T) {
		stores := newDeploymentConfigurationTestStore(t)
		dir := t.TempDir()
		writeDeploymentIdentityProvider(t, filepath.Join(dir, "memos-idp-primary.json"), "primary-sso", "Primary", "secret")
		require.NoError(t, stores.LoadDeploymentConfigurationDir(ctx, dir))
		_, err := stores.UpsertInstanceGeneralSettingSafely(ctx, &storepb.InstanceSetting{
			Key: storepb.InstanceSettingKey_GENERAL,
			Value: &storepb.InstanceSetting_GeneralSetting{GeneralSetting: &storepb.InstanceGeneralSetting{
				DisallowPasswordAuth: true,
			}},
		})
		require.NoError(t, err)
	})

	t.Run("allows unrelated edits to an existing unsafe GENERAL state", func(t *testing.T) {
		stores := newDeploymentConfigurationTestStore(t)
		_, err := stores.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
			Key: storepb.InstanceSettingKey_GENERAL,
			Value: &storepb.InstanceSetting_GeneralSetting{GeneralSetting: &storepb.InstanceGeneralSetting{
				DisallowPasswordAuth: true,
			}},
		})
		require.NoError(t, err)

		_, err = stores.UpsertInstanceGeneralSettingSafely(ctx, &storepb.InstanceSetting{
			Key: storepb.InstanceSettingKey_GENERAL,
			Value: &storepb.InstanceSetting_GeneralSetting{GeneralSetting: &storepb.InstanceGeneralSetting{
				DisallowPasswordAuth: true,
				WeekStartDayOffset:   1,
			}},
		})
		require.NoError(t, err)
	})

	t.Run("rejects making the stored fallback unsafe under deployment GENERAL", func(t *testing.T) {
		stores := newDeploymentConfigurationTestStore(t)
		dir := t.TempDir()
		writeDeploymentGeneralSetting(t, filepath.Join(dir, "memos-instance-setting-general.json"), 0, false)
		require.NoError(t, stores.LoadDeploymentConfigurationDir(ctx, dir))

		_, err := stores.UpsertInstanceGeneralSettingSafely(ctx, &storepb.InstanceSetting{
			Key: storepb.InstanceSettingKey_GENERAL,
			Value: &storepb.InstanceSetting_GeneralSetting{GeneralSetting: &storepb.InstanceGeneralSetting{
				DisallowPasswordAuth: true,
			}},
		})
		require.ErrorIs(t, err, store.ErrUnsafeAuthenticationConfiguration)
	})
}

func TestListIdentityProvidersPreservesStoredOrder(t *testing.T) {
	ctx := context.Background()
	stores := newDeploymentConfigurationTestStore(t)
	_, err := stores.CreateIdentityProvider(ctx, deploymentIdentityProvider("zeta-sso", "Stored Zeta", "stored-secret"))
	require.NoError(t, err)
	_, err = stores.CreateIdentityProvider(ctx, deploymentIdentityProvider("alpha-test", "Stored Alpha", "stored-secret"))
	require.NoError(t, err)

	dir := t.TempDir()
	writeDeploymentIdentityProvider(t, filepath.Join(dir, "memos-idp-zeta.json"), "zeta-sso", "File Zeta", "file-secret")
	writeDeploymentIdentityProvider(t, filepath.Join(dir, "memos-idp-beta.json"), "beta-file", "File Beta", "file-secret")
	require.NoError(t, stores.LoadDeploymentConfigurationDir(ctx, dir))

	providers, err := stores.ListIdentityProviders(ctx, &store.FindIdentityProvider{})
	require.NoError(t, err)
	require.Len(t, providers, 3)
	assert.Equal(t, []string{"zeta-sso", "alpha-test", "beta-file"}, []string{providers[0].Uid, providers[1].Uid, providers[2].Uid})
	assert.Equal(t, "File Zeta", providers[0].Name)
}

func newDeploymentConfigurationTestStore(t *testing.T) *store.Store {
	t.Helper()
	p := &profile.Profile{
		Data:   t.TempDir(),
		Driver: "sqlite",
		DSN:    filepath.Join(t.TempDir(), "deployment.db"),
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

func deploymentIdentityProvider(uid, title, secret string) *storepb.IdentityProvider {
	return &storepb.IdentityProvider{
		Uid:  uid,
		Name: title,
		Type: storepb.IdentityProvider_OAUTH2,
		Config: &storepb.IdentityProviderConfig{Config: &storepb.IdentityProviderConfig_Oauth2Config{Oauth2Config: &storepb.OAuth2Config{
			ClientId:     "client-id",
			ClientSecret: secret,
			AuthUrl:      "https://example.com/authorize",
			TokenUrl:     "https://example.com/token",
			UserInfoUrl:  "https://example.com/userinfo",
			Scopes:       []string{"profile", "email"},
			FieldMapping: &storepb.FieldMapping{Identifier: "sub"},
		}}},
	}
}

func writeDeploymentIdentityProvider(t *testing.T, path, uid, title, secret string) {
	t.Helper()
	content := `{
  "uid": "` + uid + `",
  "name": "` + title + `",
  "type": "OAUTH2",
  "config": {
    "oauth2Config": {
      "clientId": "client-id",
      "clientSecret": "` + secret + `",
      "authUrl": "https://example.com/authorize",
      "tokenUrl": "https://example.com/token",
      "userInfoUrl": "https://example.com/userinfo",
      "scopes": ["profile", "email"],
      "fieldMapping": {"identifier": "sub"}
    }
  }
}`
	require.False(t, strings.Contains(uid+title+secret, `"`))
	require.NoError(t, os.WriteFile(path, []byte(content), 0600))
}

func writeDeploymentGeneralSetting(t *testing.T, path string, weekStart int32, disallowPasswordAuth bool) {
	t.Helper()
	content := `{
  "key": "GENERAL",
  "generalSetting": {
    "weekStartDayOffset": ` + assertInt32(weekStart) + `,
    "disallowPasswordAuth": ` + assertBool(disallowPasswordAuth) + `
  }
}`
	require.NoError(t, os.WriteFile(path, []byte(content), 0600))
}

func writeDeploymentMessage(t *testing.T, path string, message proto.Message) {
	t.Helper()
	content, err := (protojson.MarshalOptions{Indent: "  "}).Marshal(message)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(path, content, 0600))
}

func assertInt32(value int32) string {
	return strconv.FormatInt(int64(value), 10)
}

func assertBool(value bool) string {
	if value {
		return "true"
	}
	return "false"
}

func ptr[T any](value T) *T {
	return &value
}
