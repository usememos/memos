package main

import (
	"testing"

	"github.com/spf13/viper"
	"github.com/stretchr/testify/require"
)

func TestServerFlagsAreNotInheritedBySubcommands(t *testing.T) {
	require.Nil(t, versionCmd.InheritedFlags().Lookup("dsn"))
	require.Nil(t, versionCmd.InheritedFlags().Lookup("instance-url"))
	require.Nil(t, versionCmd.InheritedFlags().Lookup("allow-private-webhooks"))
}

func TestPrivateWebhookAllowlistSplitsFlagAndEnvironmentForms(t *testing.T) {
	const key = "webhook-private-network-allowlist"
	original := viper.Get(key)
	t.Cleanup(func() { viper.Set(key, original) })

	viper.Set(key, "hooks.internal,10.0.0.0/8")
	require.Equal(t, []string{"hooks.internal", "10.0.0.0/8"}, privateWebhookAllowlist())

	viper.Set(key, []string{"hooks.internal, 10.0.0.0/8", "192.168.1.10"})
	require.Equal(t, []string{"hooks.internal", "10.0.0.0/8", "192.168.1.10"}, privateWebhookAllowlist())
}
