package test

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/fieldmaskpb"
	"google.golang.org/protobuf/types/known/timestamppb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

func addSession(ctx context.Context, t *testing.T, ts *TestService, userID int32, tokenID string) {
	t.Helper()
	require.NoError(t, ts.Store.AddUserRefreshToken(ctx, userID, &storepb.RefreshTokensUserSetting_RefreshToken{
		TokenId: tokenID, CreatedAt: timestamppb.Now(),
	}))
}

func sessionIDs(ctx context.Context, t *testing.T, ts *TestService, userID int32) []string {
	t.Helper()
	tokens, err := ts.Store.GetUserRefreshTokens(ctx, userID)
	require.NoError(t, err)
	ids := make([]string, 0, len(tokens))
	for _, token := range tokens {
		ids = append(ids, token.TokenId)
	}
	return ids
}

func changePassword(ctx context.Context, ts *TestService, user *store.User, password string) error {
	_, err := ts.Service.UpdateUser(ctx, &v1pb.UpdateUserRequest{
		User:       &v1pb.User{Name: "users/" + user.Username, Password: password},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"password"}},
	})
	return err
}

// Changing a password ends every other session of the account; the browser
// session that made the change keeps working.
func TestUpdateUserPasswordRevokesOtherSessions(t *testing.T) {
	ts := NewTestService(t)
	defer ts.Cleanup()
	ctx := context.Background()
	user, err := ts.CreateRegularUser(ctx, "rotator")
	require.NoError(t, err)
	addSession(ctx, t, ts, user.ID, "current-browser")
	addSession(ctx, t, ts, user.ID, "stolen-session")
	addSession(ctx, t, ts, user.ID, "old-phone")

	refreshToken, _, err := auth.GenerateRefreshToken(user.ID, "current-browser", []byte(ts.Service.Secret))
	require.NoError(t, err)
	userCtx := metadata.NewIncomingContext(ts.CreateUserContext(ctx, user.ID), metadata.Pairs("cookie", auth.RefreshTokenCookieName+"="+refreshToken))

	require.NoError(t, changePassword(userCtx, ts, user, "new-password"))
	require.Equal(t, []string{"current-browser"}, sessionIDs(ctx, t, ts, user.ID))

	// Without a refresh cookie (an API token caller) every session is revoked.
	addSession(ctx, t, ts, user.ID, "another")
	require.NoError(t, changePassword(ts.CreateUserContext(ctx, user.ID), ts, user, "newer-password"))
	require.Empty(t, sessionIDs(ctx, t, ts, user.ID))
}

// An administrator resetting another account's password revokes all of that
// account's sessions, never the administrator's own.
func TestAdminPasswordResetRevokesTargetSessions(t *testing.T) {
	ts := NewTestService(t)
	defer ts.Cleanup()
	ctx := context.Background()
	admin, err := ts.CreateHostUser(ctx, "admin")
	require.NoError(t, err)
	target, err := ts.CreateRegularUser(ctx, "target")
	require.NoError(t, err)
	addSession(ctx, t, ts, admin.ID, "admin-browser")
	addSession(ctx, t, ts, target.ID, "target-browser")

	adminToken, _, err := auth.GenerateRefreshToken(admin.ID, "admin-browser", []byte(ts.Service.Secret))
	require.NoError(t, err)
	adminCtx := metadata.NewIncomingContext(ts.CreateUserContext(ctx, admin.ID), metadata.Pairs("cookie", auth.RefreshTokenCookieName+"="+adminToken))

	require.NoError(t, changePassword(adminCtx, ts, target, "reset-by-admin"))
	require.Empty(t, sessionIDs(ctx, t, ts, target.ID))
	require.Equal(t, []string{"admin-browser"}, sessionIDs(ctx, t, ts, admin.ID))
}

// The avatar size limit the web client applies is enforced by the server too.
func TestUpdateUserAvatarSizeBoundedServerSide(t *testing.T) {
	ts := NewTestService(t)
	defer ts.Cleanup()
	ctx := context.Background()
	user, err := ts.CreateRegularUser(ctx, "avatar")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	oversized := "data:image/png;base64," + strings.Repeat("A", 3<<20)
	_, err = ts.Service.UpdateUser(userCtx, &v1pb.UpdateUserRequest{
		User:       &v1pb.User{Name: "users/" + user.Username, AvatarUrl: oversized},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"avatar_url"}},
	})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	require.Contains(t, err.Error(), "avatar exceeds")
}
