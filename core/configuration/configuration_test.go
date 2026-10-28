package configuration

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/types/descriptorpb"

	apipb "github.com/usememos/memos/proto/gen/api"
)

// placeholderResolver resolves every reference, so fixtures exercise the
// schema rather than the host's secrets.
func placeholderResolver() Resolver {
	return Resolver{
		LookupEnv: func(string) (string, bool) { return "placeholder", true },
		ReadFile:  func(string) ([]byte, error) { return []byte("placeholder\n"), nil },
	}
}

// validIDP is an identity provider that meets every rule.
const validIDP = `{"name":"identity-providers/sso","type":"OAUTH2","title":"SSO","config":{"oauth2Config":{"clientId":"memos",
	"authUrl":"https://idp.example.com/authorize","tokenUrl":"https://idp.example.com/token","userInfoUrl":"https://idp.example.com/userinfo",
	"fieldMapping":{"identifier":"sub"}}}}`

func writeFiles(t *testing.T, files map[string]string) string {
	t.Helper()
	dir := t.TempDir()
	for name, content := range files {
		require.NoError(t, os.WriteFile(filepath.Join(dir, name), []byte(content), 0o600))
	}
	return dir
}

func requireProblems(t *testing.T, err error, want ...string) {
	t.Helper()
	var validationError *ValidationError
	require.ErrorAs(t, err, &validationError)
	joined := strings.Join(validationError.Problems, "\n")
	for _, w := range want {
		require.Contains(t, joined, w)
	}
}

// TestCompatibilityFixtures decodes the example files of every release. A
// change that stops one from decoding is a break to record in
// proto/api/CHANGELOG.md, updating the fixture in the same change.
func TestCompatibilityFixtures(t *testing.T) {
	releases, err := os.ReadDir("testdata/compat")
	require.NoError(t, err)
	require.NotEmpty(t, releases)
	for _, release := range releases {
		t.Run(release.Name(), func(t *testing.T) {
			desired, err := Load(filepath.Join("testdata/compat", release.Name()), placeholderResolver())
			require.NoError(t, err)
			require.NotEmpty(t, desired.Sources)
			require.Empty(t, desired.Warnings)
		})
	}
}

func TestLoadMergesFilesAndRecordsSources(t *testing.T) {
	dir := writeFiles(t, map[string]string{
		"a-idp.json":     `{"identityProviders":[` + validIDP + `]}`,
		"b-access.json":  `{"instanceSettings":[{"name":"instance/settings/ACCESS","accessSetting":{"accessMode":"INSTANCE_ACCESS_MODE_PUBLIC"}}]}`,
		"c-users.json":   `{"users":[{"name":"users/admin","username":"admin","role":"ADMIN"}],"lifecycle":[{"resource":"identity-providers/sso","preventDestroy":true}]}`,
		"notes.txt":      `not configuration`,
		"README.md.json": `{}`,
	})
	require.NoError(t, os.Mkdir(filepath.Join(dir, "nested.json"), 0o700))

	desired, err := Load(dir, placeholderResolver())
	require.NoError(t, err)
	require.Len(t, desired.Configuration.IdentityProviders, 1)
	require.Len(t, desired.Configuration.InstanceSettings, 1)
	require.Len(t, desired.Configuration.Users, 1)
	require.Len(t, desired.Configuration.Lifecycle, 1)
	require.Equal(t, map[string]string{
		"identity-providers/sso":   "a-idp.json",
		"instance/settings/ACCESS": "b-access.json",
		"users/admin":              "c-users.json",
	}, desired.Sources)
	require.Equal(t, apipb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PUBLIC,
		desired.Configuration.InstanceSettings[0].GetAccessSetting().GetAccessMode())
}

func TestLoadDirectoryEdgeCases(t *testing.T) {
	desired, err := Load(filepath.Join(t.TempDir(), "missing"), placeholderResolver())
	require.NoError(t, err, "a missing directory is an empty desired state")
	require.Empty(t, desired.Sources)

	dir := writeFiles(t, map[string]string{"target.json": `{"users":[{"name":"users/admin","username":"admin","role":"ADMIN"}]}`})
	linkDir := t.TempDir()
	require.NoError(t, os.Symlink(filepath.Join(dir, "target.json"), filepath.Join(linkDir, "linked.json")))
	desired, err = Load(linkDir, placeholderResolver())
	require.NoError(t, err, "a symlink to a regular file is followed, as in Kubernetes volumes")
	require.Contains(t, desired.Sources, "users/admin")

	big := writeFiles(t, map[string]string{"big.json": `{"users":[]}` + strings.Repeat(" ", maxFileSize)})
	_, err = Load(big, placeholderResolver())
	require.ErrorContains(t, err, "larger than")
}

func TestLoadDecodesStrictly(t *testing.T) {
	tests := map[string]struct {
		document string
		want     string
	}{
		"syntax error":    {`{"users": [}`, "line 1, column 12"},
		"not an object":   {`[]`, "must be a JSON object"},
		"trailing data":   {`{} {}`, "unexpected data"},
		"duplicate key":   {`{"users":[],"users":[]}`, "users: duplicate key"},
		"unknown field":   {`{"identityProviders":[{"name":"identity-providers/sso","titel":"SSO"}]}`, `unknown field "titel"`},
		"numeric enum":    {`{"users":[{"name":"users/admin","username":"admin","role":1}]}`, "users[0].role: use the enum value name"},
		"output only":     {`{"users":[{"name":"users/admin","username":"admin","role":"ADMIN","createTime":"2026-01-01T00:00:00Z"}]}`, "users[0].createTime is output only"},
		"nested output":   {`{"instanceSettings":[{"name":"instance/settings/AI","aiSetting":{"providers":[{"id":"a","apiKeySet":true}]}}]}`, "aiSetting.providers[0].apiKeySet is output only"},
		"wrong value":     {`{"lifecycle":[{"resource":"users/admin","preventDestroy":"yes"}]}`, "invalid value for bool field preventDestroy"},
		"oneof conflict":  {`{"instanceSettings":[{"name":"instance/settings/ACCESS","accessSetting":{},"generalSetting":{}}]}`, "is already set"},
		"proto name keys": {`{"identity_providers":[` + validIDP + `]}`, ""},
	}
	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			_, err := Load(writeFiles(t, map[string]string{"config.json": test.document}), placeholderResolver())
			if test.want == "" {
				require.NoError(t, err)
				return
			}
			requireProblems(t, err, "config.json: ", test.want)
		})
	}
}

func TestLoadSubstitutesReferences(t *testing.T) {
	secretFile := filepath.Join(t.TempDir(), "password")
	require.NoError(t, os.WriteFile(secretFile, []byte("file-secret\n"), 0o600))
	t.Setenv("MEMOS_TEST_SECRET", "env-secret")

	dir := writeFiles(t, map[string]string{"config.json": `{
		"identityProviders": [{"name":"identity-providers/sso","type":"OAUTH2","title":"$${not a reference}",
			"config":{"oauth2Config":{"clientId":"${env:MEMOS_TEST_SECRET}","clientSecret":"${file:` + secretFile + `}",
				"authUrl":"https://idp.example.com/authorize","tokenUrl":"https://idp.example.com/token",
				"userInfoUrl":"https://idp.example.com/userinfo","fieldMapping":{"identifier":"sub"}}}}]
	}`})
	desired, err := Load(dir, OSResolver())
	require.NoError(t, err)
	provider := desired.Configuration.IdentityProviders[0]
	require.Equal(t, "env-secret", provider.GetConfig().GetOauth2Config().GetClientId())
	require.Equal(t, "file-secret", provider.GetConfig().GetOauth2Config().GetClientSecret(), "trailing line breaks are removed")
	require.Equal(t, "${not a reference}", provider.GetTitle(), "$${ is a literal ${")

	for name, test := range map[string]struct {
		value string
		want  string
	}{
		"unset variable":    {`${env:MEMOS_TEST_UNSET}`, "environment variable MEMOS_TEST_UNSET is not set"},
		"embedded":          {`Bearer ${env:MEMOS_TEST_SECRET}`, "must be the whole string value"},
		"unsupported kind":  {`${vault:secret/memos}`, "unsupported reference"},
		"relative file":     {`${file:secrets/password}`, "must be an absolute path"},
		"missing file":      {`${file:/nonexistent/memos-secret}`, "cannot read /nonexistent/memos-secret"},
		"invalid name":      {`${env:1BAD}`, "invalid environment variable name"},
		"empty env allowed": {`${env:MEMOS_TEST_EMPTY}`, ""},
	} {
		t.Run(name, func(t *testing.T) {
			t.Setenv("MEMOS_TEST_EMPTY", "")
			dir := writeFiles(t, map[string]string{"config.json": `{"users":[{"name":"users/admin","username":"admin","role":"ADMIN","displayName":"` + test.value + `"}]}`})
			_, err := Load(dir, OSResolver())
			if test.want == "" {
				require.NoError(t, err)
				return
			}
			requireProblems(t, err, "config.json: users[0].displayName: ", test.want)
		})
	}
}

func TestLoadNeverPrintsSubstitutedValues(t *testing.T) {
	t.Setenv("MEMOS_TEST_PORT", "hunter2-not-a-port")
	dir := writeFiles(t, map[string]string{"config.json": `{"instanceSettings":[{"name":"instance/settings/NOTIFICATION",
		"notificationSetting":{"email":{"enabled":true,"smtpPort":"${env:MEMOS_TEST_PORT}"}}}]}`})
	_, err := Load(dir, OSResolver())
	requireProblems(t, err, "invalid value for int32 field smtpPort")
	require.NotContains(t, err.Error(), "hunter2")
}

func TestLoadChecksSchema(t *testing.T) {
	tests := map[string]struct {
		document string
		want     string
	}{
		"missing name":       {`{"identityProviders":[{"title":"SSO"}]}`, "identityProviders[0].name is required"},
		"wrong kind":         {`{"identityProviders":[{"name":"users/admin"}]}`, "is not a IdentityProvider name"},
		"invalid uid":        {`{"identityProviders":[{"name":"identity-providers/-sso"}]}`, "invalid identity provider name"},
		"basic":              {`{"instanceSettings":[{"name":"instance/settings/BASIC"}]}`, "BASIC holds the instance secret"},
		"tags":               {`{"instanceSettings":[{"name":"instance/settings/TAGS","tagsSetting":{}}]}`, "TAGS is kept only for compatibility"},
		"unknown key":        {`{"instanceSettings":[{"name":"instance/settings/THEME"}]}`, "unknown instance setting"},
		"state record":       {`{"instanceSettings":[{"name":"instance/settings/CONFIGURATION_STATE"}]}`, "is the configuration state record"},
		"missing value":      {`{"instanceSettings":[{"name":"instance/settings/GENERAL"}]}`, "generalSetting is required for GENERAL"},
		"mismatched value":   {`{"instanceSettings":[{"name":"instance/settings/GENERAL","accessSetting":{}}]}`, "accessSetting does not match GENERAL; use generalSetting"},
		"username mismatch":  {`{"users":[{"name":"users/admin","username":"root","role":"ADMIN"}]}`, `users[0].username must equal "admin"`},
		"missing role":       {`{"users":[{"name":"users/admin","username":"admin"}]}`, "users[0].role is required"},
		"profile field":      {`{"users":[{"name":"users/admin","username":"admin","role":"ADMIN","description":"hi"}]}`, "users[0].description cannot be configured"},
		"lifecycle no name":  {`{"lifecycle":[{"preventDestroy":true}]}`, "lifecycle[0].resource is required"},
		"write-only on idp":  {`{"identityProviders":[{"name":"identity-providers/sso"}],"lifecycle":[{"resource":"identity-providers/sso","writeOnlyVersion":1}]}`, "writeOnlyVersion applies only to users"},
		"negative version":   {`{"users":[{"name":"users/admin","username":"admin","role":"ADMIN"}],"lifecycle":[{"resource":"users/admin","writeOnlyVersion":-1}]}`, "must not be negative"},
		"unknown path":       {`{"identityProviders":[{"name":"identity-providers/sso"}],"lifecycle":[{"resource":"identity-providers/sso","ignoreChanges":["config.oauth2Config.scope"]}]}`, `has no field "scope"`},
		"ignore name":        {`{"identityProviders":[{"name":"identity-providers/sso"}],"lifecycle":[{"resource":"identity-providers/sso","ignoreChanges":["name"]}]}`, "cannot be ignored"},
		"path through list":  {`{"identityProviders":[{"name":"identity-providers/sso"}],"lifecycle":[{"resource":"identity-providers/sso","ignoreChanges":["config.oauth2Config.scopes.x"]}]}`, "is not a message field"},
		"removed bad name":   {`{"removed":[{"resource":"memos/123"}]}`, "removed[0].resource"},
		"lifecycle dangling": {`{"lifecycle":[{"resource":"users/admin"}]}`, "names users/admin, which no file declares"},
		"removed declared":   {`{"users":[{"name":"users/admin","username":"admin","role":"ADMIN"}],"removed":[{"resource":"users/admin"}]}`, "is removed but still declared"},
	}
	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			_, err := Load(writeFiles(t, map[string]string{"config.json": test.document}), placeholderResolver())
			requireProblems(t, err, test.want)
		})
	}

	_, err := Load(writeFiles(t, map[string]string{
		"config.json": `{"identityProviders":[` + validIDP + `],"lifecycle":[{"resource":"identity-providers/sso","ignoreChanges":["config.oauth2Config.scopes","title"]}]}`,
	}), placeholderResolver())
	require.NoError(t, err, "ignoreChanges may name nested and top-level fields")
}

func TestLoadChecksResourceRules(t *testing.T) {
	tests := map[string]struct {
		document string
		want     string
	}{
		"incomplete provider": {`{"identityProviders":[{"name":"identity-providers/sso","type":"OAUTH2","title":"SSO"}]}`,
			"config.json: identity-providers/sso: config.oauth2_config is required"},
		"storage default typo": {`{"instanceSettings":[{"name":"instance/settings/STORAGE","storageSetting":{"defaultStorageId":"mian",
			"storages":[{"id":"main","type":"LOCAL"}]}}]}`, `instance/settings/STORAGE: default storage "mian" is not configured`},
		"incomplete s3": {`{"instanceSettings":[{"name":"instance/settings/STORAGE","storageSetting":{"defaultStorageId":"s3",
			"storages":[{"id":"s3","type":"S3","s3Config":{"endpoint":"https://s3.example.com","bucket":"memos"}}]}}]}`, "storage s3 region is required"},
		"ai without key": {`{"instanceSettings":[{"name":"instance/settings/AI","aiSetting":{"providers":[{"id":"openai","title":"OpenAI","type":"OPENAI"}]}}]}`,
			`provider "openai" API key is required`},
		"ai without id": {`{"instanceSettings":[{"name":"instance/settings/AI","aiSetting":{"providers":[{"title":"OpenAI","type":"OPENAI","apiKey":"k"}]}}]}`,
			"providers[0].id is required"},
		"email without host": {`{"instanceSettings":[{"name":"instance/settings/NOTIFICATION","notificationSetting":{"email":{"enabled":true}}}]}`,
			"requires smtp_host"},
		"usage limits order": {`{"instanceSettings":[{"name":"instance/settings/USAGE_LIMITS","usageLimitsSetting":{"limits":[
			{"allUsers":true},{"users":["users/alice"],"memoCount":"10"}]}}]}`, "instance/settings/USAGE_LIMITS:"},
		"usage limits bad user": {`{"instanceSettings":[{"name":"instance/settings/USAGE_LIMITS","usageLimitsSetting":{"limits":[
			{"users":["memos/1"]},{"allUsers":true}]}}]}`, `names "memos/1", which is not a user name`},
		"invalid email": {`{"users":[{"name":"users/admin","username":"admin","role":"ADMIN","email":"not an email"}]}`, "users/admin:"},
		"week start": {`{"instanceSettings":[{"name":"instance/settings/GENERAL","generalSetting":{"weekStartDayOffset":9}}]}`,
			"week_start_day_offset"},
	}
	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			_, err := Load(writeFiles(t, map[string]string{"config.json": test.document}), placeholderResolver())
			requireProblems(t, err, test.want)
		})
	}

	_, err := Load(writeFiles(t, map[string]string{"config.json": `{"instanceSettings":[
		{"name":"instance/settings/USAGE_LIMITS","usageLimitsSetting":{"limits":[{"users":["users/alice","users/bob"],"memoCount":"100"},{"allUsers":true,"memoCount":"10"}]}},
		{"name":"instance/settings/AI","aiSetting":{"providers":[{"id":"openai","title":"OpenAI","type":"OPENAI","apiKey":"k"}],"transcription":{"providerId":"openai"}}},
		{"name":"instance/settings/STORAGE","storageSetting":{"storageType":"LOCAL"}}
	]}`}), placeholderResolver())
	require.NoError(t, err, "valid usage limits, AI, and legacy storage settings load")
}

func TestLoadRejectsDeclarationsInTwoFiles(t *testing.T) {
	user := `{"users":[{"name":"users/admin","username":"admin","role":"ADMIN"}],"lifecycle":[{"resource":"users/admin"}]}`
	_, err := Load(writeFiles(t, map[string]string{"a.json": user, "b.json": user}), placeholderResolver())
	requireProblems(t, err,
		"b.json: resource for users/admin is also declared in a.json",
		"b.json: a lifecycle rule for users/admin is also declared in a.json")
}

func TestLoadReportsEveryFile(t *testing.T) {
	_, err := Load(writeFiles(t, map[string]string{
		"a.json": `{"users":[{"name":"users/admin"}]}`,
		"b.json": `{"bogus":true}`,
	}), placeholderResolver())
	requireProblems(t, err, "a.json: users[0]", `b.json: unknown field "bogus"`)
}

func TestInspectorWarnsOnDeprecatedFields(t *testing.T) {
	file, err := protodesc.NewFile(&descriptorpb.FileDescriptorProto{
		Name:    new("deprecated_test.proto"),
		Package: new("memos.test"),
		Syntax:  new("proto3"),
		MessageType: []*descriptorpb.DescriptorProto{{
			Name: new("Settings"),
			Field: []*descriptorpb.FieldDescriptorProto{{
				Name:     new("old_flag"),
				JsonName: new("oldFlag"),
				Number:   new(int32(1)),
				Label:    descriptorpb.FieldDescriptorProto_LABEL_OPTIONAL.Enum(),
				Type:     descriptorpb.FieldDescriptorProto_TYPE_BOOL.Enum(),
				Options:  &descriptorpb.FieldOptions{Deprecated: new(true)},
			}},
		}},
	}, nil)
	require.NoError(t, err)
	in := &inspector{}
	in.message("settings", map[string]any{"oldFlag": true}, file.Messages().ByName("Settings"))
	require.Equal(t, []string{"settings.oldFlag is deprecated"}, in.warnings)
	require.Empty(t, in.problems)
}
