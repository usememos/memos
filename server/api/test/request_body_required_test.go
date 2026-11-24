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

// Requests without their resource body must be rejected as invalid instead of
// panicking on a nil dereference.
func TestRequestsWithoutResourceBodyAreInvalid(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "body-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	t.Run("CreateUserWebhook", func(t *testing.T) {
		_, err := ts.Service.CreateUserWebhook(userCtx, &apipb.CreateUserWebhookRequest{
			Parent: api.BuildUserName(user.Username),
		})
		require.Equal(t, codes.InvalidArgument, status.Code(err))
	})

	t.Run("UpdateAttachment", func(t *testing.T) {
		_, err := ts.Service.UpdateAttachment(userCtx, &apipb.UpdateAttachmentRequest{
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"filename"}},
		})
		require.Equal(t, codes.InvalidArgument, status.Code(err))
	})

	t.Run("UpdateUserSetting", func(t *testing.T) {
		_, err := ts.Service.UpdateUserSetting(userCtx, &apipb.UpdateUserSettingRequest{
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"general_setting"}},
		})
		require.Equal(t, codes.InvalidArgument, status.Code(err))
	})
}
