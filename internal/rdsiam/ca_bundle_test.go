package rdsiam

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/testutil"
)

func TestLoadCABundle(t *testing.T) {
	pool, err := LoadCABundle(testutil.WriteCACertificate(t))
	require.NoError(t, err)
	require.NotNil(t, pool)

	_, err = LoadCABundle(filepath.Join(t.TempDir(), "missing.pem"))
	require.Error(t, err)

	empty := filepath.Join(t.TempDir(), "empty.pem")
	require.NoError(t, os.WriteFile(empty, []byte("not a certificate"), 0600))
	_, err = LoadCABundle(empty)
	require.ErrorContains(t, err, "contains no PEM certificates")
}
