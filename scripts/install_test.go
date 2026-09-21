package scripts

import (
	"crypto/sha256"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestInstallCalendarRelease(t *testing.T) {
	for _, input := range []string{"26.09", "v26.09.1", "26.09-rc.1", ""} {
		t.Run("version="+input, func(t *testing.T) {
			dir := t.TempDir()
			mockBin := filepath.Join(dir, "bin")
			require.NoError(t, os.Mkdir(mockBin, 0755))
			version := strings.TrimPrefix(input, "v")
			if version == "" {
				version = "26.09.2"
			}
			writeExecutable(t, filepath.Join(dir, "memos"), "#!/bin/sh\nprintf '%s\\n' '"+version+"'\n")
			archive := filepath.Join(dir, "release.tar.gz")
			out, err := exec.Command("tar", "-czf", archive, "-C", dir, "memos").CombinedOutput()
			require.NoError(t, err, string(out))
			data, err := os.ReadFile(archive)
			require.NoError(t, err)
			asset := "memos_" + version + "_linux_amd64.tar.gz"
			require.NoError(t, os.WriteFile(filepath.Join(dir, "checksums.txt"), []byte(fmt.Sprintf("%x  %s\n", sha256.Sum256(data), asset)), 0644))
			writeExecutable(t, filepath.Join(mockBin, "uname"), "#!/bin/sh\ncase $1 in -s) echo Linux;; -m) echo x86_64;; esac\n")
			writeExecutable(t, filepath.Join(mockBin, "curl"), `#!/bin/sh
set -eu
url= dest=
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o) dest="$2"; shift 2;;
    -H) shift 2;;
    -*) shift;;
    *) url="$1"; shift;;
  esac
done
printf '%s\n' "$url" >> "$TEST_DOWNLOAD_LOG"
case "$url" in
  */releases/latest) printf '{"tag_name":"v%s"}\n' "$TEST_VERSION";;
  */checksums.txt) cp "$TEST_FIXTURE/checksums.txt" "$dest";;
  */memos_*.tar.gz) cp "$TEST_FIXTURE/release.tar.gz" "$dest";;
  *) exit 1;;
esac
`)
			args := []string{"install.sh", "--install-dir", filepath.Join(dir, "installed")}
			if input != "" {
				args = append(args, "--version", input)
			}
			cmd := exec.Command("sh", args...)
			logPath := filepath.Join(dir, "downloads.log")
			cmd.Env = append(os.Environ(), "PATH="+mockBin+string(os.PathListSeparator)+os.Getenv("PATH"), "TEST_FIXTURE="+dir,
				"TEST_VERSION="+version, "TEST_DOWNLOAD_LOG="+logPath, "MEMOS_VERSION=", "MEMOS_SKIP_CHECKSUM=0", "REPO=usememos/memos")
			out, err = cmd.CombinedOutput()
			require.NoError(t, err, string(out))
			log, err := os.ReadFile(logPath)
			require.NoError(t, err)
			require.Contains(t, string(log), "https://github.com/usememos/memos/releases/download/v"+version+"/"+asset)
			require.Contains(t, string(log), "/v"+version+"/checksums.txt")
			out, err = exec.Command(filepath.Join(dir, "installed", "memos")).CombinedOutput()
			require.NoError(t, err)
			require.Equal(t, version+"\n", string(out))
		})
	}
}
