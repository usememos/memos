package teststore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/usememos/memos/server/version"
)

func TestGetCurrentSchemaVersion(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	currentSchemaVersion, err := ts.GetCurrentSchemaVersion()
	require.NoError(t, err)
	require.Equal(t, version.Version, currentSchemaVersion)
}
