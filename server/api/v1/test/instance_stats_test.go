package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

func TestGetInstanceStats_HappyPath(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	admin, err := ts.CreateHostUser(ctx, "admin1")
	require.NoError(t, err)
	adminCtx := ts.CreateUserContext(ctx, admin.ID)

	resp, err := ts.Service.GetInstanceStats(adminCtx, &v1pb.GetInstanceStatsRequest{})
	require.NoError(t, err)
	require.NotNil(t, resp)

	require.NotNil(t, resp.Database)
	require.Equal(t, "sqlite", resp.Database.Driver)
	require.Greater(t, resp.Database.SizeBytes, int64(0))

	require.GreaterOrEqual(t, resp.LocalStorageBytes, int64(0))
}

func TestGetInstanceStats_NonAdminDenied(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	// Need an admin to exist (otherwise instance is uninitialized).
	admin, err := ts.CreateHostUser(ctx, "admin1")
	require.NoError(t, err)
	_ = admin

	regular, err := ts.CreateRegularUser(ctx, "alice")
	require.NoError(t, err)
	regularCtx := ts.CreateUserContext(ctx, regular.ID)

	_, err = ts.Service.GetInstanceStats(regularCtx, &v1pb.GetInstanceStatsRequest{})
	require.Error(t, err)
	st, ok := status.FromError(err)
	require.True(t, ok)
	require.Equal(t, codes.PermissionDenied, st.Code())
}

func TestGetInstanceStats_Cache(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	admin, err := ts.CreateHostUser(ctx, "admin1")
	require.NoError(t, err)
	adminCtx := ts.CreateUserContext(ctx, admin.ID)

	first, err := ts.Service.GetInstanceStats(adminCtx, &v1pb.GetInstanceStatsRequest{})
	require.NoError(t, err)

	second, err := ts.Service.GetInstanceStats(adminCtx, &v1pb.GetInstanceStatsRequest{})
	require.NoError(t, err)

	// Cache hit: same pointer (the cache returns the stored *InstanceStats directly).
	require.Same(t, first, second)
}
