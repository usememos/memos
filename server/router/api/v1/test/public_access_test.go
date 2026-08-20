package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// TestPublicAccessPolicy verifies that the persisted allow_public_access policy,
// not the canonical instance URL, decides anonymous availability, and that the
// effective policy flips immediately after an administrator update.
func TestPublicAccessPolicy(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	admin, err := ts.CreateHostUser(ctx, "policy-admin")
	require.NoError(t, err)
	adminCtx := ts.CreateUserContext(ctx, admin.ID)

	// The test profile has a non-empty InstanceURL; the default policy is still
	// private, and the public instance profile reports that.
	require.NotEmpty(t, ts.Profile.InstanceURL)
	profile, err := ts.Service.GetInstanceProfile(ctx, &v1pb.GetInstanceProfileRequest{})
	require.NoError(t, err)
	require.False(t, profile.GetAllowPublicAccess(), "a configured instance URL alone must not enable public access")

	// Only administrators may change the policy.
	setting := &v1pb.InstanceSetting{
		Name: "instance/settings/GENERAL",
		Value: &v1pb.InstanceSetting_GeneralSetting_{
			GeneralSetting: &v1pb.InstanceSetting_GeneralSetting{AllowPublicAccess: true},
		},
	}
	_, err = ts.Service.UpdateInstanceSetting(ctx, &v1pb.UpdateInstanceSettingRequest{Setting: setting})
	require.Error(t, err)
	require.Contains(t, err.Error(), "not authenticated")

	regular, err := ts.CreateRegularUser(ctx, "policy-user")
	require.NoError(t, err)
	_, err = ts.Service.UpdateInstanceSetting(ts.CreateUserContext(ctx, regular.ID), &v1pb.UpdateInstanceSettingRequest{Setting: setting})
	require.Error(t, err)
	require.Contains(t, err.Error(), "permission denied")

	// Enabling the policy is reflected immediately, even with an empty instance URL.
	updated, err := ts.Service.UpdateInstanceSetting(adminCtx, &v1pb.UpdateInstanceSettingRequest{Setting: setting})
	require.NoError(t, err)
	require.True(t, updated.GetGeneralSetting().GetAllowPublicAccess())
	require.True(t, ts.Store.AllowPublicAccess(ctx), "policy must take effect without a restart")

	ts.Profile.InstanceURL = ""
	profile, err = ts.Service.GetInstanceProfile(ctx, &v1pb.GetInstanceProfileRequest{})
	require.NoError(t, err)
	require.True(t, profile.GetAllowPublicAccess(), "explicit public access must work with an empty instance URL")

	// Disabling it again closes anonymous access on the next request.
	updated.GetGeneralSetting().AllowPublicAccess = false
	_, err = ts.Service.UpdateInstanceSetting(adminCtx, &v1pb.UpdateInstanceSettingRequest{Setting: updated})
	require.NoError(t, err)
	require.False(t, ts.Store.AllowPublicAccess(ctx))
	profile, err = ts.Service.GetInstanceProfile(ctx, &v1pb.GetInstanceProfileRequest{})
	require.NoError(t, err)
	require.False(t, profile.GetAllowPublicAccess())
}

// TestPublicAccessPolicyResetsWhenSettingDeleted covers the deletion path. The
// policy is cached in memory so it survives without a per-request query, which
// means removing the setting that granted public access must also withdraw it —
// otherwise anonymous visitors keep the access the deleted setting gave them.
func TestPublicAccessPolicyResetsWhenSettingDeleted(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	_, err := ts.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_GENERAL,
		Value: &storepb.InstanceSetting_GeneralSetting{
			GeneralSetting: &storepb.InstanceGeneralSetting{AllowPublicAccess: true},
		},
	})
	require.NoError(t, err)
	require.True(t, ts.Store.AllowPublicAccess(ctx))

	require.NoError(t, ts.Store.DeleteInstanceSetting(ctx, &store.DeleteInstanceSetting{
		Name: storepb.InstanceSettingKey_GENERAL.String(),
	}))

	require.False(t, ts.Profile.AllowAnonymous(),
		"deleting the GENERAL setting must withdraw the in-memory public-access policy")
	require.False(t, ts.Store.AllowPublicAccess(ctx),
		"an absent setting means no granted public access")
}
