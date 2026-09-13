package main

import (
	"bytes"
	"testing"

	"github.com/spf13/viper"
	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/version"
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

func TestVersionFlagUsesPosixShorthand(t *testing.T) {
	flag := rootCmd.Flags().Lookup("version")
	require.NotNil(t, flag)
	// Cobra's own version flag would claim "v"; "V" is what POSIX/BSD users expect.
	require.Equal(t, "V", flag.Shorthand)
	require.Nil(t, rootCmd.Flags().ShorthandLookup("v"))
}

func TestVersionFormsPrintTheSameString(t *testing.T) {
	require.Equal(t, version.GetCurrentVersion(), rootCmd.Version)

	// Cobra handles the version flag before RunE, so this never starts a server.
	run := func(args ...string) string {
		var out bytes.Buffer
		rootCmd.SetOut(&out)
		rootCmd.SetArgs(args)
		t.Cleanup(func() {
			rootCmd.SetOut(nil)
			rootCmd.SetArgs(nil)
			require.NoError(t, rootCmd.Flags().Set("version", "false"))
		})
		require.NoError(t, rootCmd.Execute())
		return out.String()
	}

	expected := version.GetCurrentVersion() + "\n"
	require.Equal(t, expected, run("--version"))
	require.Equal(t, expected, run("-V"))
}
