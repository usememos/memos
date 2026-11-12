package version

import (
	"runtime/debug"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestResolveBuild(t *testing.T) {
	for _, tc := range []struct {
		name, version, commit, timestamp, wantVersion, wantCommit string
	}{
		{"development", "", "unknown", "2026-09-27T14:58:52Z", "26.09.27-dev.abc1234", "abc1234def"},
		{"UTC day boundary", "", "unknown", "2026-10-01T00:30:00+08:00", "26.09.30-dev.abc1234", "abc1234def"},
		{"UTC year boundary", "", "unknown", "2026-12-31T23:30:00-08:00", "27.01.1-dev.abc1234", "abc1234def"},
		{"release override", "26.10.1", "release-sha", "2026-09-27T14:58:52Z", "26.10.1", "release-sha"},
		{"RC override", "26.10.0-rc.1", "", "2026-09-27T14:58:52Z", "26.10.0-rc.1", "abc1234def"},
		{"invalid timestamp", "", "unknown", "invalid", "", "abc1234def"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			settings := []debug.BuildSetting{
				{Key: "vcs.time", Value: tc.timestamp},
				{Key: "vcs.revision", Value: "abc1234def"},
				{Key: "vcs.modified", Value: "true"},
			}
			version, commit := resolveBuild(tc.version, tc.commit, settings)
			require.Equal(t, tc.wantVersion, version)
			require.Equal(t, tc.wantCommit, commit)
		})
	}

	// A commit time without a revision cannot name a development build.
	version, commit := resolveBuild("", "unknown", []debug.BuildSetting{{Key: "vcs.time", Value: "2026-09-27T14:58:52Z"}})
	require.Empty(t, version)
	require.Equal(t, "unknown", commit)
	version, commit = resolveBuild("", "unknown", nil)
	require.Empty(t, version)
	require.Equal(t, "unknown", commit)
	version, commit = resolveBuild("26.09.1", "release-sha", nil)
	require.Equal(t, "26.09.1", version)
	require.Equal(t, "release-sha", commit)
}

func TestValidate(t *testing.T) {
	original := Version
	t.Cleanup(func() { Version = original })
	for _, value := range []string{
		"26.09.0", "26.09.1", "26.09.10", "27.01.0", "26.10.0-rc.1", "26.10.2-rc.3", "26.10.1-dev.abc1234", "26.10.31-dev.abc1234",
	} {
		Version = value
		require.NoError(t, Validate(), value)
	}
	for _, value := range []string{
		"dev", "manual-abc123", "v26.09.0", "0.31.0", "26.09", "26.9.0", "26.00.0", "26.13.0", "26.09.01", "26.09-rc.1",
		"26.09.0-rc.0", "26.09.1-dev", "26.09.1-dev.abc", "26.09.1-dev.ABC1234", "26.09.01-dev.abc1234", "26.09.1-dirty",
	} {
		Version = value
		require.ErrorContains(t, Validate(), "invalid build version", value)
	}
	Version = ""
	require.ErrorContains(t, Validate(), "-buildvcs=true")
}
