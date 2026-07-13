package test

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
)

func TestDeploymentConfiguredResourcesRejectMutations(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()
	admin, err := ts.CreateHostUser(ctx, "admin")
	require.NoError(t, err)
	adminCtx := ts.CreateUserContext(ctx, admin.ID)

	dir := t.TempDir()
	writeDeploymentProto(t, filepath.Join(dir, "memos-idp-primary.json"), testStoreIdentityProvider("primary-sso"))
	writeDeploymentProto(t, filepath.Join(dir, "memos-instance-setting-general.json"), &storepb.InstanceSetting{
		Key:   storepb.InstanceSettingKey_GENERAL,
		Value: &storepb.InstanceSetting_GeneralSetting{GeneralSetting: &storepb.InstanceGeneralSetting{WeekStartDayOffset: 1}},
	})
	writeDeploymentProto(t, filepath.Join(dir, "memos-instance-setting-storage.json"), &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_STORAGE,
		Value: &storepb.InstanceSetting_StorageSetting{StorageSetting: &storepb.InstanceStorageSetting{
			StorageType: storepb.InstanceStorageSetting_LOCAL,
		}},
	})
	require.NoError(t, ts.Store.LoadDeploymentConfigurationDir(ctx, dir))

	providers, err := ts.Service.ListIdentityProviders(ctx, &v1pb.ListIdentityProvidersRequest{})
	require.NoError(t, err)
	require.Len(t, providers.IdentityProviders, 1)
	require.Equal(t, "Primary SSO", providers.IdentityProviders[0].Title)

	setting, err := ts.Service.GetInstanceSetting(ctx, &v1pb.GetInstanceSettingRequest{Name: "instance/settings/GENERAL"})
	require.NoError(t, err)
	require.Equal(t, int32(1), setting.GetGeneralSetting().WeekStartDayOffset)
	storageSetting, err := ts.Service.GetInstanceSetting(adminCtx, &v1pb.GetInstanceSettingRequest{Name: "instance/settings/STORAGE"})
	require.NoError(t, err)
	require.Equal(t, int64(30), storageSetting.GetStorageSetting().UploadSizeLimitMb)
	require.Equal(t, "assets/{timestamp}_{uuid}_{filename}", storageSetting.GetStorageSetting().FilepathTemplate)

	_, err = ts.Service.CreateIdentityProvider(adminCtx, &v1pb.CreateIdentityProviderRequest{
		IdentityProviderId: "primary-sso",
		IdentityProvider:   testAPIIdentityProvider("Replacement"),
	})
	require.Equal(t, codes.FailedPrecondition, status.Code(err))

	_, err = ts.Service.UpdateIdentityProvider(adminCtx, &v1pb.UpdateIdentityProviderRequest{
		IdentityProvider: &v1pb.IdentityProvider{Name: "identity-providers/primary-sso", Title: "Changed"},
		UpdateMask:       &fieldmaskpb.FieldMask{Paths: []string{"title"}},
	})
	require.Equal(t, codes.FailedPrecondition, status.Code(err))

	_, err = ts.Service.DeleteIdentityProvider(adminCtx, &v1pb.DeleteIdentityProviderRequest{Name: "identity-providers/primary-sso"})
	require.Equal(t, codes.FailedPrecondition, status.Code(err))

	_, err = ts.Service.UpdateInstanceSetting(adminCtx, &v1pb.UpdateInstanceSettingRequest{
		Setting: &v1pb.InstanceSetting{
			Name:  "instance/settings/GENERAL",
			Value: &v1pb.InstanceSetting_GeneralSetting_{GeneralSetting: &v1pb.InstanceSetting_GeneralSetting{}},
		},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"general_setting"}},
	})
	require.Equal(t, codes.FailedPrecondition, status.Code(err))
}

func TestAuthenticationMutationAPIRejectsLockout(t *testing.T) {
	ctx := context.Background()

	t.Run("GENERAL update requires an effective identity provider", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()
		admin, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		adminCtx := ts.CreateUserContext(ctx, admin.ID)

		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &v1pb.UpdateInstanceSettingRequest{Setting: &v1pb.InstanceSetting{
			Name: "instance/settings/GENERAL",
			Value: &v1pb.InstanceSetting_GeneralSetting_{GeneralSetting: &v1pb.InstanceSetting_GeneralSetting{
				DisallowPasswordAuth: true,
			}},
		}})
		require.Equal(t, codes.FailedPrecondition, status.Code(err))
	})

	t.Run("last IdP cannot be deleted while regular password auth is disabled", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()
		admin, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		adminCtx := ts.CreateUserContext(ctx, admin.ID)
		created, err := ts.Service.CreateIdentityProvider(adminCtx, &v1pb.CreateIdentityProviderRequest{
			IdentityProviderId: "primary-sso",
			IdentityProvider:   testAPIIdentityProvider("Primary"),
		})
		require.NoError(t, err)
		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &v1pb.UpdateInstanceSettingRequest{Setting: &v1pb.InstanceSetting{
			Name: "instance/settings/GENERAL",
			Value: &v1pb.InstanceSetting_GeneralSetting_{GeneralSetting: &v1pb.InstanceSetting_GeneralSetting{
				DisallowPasswordAuth: true,
			}},
		}})
		require.NoError(t, err)

		_, err = ts.Service.DeleteIdentityProvider(adminCtx, &v1pb.DeleteIdentityProviderRequest{Name: created.Name})
		require.Equal(t, codes.FailedPrecondition, status.Code(err))
	})
}

func testStoreIdentityProvider(uid string) *storepb.IdentityProvider {
	return &storepb.IdentityProvider{
		Uid:  uid,
		Name: "Primary SSO",
		Type: storepb.IdentityProvider_OAUTH2,
		Config: &storepb.IdentityProviderConfig{Config: &storepb.IdentityProviderConfig_Oauth2Config{Oauth2Config: &storepb.OAuth2Config{
			ClientId:     "client-id",
			ClientSecret: "client-secret",
			AuthUrl:      "https://example.com/authorize",
			TokenUrl:     "https://example.com/token",
			UserInfoUrl:  "https://example.com/userinfo",
			Scopes:       []string{"openid", "profile"},
			FieldMapping: &storepb.FieldMapping{Identifier: "sub"},
		}}},
	}
}

func testAPIIdentityProvider(title string) *v1pb.IdentityProvider {
	return &v1pb.IdentityProvider{
		Title: title,
		Type:  v1pb.IdentityProvider_OAUTH2,
		Config: &v1pb.IdentityProviderConfig{Config: &v1pb.IdentityProviderConfig_Oauth2Config{Oauth2Config: &v1pb.OAuth2Config{
			ClientId:     "client-id",
			ClientSecret: "client-secret",
			AuthUrl:      "https://example.com/authorize",
			TokenUrl:     "https://example.com/token",
			UserInfoUrl:  "https://example.com/userinfo",
			Scopes:       []string{"openid", "profile"},
			FieldMapping: &v1pb.FieldMapping{Identifier: "sub"},
		}}},
	}
}

func writeDeploymentProto(t *testing.T, path string, message proto.Message) {
	t.Helper()
	content, err := (protojson.MarshalOptions{Indent: "  "}).Marshal(message)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(path, content, 0600))
}
