package version

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetLatestVersion(t *testing.T) {
	_, err := NewRunner(nil, nil).GetLatestVersion()
	require.NoError(t, err)
}
