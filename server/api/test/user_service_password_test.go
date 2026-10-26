package test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/fieldmaskpb"
	"google.golang.org/protobuf/types/known/timestamppb"

	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/api"
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
	_, err := ts.Service.UpdateUser(ctx, &apipb.UpdateUserRequest{
		User:       &apipb.User{Name: "users/" + user.Username, Password: password},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"password"}},
	})
	return err
}

// Old access tokens must be rejected by both transports before they can change
// the password again, even while their JWT signature and expiry remain valid.
func TestPasswordChangeRejectsOldAccessToken(t *testing.T) {
	for _, transport := range []string{"REST", "Connect"} {
		t.Run(transport, func(t *testing.T) {
			ts := NewTestService(t)
			defer ts.Cleanup()
			ctx := context.Background()
			user, err := ts.CreateRegularUser(ctx, "password-victim")
			require.NoError(t, err)
			addSession(ctx, t, ts, user.ID, "owner-browser")
			addSession(ctx, t, ts, user.ID, "stolen-session")
			ownerRefresh, _, err := auth.GenerateRefreshToken(user.ID, "owner-browser", []byte(ts.Secret))
			require.NoError(t, err)
			stolenRefresh, _, err := auth.GenerateRefreshToken(user.ID, "stolen-session", []byte(ts.Secret))
			require.NoError(t, err)
			oldAccess, _, err := auth.GenerateAccessTokenV2(user.ID, user.Username, string(user.Role), string(user.RowStatus), user.PasswordHash, []byte(ts.Secret))
			require.NoError(t, err)
			authenticator := auth.NewAuthenticator(ts.Store, ts.Secret)
			require.NotNil(t, authenticator.Authenticate(ctx, "Bearer "+oldAccess))

			e := http.NewServeMux()
			apiHandler, handlerErr := ts.Service.NewHandler(ctx)
			require.NoError(t, handlerErr)
			e.Handle("/", apiHandler)
			updatePassword := func(password, cookie string) *httptest.ResponseRecorder {
				t.Helper()
				method, path := http.MethodPatch, "/api/users/password-victim?updateMask=password"
				body := `{"password":"` + password + `"}`
				if transport == "Connect" {
					method, path = http.MethodPost, "/memos.api.UserService/UpdateUser"
					body = `{"user":{"name":"users/password-victim","password":"` + password + `"},"updateMask":"password"}`
				}
				req := httptest.NewRequest(method, path, strings.NewReader(body))
				req.Header.Set("Content-Type", "application/json")
				req.Header.Set("Authorization", "Bearer "+oldAccess)
				if cookie != "" {
					req.Header.Set("Cookie", auth.RefreshTokenCookieName+"="+cookie)
					if transport == "REST" {
						// Direct gRPC-Gateway calls pass service cookie metadata explicitly.
						req.Header.Set("Grpc-Metadata-Cookie", auth.RefreshTokenCookieName+"="+cookie)
					}
				}
				rec := httptest.NewRecorder()
				e.ServeHTTP(rec, req)
				return rec
			}

			rec := updatePassword("owner-new-password", ownerRefresh)
			require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
			// The token is still cryptographically valid; password revocation must
			// reject it without waiting for its 15-minute expiry.
			_, err = auth.ParseAccessTokenV2(oldAccess, []byte(ts.Secret))
			require.NoError(t, err)
			rec = updatePassword("attacker-password", "")
			require.Equal(t, http.StatusUnauthorized, rec.Code, rec.Body.String())
			require.Nil(t, authenticator.Authenticate(ctx, "Bearer "+oldAccess))
			resolved, err := authenticator.AuthenticateToUser(ctx, "Bearer "+oldAccess, "")
			require.NoError(t, err)
			require.Nil(t, resolved)
			updated, err := ts.Store.GetUser(ctx, &store.FindUser{ID: &user.ID})
			require.NoError(t, err)
			require.NoError(t, bcrypt.CompareHashAndPassword([]byte(updated.PasswordHash), []byte("owner-new-password")))
			_, _, err = authenticator.AuthenticateByRefreshToken(ctx, stolenRefresh)
			require.ErrorContains(t, err, "revoked")
			resolved, err = authenticator.AuthenticateToUser(ctx, "Bearer "+oldAccess, auth.RefreshTokenCookieName+"="+stolenRefresh)
			require.ErrorContains(t, err, "revoked")
			require.Nil(t, resolved)

			// The owner browser can refresh, and a fresh password sign-in also
			// issues an access token bound to the new password.
			refreshCtx := metadata.NewIncomingContext(api.WithHeaderCarrier(ctx), metadata.Pairs("cookie", auth.RefreshTokenCookieName+"="+ownerRefresh))
			refreshed, err := ts.Service.RefreshToken(refreshCtx, &apipb.RefreshTokenRequest{})
			require.NoError(t, err)
			require.NotNil(t, authenticator.Authenticate(ctx, "Bearer "+refreshed.AccessToken))
			signedIn, err := ts.Service.SignIn(api.WithHeaderCarrier(ctx), &apipb.SignInRequest{
				Credentials: &apipb.SignInRequest_PasswordCredentials_{PasswordCredentials: &apipb.SignInRequest_PasswordCredentials{
					Username: user.Username, Password: "owner-new-password",
				}},
			})
			require.NoError(t, err)
			require.NotNil(t, authenticator.Authenticate(ctx, "Bearer "+signedIn.AccessToken))
		})
	}
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
	adminAccess, _, err := auth.GenerateAccessTokenV2(admin.ID, admin.Username, string(admin.Role), string(admin.RowStatus), admin.PasswordHash, []byte(ts.Secret))
	require.NoError(t, err)
	targetAccess, _, err := auth.GenerateAccessTokenV2(target.ID, target.Username, string(target.Role), string(target.RowStatus), target.PasswordHash, []byte(ts.Secret))
	require.NoError(t, err)
	authenticator := auth.NewAuthenticator(ts.Store, ts.Secret)
	require.NotNil(t, authenticator.Authenticate(ctx, "Bearer "+targetAccess))

	adminToken, _, err := auth.GenerateRefreshToken(admin.ID, "admin-browser", []byte(ts.Service.Secret))
	require.NoError(t, err)
	adminCtx := metadata.NewIncomingContext(ts.CreateUserContext(ctx, admin.ID), metadata.Pairs("cookie", auth.RefreshTokenCookieName+"="+adminToken))

	require.NoError(t, changePassword(adminCtx, ts, target, "reset-by-admin"))
	require.Empty(t, sessionIDs(ctx, t, ts, target.ID))
	require.Equal(t, []string{"admin-browser"}, sessionIDs(ctx, t, ts, admin.ID))
	require.Nil(t, authenticator.Authenticate(ctx, "Bearer "+targetAccess))
	require.NotNil(t, authenticator.Authenticate(ctx, "Bearer "+adminAccess))
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
	_, err = ts.Service.UpdateUser(userCtx, &apipb.UpdateUserRequest{
		User:       &apipb.User{Name: "users/" + user.Username, AvatarUrl: oversized},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"avatar_url"}},
	})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	require.Contains(t, err.Error(), "avatar exceeds")
}
