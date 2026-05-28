package v1

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestWalkLocalStorage_SumsFileSizes(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, "a.txt"), []byte("hello"), 0o600))  // 5
	require.NoError(t, os.WriteFile(filepath.Join(dir, "b.txt"), []byte("world!"), 0o600)) // 6
	sub := filepath.Join(dir, "sub")
	require.NoError(t, os.Mkdir(sub, 0o700))
	require.NoError(t, os.WriteFile(filepath.Join(sub, "c.txt"), []byte("xx"), 0o600)) // 2

	size, err := walkLocalStorage(dir)
	require.NoError(t, err)
	require.Equal(t, int64(13), size)
}

func TestWalkLocalStorage_EmptyDir(t *testing.T) {
	size, err := walkLocalStorage("")
	require.Error(t, err)
	require.Equal(t, int64(-1), size)
}

func TestWalkLocalStorage_NonexistentDir(t *testing.T) {
	size, err := walkLocalStorage(filepath.Join(t.TempDir(), "does-not-exist"))
	require.Error(t, err)
	require.Equal(t, int64(-1), size)
}
