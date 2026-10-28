package test

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	"github.com/usememos/memos/core/configuration"
	apipb "github.com/usememos/memos/proto/gen/api"
)

// applyConfiguration applies files to the test instance as `memos config apply` would.
func applyConfiguration(ctx context.Context, t *testing.T, ts *TestService, files map[string]string) {
	t.Helper()
	dir := t.TempDir()
	for name, content := range files {
		require.NoError(t, os.WriteFile(filepath.Join(dir, name), []byte(content), 0o600))
	}
	desired, err := configuration.Load(dir, configuration.OSResolver())
	require.NoError(t, err)
	plan, _, err := configuration.Apply(ctx, desired, ts.Store, configuration.ApplyMetadata{AppliedBy: "test", Version: "test", Now: time.Unix(1_800_000_000, 0)})
	require.NoError(t, err)
	require.True(t, plan.Valid(), plan.Message.Errors)
}

func requireManaged(t *testing.T, err error, resource string) map[string]string {
	t.Helper()
	st := status.Convert(err)
	require.Equal(t, codes.FailedPrecondition, st.Code(), "got %v", err)
	for _, detail := range st.Details() {
		if info, ok := detail.(*errdetails.ErrorInfo); ok {
			require.Equal(t, "MANAGED_BY_CONFIGURATION", info.Reason)
			require.Equal(t, "memos.api", info.Domain)
			require.Equal(t, resource, info.Metadata["resource"])
			return info.Metadata
		}
	}
	require.Fail(t, "no ErrorInfo detail", "%v", err)
	return nil
}

const managedProvider = `{"name":"identity-providers/sso","type":"OAUTH2","title":"SSO","config":{"oauth2Config":{"clientId":"memos","clientSecret":"secret",
	"authUrl":"https://idp.example.com/authorize","tokenUrl":"https://idp.example.com/token","userInfoUrl":"https://idp.example.com/userinfo",
	"fieldMapping":{"identifier":"sub"}}}}`

func TestConfigurationGuard(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()
	admin, err := ts.CreateHostUser(ctx, "admin")
	require.NoError(t, err)
	adminCtx := ts.CreateUserContext(ctx, admin.ID)
	applyConfiguration(ctx, t, ts, map[string]string{
		"idp.json": `{"identityProviders":[` + managedProvider + `]}`,
		"general.json": `{"instanceSettings":[{"name":"instance/settings/GENERAL","generalSetting":{"customProfile":{"title":"Company"}}}],
			"lifecycle":[{"resource":"instance/settings/GENERAL","ignoreChanges":["generalSetting.additionalStyle"]}]}`,
		"users.json": `{"users":[{"name":"users/admin","username":"admin","role":"ADMIN","password":"pw"}]}`,
	})

	// Instance settings: a managed change is refused, with the file and the field.
	general := func(title, style string) error {
		_, err := ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{InstanceSetting: &apipb.InstanceSetting{
			Name: "instance/settings/GENERAL",
			Value: &apipb.InstanceSetting_GeneralSetting_{GeneralSetting: &apipb.InstanceSetting_GeneralSetting{
				CustomProfile: &apipb.InstanceSetting_GeneralSetting_CustomProfile{Title: title}, AdditionalStyle: style,
			}},
		}})
		return err
	}
	metadata := requireManaged(t, general("Renamed", ""), "instance/settings/GENERAL")
	require.Equal(t, "general.json", metadata["source"])
	require.Equal(t, "generalSetting.customProfile.title", metadata["fields"])
	require.NoError(t, general("Company", ""), "resending the managed values passes")
	require.NoError(t, general("Company", "body{}"), "an ignored field is the API's to change")

	// Identity providers: updates, deletes, and a create with the same name are refused.
	_, err = ts.Service.UpdateIdentityProvider(adminCtx, &apipb.UpdateIdentityProviderRequest{
		IdentityProvider: &apipb.IdentityProvider{Name: "identity-providers/sso", Title: "Renamed"},
		UpdateMask:       &fieldmaskpb.FieldMask{Paths: []string{"title"}},
	})
	require.Equal(t, "title", requireManaged(t, err, "identity-providers/sso")["fields"])
	_, err = ts.Service.DeleteIdentityProvider(adminCtx, &apipb.DeleteIdentityProviderRequest{Name: "identity-providers/sso"})
	requireManaged(t, err, "identity-providers/sso")
	_, err = ts.Service.UpdateIdentityProvider(adminCtx, &apipb.UpdateIdentityProviderRequest{
		IdentityProvider: &apipb.IdentityProvider{Name: "identity-providers/sso", Title: "SSO"},
		UpdateMask:       &fieldmaskpb.FieldMask{Paths: []string{"title"}},
	})
	require.NoError(t, err, "an update that changes nothing passes")

	// Users: username and role are managed; the profile and the password are not.
	update := func(user *apipb.User, paths ...string) error {
		user.Name = "users/admin"
		_, err := ts.Service.UpdateUser(adminCtx, &apipb.UpdateUserRequest{User: user, UpdateMask: &fieldmaskpb.FieldMask{Paths: paths}})
		return err
	}
	require.Equal(t, "role", requireManaged(t, update(&apipb.User{Role: apipb.User_USER}, "role"), "users/admin")["fields"])
	require.NoError(t, update(&apipb.User{DisplayName: "Admin"}, "display_name"))
	require.NoError(t, update(&apipb.User{Password: "changed in the UI"}, "password"), "the password is write-only and never guarded")
	_, err = ts.Service.DeleteUser(adminCtx, &apipb.DeleteUserRequest{Name: "users/admin"})
	requireManaged(t, err, "users/admin")

	// Unmanaged resources are not guarded.
	_, err = ts.Service.UpdateInstanceSetting(adminCtx, &apipb.UpdateInstanceSettingRequest{InstanceSetting: &apipb.InstanceSetting{
		Name:  "instance/settings/MEMO_RELATED",
		Value: &apipb.InstanceSetting_MemoRelatedSetting_{MemoRelatedSetting: &apipb.InstanceSetting_MemoRelatedSetting{Reactions: []string{"👍"}}},
	}})
	require.NoError(t, err)
}

func TestGetConfigurationStatus(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()
	admin, err := ts.CreateHostUser(ctx, "admin")
	require.NoError(t, err)
	member, err := ts.CreateRegularUser(ctx, "member")
	require.NoError(t, err)

	empty, err := ts.Service.GetConfigurationStatus(ts.CreateUserContext(ctx, admin.ID), &apipb.GetConfigurationStatusRequest{})
	require.NoError(t, err)
	require.Zero(t, empty.Serial)
	require.Empty(t, empty.ManagedResources)

	applyConfiguration(ctx, t, ts, map[string]string{"idp.json": `{"identityProviders":[` + managedProvider + `]}`})
	got, err := ts.Service.GetConfigurationStatus(ts.CreateUserContext(ctx, admin.ID), &apipb.GetConfigurationStatusRequest{})
	require.NoError(t, err)
	require.Equal(t, int64(1), got.Serial)
	require.Equal(t, "test", got.AppliedBy)
	require.Equal(t, int64(1_800_000_000), got.ApplyTime.GetSeconds())
	require.Equal(t, []*apipb.ConfigurationStatus_ManagedResource{{Resource: "identity-providers/sso", Source: "idp.json", ManagedFields: []string{"*"}}}, got.ManagedResources)
	require.NotContains(t, got.String(), "secret", "the status carries no configured value")

	_, err = ts.Service.GetConfigurationStatus(ts.CreateUserContext(ctx, member.ID), &apipb.GetConfigurationStatusRequest{})
	require.Equal(t, codes.PermissionDenied, status.Code(err))
	_, err = ts.Service.GetConfigurationStatus(ctx, &apipb.GetConfigurationStatusRequest{})
	require.Equal(t, codes.Unauthenticated, status.Code(err))
}
