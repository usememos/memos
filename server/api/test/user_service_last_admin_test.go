package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	apipb "github.com/usememos/memos/proto/gen/api"
	"github.com/usememos/memos/server/api"
)

func TestLastInstanceAdminCannotRemoveThemselves(t *testing.T) {
	t.Parallel()

	ts := NewTestService(t)
	defer ts.Cleanup()

	ctx := context.Background()
	admin, err := ts.CreateHostUser(ctx, "last-admin")
	require.NoError(t, err)
	adminCtx := ts.CreateUserContext(api.WithHeaderCarrier(ctx), admin.ID)
	name := api.BuildUserName(admin.Username)

	for field, user := range map[string]*apipb.User{
		"state": {Name: name, State: apipb.State_ARCHIVED},
		"role":  {Name: name, Role: apipb.User_USER},
	} {
		_, err = ts.Service.UpdateUser(adminCtx, &apipb.UpdateUserRequest{User: user, UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{field}}})
		require.Equal(t, codes.FailedPrecondition, status.Code(err), field)
	}
	_, err = ts.Service.DeleteUser(adminCtx, &apipb.DeleteUserRequest{Name: name})
	require.Equal(t, codes.FailedPrecondition, status.Code(err))

	_, err = ts.CreateHostUser(ctx, "next-admin")
	require.NoError(t, err)
	_, err = ts.Service.DeleteUser(adminCtx, &apipb.DeleteUserRequest{Name: name})
	require.NoError(t, err)
}
