package teststore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetCurrentSchemaVersion(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	currentSchemaVersion, err := ts.GetCurrentSchemaVersion()
	require.NoError(t, err)
	require.Equal(t, "0.25.1", currentSchemaVersion)
}
