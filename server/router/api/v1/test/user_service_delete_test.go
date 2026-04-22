package test

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/timestamppb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	apiv1 "github.com/usememos/memos/server/router/api/v1"
	"github.com/usememos/memos/store"
)

func TestDeleteUserSelfDeleteCleansAccountDataAndAuthCookies(t *testing.T) {
	t.Parallel()

	ts := NewTestService(t)
	defer ts.Cleanup()

	ctx := context.Background()
	user, err := ts.CreateRegularUser(ctx, "alice")
	require.NoError(t, err)

	_, err = ts.Store.CreateUserIdentity(ctx, &store.UserIdentity{
		UserID:    user.ID,
		Provider:  "google",
		ExternUID: "alice-google-sub",
	})
	require.NoError(t, err)

	err = ts.Store.AddUserRefreshToken(ctx, user.ID, &storepb.RefreshTokensUserSetting_RefreshToken{
		TokenId:   "refresh-token-id",
		ExpiresAt: timestamppb.New(time.Now().Add(time.Hour)),
		CreatedAt: timestamppb.Now(),
	})
	require.NoError(t, err)

	headerCtx := apiv1.WithHeaderCarrier(ctx)
	authCtx := ts.CreateUserContext(headerCtx, user.ID)
	_, err = ts.Service.DeleteUser(authCtx, &v1pb.DeleteUserRequest{
		Name: apiv1.BuildUserName(user.Username),
	})
	require.NoError(t, err)

	deletedUser, err := ts.Store.GetUser(ctx, &store.FindUser{ID: &user.ID})
	require.NoError(t, err)
	require.Nil(t, deletedUser)

	identities, err := ts.Store.ListUserIdentities(ctx, &store.FindUserIdentity{UserID: &user.ID})
	require.NoError(t, err)
	require.Empty(t, identities)

	refreshSetting, err := ts.Store.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &user.ID,
		Key:    storepb.UserSetting_REFRESH_TOKENS,
	})
	require.NoError(t, err)
	require.Nil(t, refreshSetting)

	carrier := apiv1.GetHeaderCarrier(authCtx)
	require.NotNil(t, carrier)
	require.Contains(t, strings.ToLower(carrier.Get("Set-Cookie")), "memos_refresh=")
}
