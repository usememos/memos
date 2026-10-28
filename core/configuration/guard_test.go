package configuration

import (
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
)

func TestGuard(t *testing.T) {
	state := &storepb.InstanceConfigurationState{Resources: []*storepb.InstanceConfigurationState_ManagedResource{
		{Name: "instance/settings/GENERAL", Source: "general.json", ManagedFields: []string{"*"}, IgnoredFields: []string{"generalSetting.customProfile"}},
		{Name: "users/admin", Source: "users.json", ManagedFields: []string{"username", "role"}},
	}}

	require.NoError(t, CheckChange(state, "instance/settings/GENERAL", nil), "a write that changes nothing passes")
	require.NoError(t, CheckChange(state, "instance/settings/GENERAL", []string{"generalSetting.customProfile.title"}), "ignored fields are released")
	err := CheckChange(state, "instance/settings/GENERAL", []string{"generalSetting.customProfile.title", "generalSetting.disallowPasswordAuth"})
	var managed *ManagedError
	require.ErrorAs(t, err, &managed)
	require.Equal(t, &ManagedError{Resource: "instance/settings/GENERAL", Source: "general.json", Fields: []string{"generalSetting.disallowPasswordAuth"}}, managed)
	require.Contains(t, err.Error(), "managed by configuration in general.json")

	require.NoError(t, CheckChange(state, "users/admin", []string{"displayName"}), "an undeclared profile field is the user's")
	require.Error(t, CheckChange(state, "users/admin", []string{"role"}))
	require.NoError(t, CheckChange(state, "users/other", []string{"role"}), "unmanaged resources are not guarded")

	require.Error(t, CheckExistence(state, "users/admin"))
	require.NoError(t, CheckExistence(state, "identity-providers/sso"))
	require.NoError(t, CheckExistence(&storepb.InstanceConfigurationState{}, "users/admin"))
}

func TestCheckReference(t *testing.T) {
	state := &storepb.InstanceConfigurationState{Resources: []*storepb.InstanceConfigurationState_ManagedResource{
		{Name: "instance/settings/USAGE_LIMITS", Source: "limits.json", ManagedFields: []string{"*"}, References: []string{"users/alice"}},
	}}

	err := CheckReference(state, "users/alice")
	var managed *ManagedError
	require.ErrorAs(t, err, &managed)
	require.Equal(t, &ManagedError{Resource: "users/alice", Source: "limits.json", ReferencedBy: "instance/settings/USAGE_LIMITS"}, managed)
	require.Contains(t, err.Error(), "users/alice is named by instance/settings/USAGE_LIMITS in limits.json")
	require.NoError(t, CheckReference(state, "users/bob"), "a user no managed resource names is not guarded")
}
