package scripts

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestEntrypointDoesNotLoopWhenTargetUIDIsRoot(t *testing.T) {
	mockBin := t.TempDir()
	writeExecutable(t, filepath.Join(mockBin, "id"), "#!/bin/sh\nprintf '0\\n'\n")
	writeExecutable(t, filepath.Join(mockBin, "chown"), "#!/bin/sh\nexit 0\n")
	writeExecutable(t, filepath.Join(mockBin, "su-exec"), "#!/bin/sh\nshift\nexec \"$@\"\n")

	_, currentFile, _, ok := runtime.Caller(0)
	require.True(t, ok)
	entrypoint := filepath.Join(filepath.Dir(currentFile), "entrypoint.sh")

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "sh", entrypoint, "sh", "-c", "printf 'started-once'")
	cmd.Env = append(os.Environ(),
		"PATH="+mockBin+string(os.PathListSeparator)+os.Getenv("PATH"),
		"MEMOS_UID=0",
		"MEMOS_GID=0",
	)

	output, err := cmd.CombinedOutput()
	require.NoError(t, err, string(output))
	require.NotEqual(t, context.DeadlineExceeded, ctx.Err(), "entrypoint recursed instead of launching the command")
	require.Contains(t, string(output), "memos: starting as UID:GID 0:0")
	require.Equal(t, 1, strings.Count(string(output), "memos: starting as UID:GID 0:0"))
	require.Contains(t, string(output), "started-once")
}

func writeExecutable(t *testing.T, path, content string) {
	t.Helper()
	require.NoError(t, os.WriteFile(path, []byte(content), 0755))
}
