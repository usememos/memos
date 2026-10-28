package configuration

import (
	"bytes"
	"context"
	"slices"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoregistry"

	"github.com/usememos/memos/core/identityprovider"
	"github.com/usememos/memos/core/instancesetting"
	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// fakeReader is an in-memory instance for planning.
type fakeReader struct {
	state     *storepb.InstanceConfigurationState
	providers []*storepb.IdentityProvider
	settings  map[storepb.InstanceSettingKey]*storepb.InstanceSetting
	users     []*store.User
}

func newFakeReader() *fakeReader {
	return &fakeReader{state: &storepb.InstanceConfigurationState{}, settings: map[storepb.InstanceSettingKey]*storepb.InstanceSetting{}}
}

func (f *fakeReader) GetConfigurationState(context.Context) (*storepb.InstanceConfigurationState, error) {
	return proto.CloneOf(f.state), nil
}

func (f *fakeReader) ListIdentityProviders(context.Context, *store.FindIdentityProvider) ([]*storepb.IdentityProvider, error) {
	result := []*storepb.IdentityProvider{}
	for _, provider := range f.providers {
		result = append(result, proto.CloneOf(provider))
	}
	return result, nil
}

func (f *fakeReader) GetUncachedInstanceSetting(_ context.Context, find *store.FindInstanceSetting) (*storepb.InstanceSetting, error) {
	setting := f.settings[storepb.InstanceSettingKey(storepb.InstanceSettingKey_value[find.Name])]
	if setting == nil {
		return nil, nil
	}
	return proto.CloneOf(setting), nil
}

func (f *fakeReader) ListUsers(_ context.Context, find *store.FindUser) ([]*store.User, error) {
	result := []*store.User{}
	for _, user := range f.users {
		if find.Username != nil && user.Username != *find.Username ||
			len(find.UsernameList) > 0 && !slices.Contains(find.UsernameList, user.Username) ||
			len(find.IDList) > 0 && !slices.Contains(find.IDList, user.ID) {
			continue
		}
		copied := *user
		result = append(result, &copied)
	}
	return result, nil
}

// apply stands in for apply: the instance takes the declared values and the
// state record becomes the plan's.
func (f *fakeReader) apply(t *testing.T, desired *Desired, plan *Plan) {
	t.Helper()
	require.True(t, plan.Valid(), plan.Message.Errors)
	f.providers = nil
	for i, provider := range desired.Configuration.IdentityProviders {
		stored := identityprovider.ToStore(provider)
		stored.Id = int32(i + 1)
		f.providers = append(f.providers, stored)
	}
	for _, setting := range desired.Configuration.InstanceSettings {
		stored := instancesetting.ToStore(setting)
		instancesetting.Normalize(stored)
		f.settings[stored.Key] = stored
	}
	next := proto.CloneOf(plan.next)
	next.Serial = f.state.Serial + 1
	f.state = next
}

func loadDesired(t *testing.T, files map[string]string) *Desired {
	t.Helper()
	desired, err := Load(writeFiles(t, files), placeholderResolver())
	require.NoError(t, err)
	return desired
}

func planFor(t *testing.T, desired *Desired, reader Reader) *Plan {
	t.Helper()
	result, err := ComputePlan(context.Background(), desired, reader)
	require.NoError(t, err)
	return result
}

func changeFor(t *testing.T, plan *Plan, resource string) *apipb.ResourceChange {
	t.Helper()
	for _, change := range plan.Message.ResourceChanges {
		if change.Resource == resource {
			return change
		}
	}
	require.Failf(t, "no change", "plan has no change for %s", resource)
	return nil
}

func generalSetting(title string) *storepb.InstanceSetting {
	return &storepb.InstanceSetting{Key: storepb.InstanceSettingKey_GENERAL, Value: &storepb.InstanceSetting_GeneralSetting{
		GeneralSetting: &storepb.InstanceGeneralSetting{CustomProfile: &storepb.InstanceCustomProfile{Title: title}},
	}}
}

func generalDocument(title string) string {
	return `{"instanceSettings":[{"name":"instance/settings/GENERAL","generalSetting":{"customProfile":{"title":"` + title + `"}}}]}`
}

func TestPlanCreateAdoptNoOpAndDrift(t *testing.T) {
	reader := newFakeReader()
	reader.settings[storepb.InstanceSettingKey_GENERAL] = generalSetting("memos")
	desired := loadDesired(t, map[string]string{"idp.json": `{"identityProviders":[` + validIDP + `]}`, "general.json": generalDocument("Company")})

	first := planFor(t, desired, reader)
	require.True(t, first.Valid())
	require.True(t, first.HasChanges())
	require.Equal(t, apipb.ResourceChange_CREATE, changeFor(t, first, "identity-providers/sso").Action)
	general := changeFor(t, first, "instance/settings/GENERAL")
	require.Equal(t, apipb.ResourceChange_ADOPT, general.Action)
	require.Equal(t, "general.json", general.Source)
	require.Equal(t, []*apipb.FieldChange{{Path: "generalSetting.customProfile.title", Before: `"memos"`, After: `"Company"`}}, general.FieldChanges)

	reader.apply(t, desired, first)
	second := planFor(t, desired, reader)
	require.False(t, second.HasChanges(), "a second plan after apply is empty")
	for _, change := range second.Message.ResourceChanges {
		require.Equal(t, apipb.ResourceChange_NO_OP, change.Action, change.Resource)
	}

	// An edit outside the configuration is drift.
	reader.settings[storepb.InstanceSettingKey_GENERAL] = generalSetting("Edited in the UI")
	drifted := changeFor(t, planFor(t, desired, reader), "instance/settings/GENERAL")
	require.Equal(t, apipb.ResourceChange_UPDATE, drifted.Action)
	require.True(t, drifted.Drift)

	// A changed file is an update, not drift.
	changed := loadDesired(t, map[string]string{"idp.json": `{"identityProviders":[` + validIDP + `]}`, "general.json": generalDocument("Renamed")})
	updated := changeFor(t, planFor(t, changed, reader), "instance/settings/GENERAL")
	require.Equal(t, apipb.ResourceChange_UPDATE, updated.Action)
	require.False(t, updated.Drift)

	// A managed resource deleted outside the configuration is recreated, as drift.
	reader.providers = nil
	recreated := changeFor(t, planFor(t, desired, reader), "identity-providers/sso")
	require.Equal(t, apipb.ResourceChange_CREATE, recreated.Action)
	require.True(t, recreated.Drift)
}

func TestPlanComparesNormalizedValues(t *testing.T) {
	reader := newFakeReader()
	reader.settings[storepb.InstanceSettingKey_AI] = &storepb.InstanceSetting{Key: storepb.InstanceSettingKey_AI, Value: &storepb.InstanceSetting_AiSetting{
		AiSetting: &storepb.InstanceAISetting{Providers: []*storepb.AIProviderConfig{
			{Id: "openai", Title: "OpenAI", Type: storepb.AIProviderType_OPENAI, Endpoint: instancesetting.DefaultOpenAIEndpoint, ApiKey: "placeholder"},
		}},
	}}
	storage := &storepb.InstanceStorageSetting{StorageType: storepb.InstanceStorageSetting_LOCAL}
	store.NormalizeInstanceStorageSetting(storage)
	reader.settings[storepb.InstanceSettingKey_STORAGE] = &storepb.InstanceSetting{Key: storepb.InstanceSettingKey_STORAGE, Value: &storepb.InstanceSetting_StorageSetting{StorageSetting: storage}}

	desired := loadDesired(t, map[string]string{"settings.json": `{"instanceSettings":[
		{"name":"instance/settings/AI","aiSetting":{"providers":[{"id":"openai","title":"OpenAI","type":"OPENAI","apiKey":"${env:KEY}"}]}},
		{"name":"instance/settings/STORAGE","storageSetting":{"storageType":"LOCAL"}}
	]}`})
	for _, change := range planFor(t, desired, reader).Message.ResourceChanges {
		require.Equal(t, apipb.ResourceChange_ADOPT, change.Action, change.Resource)
		require.Empty(t, change.FieldChanges, "a default endpoint and a normalized storage registry are not differences: %s", change.Resource)
	}
}

func TestPlanNeverPrintsSecrets(t *testing.T) {
	reader := newFakeReader()
	stored := identityprovider.ToStore(loadDesired(t, map[string]string{"idp.json": `{"identityProviders":[` + validIDP + `]}`}).Configuration.IdentityProviders[0])
	stored.Config.GetOauth2Config().ClientSecret = "old-client-secret"
	reader.providers = []*storepb.IdentityProvider{stored}

	withSecret := strings.Replace(validIDP, `"clientId":"memos",`, `"clientId":"memos","clientSecret":"new-client-secret",`, 1)
	result := planFor(t, loadDesired(t, map[string]string{"idp.json": `{"identityProviders":[` + withSecret + `]}`}), reader)
	change := changeFor(t, result, "identity-providers/sso")
	require.Equal(t, []*apipb.FieldChange{{Path: "config.oauth2Config.clientSecret", Before: "(sensitive)", After: "(sensitive)"}}, change.FieldChanges)

	var text bytes.Buffer
	RenderPlan(&text, result.Message)
	encoded, err := protojson.Marshal(result.Message)
	require.NoError(t, err)
	for _, output := range []string{text.String(), string(encoded), result.next.String()} {
		require.NotContains(t, output, "old-client-secret")
		require.NotContains(t, output, "new-client-secret")
	}
}

func TestPlanIgnoreChanges(t *testing.T) {
	reader := newFakeReader()
	reader.settings[storepb.InstanceSettingKey_GENERAL] = generalSetting("Edited in the UI")
	desired := loadDesired(t, map[string]string{"general.json": `{"instanceSettings":[{"name":"instance/settings/GENERAL","generalSetting":{"customProfile":{"title":"Company"}}}],
		"lifecycle":[{"resource":"instance/settings/GENERAL","ignoreChanges":["generalSetting.customProfile"]}]}`})
	result := planFor(t, desired, reader)
	change := changeFor(t, result, "instance/settings/GENERAL")
	require.Empty(t, change.FieldChanges)
	require.Equal(t, []string{"generalSetting.customProfile"}, result.next.Resources[0].IgnoredFields)
	require.Equal(t, []string{"*"}, result.next.Resources[0].ManagedFields)
}

func TestPlanUndeclaredManagedResources(t *testing.T) {
	reader := newFakeReader()
	managed := func(name, kind string) *storepb.InstanceConfigurationState_ManagedResource {
		return &storepb.InstanceConfigurationState_ManagedResource{Name: name, Kind: kind, ManagedFields: []string{"*"}}
	}
	locked := managed("identity-providers/locked", "IdentityProvider")
	locked.PreventDestroy = true
	reader.state = &storepb.InstanceConfigurationState{Serial: 4, Resources: []*storepb.InstanceConfigurationState_ManagedResource{
		managed("identity-providers/destroyed", "IdentityProvider"),
		managed("identity-providers/vanished", "IdentityProvider"),
		locked,
		managed("identity-providers/forgotten", "IdentityProvider"),
		managed("instance/settings/MEMO_RELATED", "InstanceSetting"),
		managed("users/old", "User"),
		managed("users/kept", "User"),
	}}
	reader.providers = []*storepb.IdentityProvider{{Id: 1, Uid: "destroyed"}, {Id: 2, Uid: "locked"}, {Id: 3, Uid: "forgotten"}}
	reader.users = []*store.User{{ID: 1, Username: "old"}, {ID: 2, Username: "kept"}}

	desired := loadDesired(t, map[string]string{"removed.json": `{"removed":[
		{"resource":"identity-providers/destroyed","destroy":true},
		{"resource":"identity-providers/vanished","destroy":true},
		{"resource":"identity-providers/locked","destroy":true},
		{"resource":"instance/settings/MEMO_RELATED","destroy":true},
		{"resource":"users/old","destroy":true},
		{"resource":"users/kept"},
		{"resource":"users/never-managed","destroy":true}
	]}`})
	result := planFor(t, desired, reader)
	want := map[string]apipb.ResourceChange_Action{
		"identity-providers/destroyed":   apipb.ResourceChange_DESTROY,
		"identity-providers/vanished":    apipb.ResourceChange_RELEASE,
		"identity-providers/locked":      apipb.ResourceChange_ERROR,
		"identity-providers/forgotten":   apipb.ResourceChange_ERROR,
		"instance/settings/MEMO_RELATED": apipb.ResourceChange_RESET,
		"users/old":                      apipb.ResourceChange_ERROR,
		"users/kept":                     apipb.ResourceChange_RELEASE,
	}
	require.Len(t, result.Message.ResourceChanges, len(want), "a removed entry for a resource never managed is a no-op")
	for resource, action := range want {
		require.Equal(t, action, changeFor(t, result, resource).Action, resource)
	}
	require.False(t, result.Valid())
	require.Len(t, result.Message.Errors, 3)
	require.Contains(t, strings.Join(result.Message.Errors, "\n"), "users/old: configuration cannot delete a user")
	require.Contains(t, strings.Join(result.Message.Errors, "\n"), "identity-providers/forgotten: managed but no longer declared")
	require.Contains(t, strings.Join(result.Message.Errors, "\n"), "identity-providers/locked: preventDestroy was set")
	require.Equal(t, int64(4), result.Message.Serial)
}

func TestPlanOrdersActions(t *testing.T) {
	reader := newFakeReader()
	reader.state = &storepb.InstanceConfigurationState{Resources: []*storepb.InstanceConfigurationState_ManagedResource{
		{Name: "identity-providers/old", Kind: "IdentityProvider"},
	}}
	reader.providers = []*storepb.IdentityProvider{{Id: 1, Uid: "old"}}
	desired := loadDesired(t, map[string]string{"all.json": `{
		"identityProviders":[` + validIDP + `],
		"instanceSettings":[{"name":"instance/settings/ACCESS","accessSetting":{"accessMode":"INSTANCE_ACCESS_MODE_PRIVATE"}}],
		"users":[{"name":"users/admin","username":"admin","role":"ADMIN","password":"secret"}],
		"removed":[{"resource":"identity-providers/old","destroy":true}]
	}`})
	result := planFor(t, desired, reader)
	require.True(t, result.Valid(), result.Message.Errors)
	order := []string{}
	for _, change := range result.Message.ResourceChanges {
		order = append(order, change.Resource)
	}
	require.Equal(t, []string{"identity-providers/sso", "instance/settings/ACCESS", "users/admin", "identity-providers/old"}, order)
}

func TestPlanUsers(t *testing.T) {
	reader := newFakeReader()
	require.Contains(t, strings.Join(planFor(t, loadDesired(t, map[string]string{"u.json": `{"users":[{"name":"users/admin","username":"admin","role":"ADMIN"}]}`}), reader).Message.Errors, ""),
		"password is required to create the user")

	created := changeFor(t, planFor(t, loadDesired(t, map[string]string{"u.json": `{"users":[{"name":"users/admin","username":"admin","role":"ADMIN","password":"pw"}]}`}), reader), "users/admin")
	require.Equal(t, apipb.ResourceChange_CREATE, created.Action)
	require.Equal(t, []*apipb.FieldChange{
		{Path: "username", After: `"admin"`},
		{Path: "role", After: "ADMIN"},
		{Path: "password", After: "(write-only, version 0)"},
	}, created.FieldChanges, "an undeclared displayName or email is not managed")

	reader.users = []*store.User{{ID: 1, Username: "admin", Role: store.RoleAdmin, Nickname: "Set by the user", Email: "admin@example.com"}}
	reader.state = &storepb.InstanceConfigurationState{Resources: []*storepb.InstanceConfigurationState_ManagedResource{
		{Name: "users/admin", Kind: "User", ManagedFields: []string{"username", "role"}, WriteOnlyVersion: 1},
	}}
	user := func(extra, lifecycle string) *Desired {
		return loadDesired(t, map[string]string{"u.json": `{"users":[{"name":"users/admin","username":"admin","role":"ADMIN","password":"pw"` + extra + `}]` + lifecycle + `}`})
	}
	untouched := planFor(t, user("", `,"lifecycle":[{"resource":"users/admin","writeOnlyVersion":1}]`), reader)
	require.Equal(t, apipb.ResourceChange_NO_OP, changeFor(t, untouched, "users/admin").Action, "the profile and the password are left alone")

	cleared := changeFor(t, planFor(t, user(`,"displayName":""`, `,"lifecycle":[{"resource":"users/admin","writeOnlyVersion":1}]`), reader), "users/admin")
	require.Equal(t, []*apipb.FieldChange{{Path: "displayName", Before: `"Set by the user"`, After: `""`}}, cleared.FieldChanges,
		"a declared empty displayName is managed")

	bumped := planFor(t, user("", `,"lifecycle":[{"resource":"users/admin","writeOnlyVersion":2}]`), reader)
	require.Equal(t, []*apipb.FieldChange{{Path: "password", Before: "(write-only)", After: "(write-only, version 2)"}}, changeFor(t, bumped, "users/admin").FieldChanges)
	require.Equal(t, int32(2), bumped.next.Resources[0].WriteOnlyVersion)

	noPassword := loadDesired(t, map[string]string{"u.json": `{"users":[{"name":"users/admin","username":"admin","role":"ADMIN"}],"lifecycle":[{"resource":"users/admin","writeOnlyVersion":2}]}`})
	require.Contains(t, strings.Join(planFor(t, noPassword, reader).Message.Errors, ""), "no password is declared")
}

func TestPlanAuthenticationInvariant(t *testing.T) {
	disallow := `{"instanceSettings":[{"name":"instance/settings/GENERAL","generalSetting":{"disallowPasswordAuth":true}}]}`
	reader := newFakeReader()
	require.Contains(t, strings.Join(planFor(t, loadDesired(t, map[string]string{"g.json": disallow}), reader).Message.Errors, ""), "no identity provider would remain")

	require.True(t, planFor(t, loadDesired(t, map[string]string{"g.json": disallow, "idp.json": `{"identityProviders":[` + validIDP + `]}`}), reader).Valid(),
		"a declared provider satisfies it")

	reader.settings[storepb.InstanceSettingKey_GENERAL] = &storepb.InstanceSetting{Key: storepb.InstanceSettingKey_GENERAL, Value: &storepb.InstanceSetting_GeneralSetting{
		GeneralSetting: &storepb.InstanceGeneralSetting{DisallowPasswordAuth: true},
	}}
	reader.providers = []*storepb.IdentityProvider{{Id: 1, Uid: "last"}}
	reader.state = &storepb.InstanceConfigurationState{Resources: []*storepb.InstanceConfigurationState_ManagedResource{{Name: "identity-providers/last", Kind: "IdentityProvider"}}}
	destroyLast := planFor(t, loadDesired(t, map[string]string{"r.json": `{"removed":[{"resource":"identity-providers/last","destroy":true}]}`}), reader)
	require.Contains(t, strings.Join(destroyLast.Message.Errors, ""), "no identity provider would remain")

	reader.providers = nil
	reader.state = &storepb.InstanceConfigurationState{}
	unrelated := planFor(t, loadDesired(t, map[string]string{"a.json": `{"instanceSettings":[{"name":"instance/settings/ACCESS","accessSetting":{"accessMode":"INSTANCE_ACCESS_MODE_PRIVATE"}}]}`}), reader)
	require.True(t, unrelated.Valid(), "an unrelated plan does not fail on an existing condition")
	require.Contains(t, strings.Join(unrelated.Message.Warnings, ""), "already has")
}

func TestPlanUsageLimitsResolveUsers(t *testing.T) {
	reader := newFakeReader()
	reader.users = []*store.User{{ID: 7, Username: "alice"}}
	reader.settings[storepb.InstanceSettingKey_USAGE_LIMITS] = &storepb.InstanceSetting{Key: storepb.InstanceSettingKey_USAGE_LIMITS, Value: &storepb.InstanceSetting_UsageLimitsSetting{
		UsageLimitsSetting: &storepb.InstanceUsageLimitsSetting{Limits: []*storepb.InstanceUsageLimitsSetting_UsageLimit{
			{UserIds: []int32{7}, MemoCount: new(int64(10))},
			{AllUsers: true},
		}},
	}}
	limits := func(users string) *Desired {
		return loadDesired(t, map[string]string{"l.json": `{"instanceSettings":[{"name":"instance/settings/USAGE_LIMITS","usageLimitsSetting":{"limits":[
			{"users":[` + users + `],"memoCount":"10"},{"allUsers":true}]}}]}`})
	}
	change := changeFor(t, planFor(t, limits(`"users/alice"`), reader), "instance/settings/USAGE_LIMITS")
	require.Empty(t, change.FieldChanges, "user names resolve to the stored IDs")

	missing := planFor(t, limits(`"users/carol"`), reader)
	require.Contains(t, strings.Join(missing.Message.Errors, ""), "names users/carol, which does not exist")
}

func TestPlanStateOnlyChange(t *testing.T) {
	reader := newFakeReader()
	reader.settings[storepb.InstanceSettingKey_GENERAL] = generalSetting("Company")
	desired := loadDesired(t, map[string]string{"general.json": generalDocument("Company")})
	reader.apply(t, desired, planFor(t, desired, reader))

	locked := loadDesired(t, map[string]string{"general.json": `{"instanceSettings":[{"name":"instance/settings/GENERAL","generalSetting":{"customProfile":{"title":"Company"}}}],
		"lifecycle":[{"resource":"instance/settings/GENERAL","preventDestroy":true}]}`})
	result := planFor(t, locked, reader)
	require.Equal(t, apipb.ResourceChange_NO_OP, changeFor(t, result, "instance/settings/GENERAL").Action)
	require.True(t, result.HasChanges(), "the state record now records preventDestroy")

	var text bytes.Buffer
	RenderPlan(&text, result.Message)
	require.Equal(t, "No resource changes. Apply would only update the state record.\n", text.String())
}

func TestRenderPlan(t *testing.T) {
	var text bytes.Buffer
	RenderPlan(&text, &apipb.Plan{ResourceChanges: []*apipb.ResourceChange{
		{Resource: "identity-providers/company-sso", Source: "instance.json", Action: apipb.ResourceChange_CREATE},
		{Resource: "instance/settings/GENERAL", Source: "instance.json", Action: apipb.ResourceChange_ADOPT, FieldChanges: []*apipb.FieldChange{
			{Path: "generalSetting.disallowPasswordAuth", Before: "false", After: "true"},
			{Path: "generalSetting.customProfile.title", Before: `"memos"`, After: `"Company Memos"`},
		}},
		{Resource: "instance/settings/ACCESS", Source: "instance.json", Action: apipb.ResourceChange_NO_OP},
		{Resource: "users/admin", Source: "instance.json", Action: apipb.ResourceChange_UPDATE, Drift: true, FieldChanges: []*apipb.FieldChange{
			{Path: "role", Before: "USER", After: "ADMIN"},
		}},
	}, StateRecordChanges: true})
	require.Equal(t, `Plan: 1 to create, 1 to update, 0 to destroy; 1 to adopt.

  + identity-providers/company-sso  (instance.json)
  ~ instance/settings/GENERAL       (instance.json)  adopt
        generalSetting.disallowPasswordAuth: false -> true
        generalSetting.customProfile.title:  "memos" -> "Company Memos"
  ~ users/admin                     (instance.json)  drift
        role: USER -> ADMIN
`, text.String())

	text.Reset()
	RenderPlan(&text, &apipb.Plan{ResourceChanges: []*apipb.ResourceChange{{Resource: "instance/settings/ACCESS", Action: apipb.ResourceChange_NO_OP}}})
	require.Equal(t, "No changes. The instance matches the configuration.\n", text.String())
}

func TestSensitiveFieldsExist(t *testing.T) {
	for _, name := range sensitiveFields {
		_, err := protoregistry.GlobalFiles.FindDescriptorByName(name)
		require.NoError(t, err, "%s was renamed; update sensitiveFields", name)
	}
}
