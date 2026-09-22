package scripts

import (
	"os/exec"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestReleaseVersions(t *testing.T) {
	for _, tc := range []struct {
		tag, series, prerelease, images string
	}{
		{"26.09", "26.09", "false", "26.09\nstable\n"},
		{"26.09.1", "26.09", "false", "26.09.1\n26.09\nstable\n"},
		{"26.09.10", "26.09", "false", "26.09.10\n26.09\nstable\n"},
		{"26.10.1", "26.10", "false", "26.10.1\n26.10\nstable\n"},
		{"27.01", "27.01", "false", "27.01\nstable\n"},
		{"26.09-rc.1", "26.09", "true", "26.09-rc.1\n"},
		{"26.09.1-rc.2", "26.09", "true", "26.09.1-rc.2\n"},
	} {
		t.Run(tc.tag, func(t *testing.T) {
			out, err := exec.Command("bash", "release_version.sh", "version", tc.tag).CombinedOutput()
			require.NoError(t, err, string(out))
			require.Equal(t, "tag="+tc.tag+"\nversion="+tc.tag+"\nseries="+tc.series+"\nis_prerelease="+tc.prerelease+"\n", string(out))
			out, err = exec.Command("bash", "release_version.sh", "image-tags", tc.tag).CombinedOutput()
			require.NoError(t, err, string(out))
			require.Equal(t, tc.images, string(out))
		})
	}
	for _, tag := range []string{"v0.31.0", "v26.09", "v26.09.1", "v26.09-rc.1", "26.9", "26.00", "26.13", "2026.09", "26.09.0", "26.09.01", "26.09-rc.0", "26.09-rc.01", "26.09beta", "26.09.1+build"} {
		out, err := exec.Command("bash", "release_version.sh", "version", tag).CombinedOutput()
		require.Error(t, err, tag)
		require.Contains(t, string(out), "Unsupported release tag")
	}
}

func TestPreviousReleaseImage(t *testing.T) {
	repo := t.TempDir()
	runGit := func(args ...string) {
		t.Helper()
		cmd := exec.Command("git", append([]string{"-C", repo, "-c", "user.name=Release Test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false"}, args...)...)
		out, err := cmd.CombinedOutput()
		require.NoError(t, err, string(out))
	}
	check := func(want string) {
		t.Helper()
		out, err := exec.Command("bash", "release_version.sh", "previous-tag", repo).CombinedOutput()
		require.NoError(t, err, string(out))
		require.Equal(t, want+"\n", string(out))
		out, err = exec.Command("bash", "release_version.sh", "previous-image", repo).CombinedOutput()
		require.NoError(t, err, string(out))
		require.Equal(t, "neosmemo/memos:"+strings.TrimPrefix(want, "v")+"\n", string(out))
	}
	runGit("init", "-b", "main")
	runGit("commit", "--allow-empty", "-m", "old")
	runGit("tag", "v0.30.0")
	runGit("commit", "--allow-empty", "-m", "baseline")
	runGit("tag", "v0.31.0")
	runGit("commit", "--allow-empty", "-m", "first calendar release")
	runGit("tag", "26.09")
	check("v0.31.0")
	runGit("commit", "--allow-empty", "-m", "point release")
	runGit("tag", "26.09.2")
	check("26.09")
	runGit("commit", "--allow-empty", "-m", "tenth point release")
	runGit("tag", "26.09.10")
	runGit("tag", "99.99")
	runGit("commit", "--allow-empty", "-m", "release candidate")
	runGit("tag", "26.10-rc.1")
	check("26.09.10")
	runGit("commit", "--allow-empty", "-m", "after release candidate")
	check("26.09.10")
	runGit("checkout", "--orphan", "unrelated")
	runGit("commit", "--allow-empty", "-m", "unrelated release")
	runGit("tag", "29.01")
	runGit("checkout", "main")
	check("26.09.10")
	runGit("tag", "26.10")
	runGit("commit", "--allow-empty", "-m", "next year")
	runGit("tag", "27.01")
	check("26.10")
	// The floor excludes pre-baseline tags even if no supported release exists.
	repo = t.TempDir()
	runGit("init", "-b", "main")
	runGit("commit", "--allow-empty", "-m", "old")
	runGit("tag", "v0.30.0")
	runGit("commit", "--allow-empty", "-m", "candidate")
	for _, command := range []string{"previous-tag", "previous-image"} {
		out, err := exec.Command("bash", "release_version.sh", command, repo).CombinedOutput()
		require.Error(t, err, command)
		require.Contains(t, string(out), "No supported previous release found")
	}
}
