package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func TestUserServiceUniqueEmail(t *testing.T) {
	ctx := context.Background()

	newAdminContext := func(t *testing.T, ts *TestService) context.Context {
		t.Helper()
		admin, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		return ts.CreateUserContext(ctx, admin.ID)
	}

	t.Run("CreateUser stores the canonical form", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()
		adminCtx := newAdminContext(t, ts)

		created, err := ts.Service.CreateUser(adminCtx, &apiv1.CreateUserRequest{
			User: &apiv1.User{Username: "bob", Email: "  Bob@Example.COM ", Password: "password123"},
		})
		require.NoError(t, err)
		require.Equal(t, "bob@example.com", created.Email)
	})

	t.Run("CreateUser rejects a malformed address", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()
		adminCtx := newAdminContext(t, ts)

		for _, email := range []string{"not-an-address", "Bob <bob@example.com>", "bob@example.com@example.com"} {
			_, err := ts.Service.CreateUser(adminCtx, &apiv1.CreateUserRequest{
				User: &apiv1.User{Username: "bob", Email: email, Password: "password123"},
			})
			require.Equal(t, codes.InvalidArgument, status.Code(err), "email %q", email)
		}
	})

	t.Run("CreateUser refuses an address another account holds", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()
		adminCtx := newAdminContext(t, ts)

		_, err := ts.CreateRegularUser(ctx, "holder")
		require.NoError(t, err)

		_, err = ts.Service.CreateUser(adminCtx, &apiv1.CreateUserRequest{
			User: &apiv1.User{Username: "claimant", Email: "Holder@Example.com", Password: "password123"},
		})
		require.Equal(t, codes.AlreadyExists, status.Code(err))

		_, err = ts.Service.CreateUser(adminCtx, &apiv1.CreateUserRequest{
			User:         &apiv1.User{Username: "claimant", Email: "holder@example.com", Password: "password123"},
			ValidateOnly: true,
		})
		require.Equal(t, codes.AlreadyExists, status.Code(err), "validate_only gives the same answer")

		validated, err := ts.Service.CreateUser(adminCtx, &apiv1.CreateUserRequest{
			User:         &apiv1.User{Username: "claimant", Email: "Claimant@Example.com", Password: "password123"},
			ValidateOnly: true,
		})
		require.NoError(t, err)
		require.Equal(t, "claimant@example.com", validated.Email)
	})

	t.Run("first user setup applies the same rules", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		_, err := ts.Service.CreateUser(ctx, &apiv1.CreateUserRequest{
			User: &apiv1.User{Username: "owner", Email: "owner@example", Password: "password123"},
		})
		require.NoError(t, err, "a dotless domain is allowed")

		owner, err := ts.Store.GetUser(ctx, &store.FindUser{Username: func() *string { s := "owner"; return &s }()})
		require.NoError(t, err)
		require.Equal(t, store.RoleAdmin, owner.Role)
		require.Equal(t, "owner@example", owner.Email)
	})

	t.Run("UpdateUser enforces uniqueness and clears with an empty value", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		holder, err := ts.CreateRegularUser(ctx, "holder")
		require.NoError(t, err)
		mover, err := ts.CreateRegularUser(ctx, "mover")
		require.NoError(t, err)
		moverCtx := ts.CreateUserContext(ctx, mover.ID)

		update := func(email string) (*apiv1.User, error) {
			return ts.Service.UpdateUser(moverCtx, &apiv1.UpdateUserRequest{
				User:       &apiv1.User{Name: "users/mover", Email: email},
				UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"email"}},
			})
		}

		_, err = update("HOLDER@example.com")
		require.Equal(t, codes.AlreadyExists, status.Code(err))

		_, err = update("mover <mover@example.com>")
		require.Equal(t, codes.InvalidArgument, status.Code(err))

		updated, err := update(" Mover.New@Example.com ")
		require.NoError(t, err)
		require.Equal(t, "mover.new@example.com", updated.Email)

		cleared, err := update("")
		require.NoError(t, err)
		require.Equal(t, "", cleared.Email)

		// The holder's address was never touched by any of the above.
		reloaded, err := ts.Store.GetUser(ctx, &store.FindUser{ID: &holder.ID})
		require.NoError(t, err)
		require.Equal(t, "holder@example.com", reloaded.Email)
	})
}

func TestSSOSignInEmailHandling(t *testing.T) {
	ctx := context.Background()

	t.Run("stores the canonical form of the provider address", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		mockIDP := newMockOAuthServer(t, "valid-code", "valid-token", map[string]any{
			"sub":   "carol",
			"name":  "Carol",
			"email": " Carol@Example.COM ",
		})
		defer mockIDP.Close()

		idpName := createTestingOAuthIdentityProvider(ctx, t, ts, mockIDP.URL, "email-canonical")
		response, err := signInWithTestingSSO(ctx, ts, idpName, "valid-code")
		require.NoError(t, err)
		require.Equal(t, "carol", response.User.Username)
		require.Equal(t, "carol@example.com", response.User.Email)
	})

	t.Run("provisions without an address when another account holds it", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		holder, err := ts.CreateRegularUser(ctx, "holder")
		require.NoError(t, err)

		mockIDP := newMockOAuthServer(t, "valid-code", "valid-token", map[string]any{
			"sub":   "holder-sso",
			"name":  "Holder Via SSO",
			"email": "Holder@Example.com",
		})
		defer mockIDP.Close()

		idpName := createTestingOAuthIdentityProvider(ctx, t, ts, mockIDP.URL, "email-collision")
		response, err := signInWithTestingSSO(ctx, ts, idpName, "valid-code")
		require.NoError(t, err)
		require.Equal(t, "holder-sso", response.User.Username)
		require.Equal(t, "", response.User.Email, "the address is dropped, never the account")
		require.NotEqual(t, holder.Username, response.User.Username)

		// The identity is linked to the new account only; the holder is untouched.
		assertSingleSSOLink(ctx, t, ts, "email-collision", "holder-sso", "holder-sso")
		holderIdentities, err := ts.Store.ListUserIdentities(ctx, &store.FindUserIdentity{UserID: &holder.ID})
		require.NoError(t, err)
		require.Empty(t, holderIdentities)
		reloaded, err := ts.Store.GetUser(ctx, &store.FindUser{ID: &holder.ID})
		require.NoError(t, err)
		require.Equal(t, "holder@example.com", reloaded.Email)
	})

	t.Run("provisions without an address when the provider address is malformed", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		mockIDP := newMockOAuthServer(t, "valid-code", "valid-token", map[string]any{
			"sub":   "dave",
			"name":  "Dave",
			"email": "Dave <dave@example.com>",
		})
		defer mockIDP.Close()

		idpName := createTestingOAuthIdentityProvider(ctx, t, ts, mockIDP.URL, "email-malformed")
		response, err := signInWithTestingSSO(ctx, ts, idpName, "valid-code")
		require.NoError(t, err)
		require.Equal(t, "dave", response.User.Username)
		require.Equal(t, "", response.User.Email)
	})
}
