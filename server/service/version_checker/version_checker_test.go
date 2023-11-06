package versionchecker

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetLatestVersion(t *testing.T) {
	_, err := NewVersionChecker(nil).GetLatestVersion()
	require.NoError(t, err)
}
