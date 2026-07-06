package v1

import (
	"context"
	"errors"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

// ErrUnauthenticated is returned by the Authorizer when a request must be rejected
// for lack of valid credentials. Each transport maps it to its own status code
// (Connect: CodeUnauthenticated, gRPC-Gateway: HTTP 401).
var ErrUnauthenticated = errors.New("authentication required")

// Authorizer is the single source of truth for method-level access control.
//
// It authenticates a request from its Authorization header and decides whether the
// (possibly anonymous) caller may reach a given RPC procedure. The Connect
// interceptor and the gRPC-Gateway middleware share one Authorizer so both
// transports enforce identical rules.
//
// Role-based authorization (admin checks) stays in the service layer; this type
// governs only authentication and anonymous access.
type Authorizer struct {
	authenticator *auth.Authenticator
	store         *store.Store
	profile       *profile.Profile
}

// NewAuthorizer creates an Authorizer backed by the given store, token secret, and
// instance profile.
func NewAuthorizer(store *store.Store, secret string, profile *profile.Profile) *Authorizer {
	return &Authorizer{
		authenticator: auth.NewAuthenticator(store, secret),
		store:         store,
		profile:       profile,
	}
}

// Authenticate resolves the caller from the Authorization header, returning nil for
// an anonymous request. It never enforces policy — pair it with CheckAccess.
func (a *Authorizer) Authenticate(ctx context.Context, authHeader string) *auth.AuthResult {
	return a.authenticator.Authenticate(ctx, authHeader)
}

// CheckAccess enforces method-level access policy for procedure given the
// authentication result (nil = anonymous). It returns nil when the request is
// permitted and ErrUnauthenticated otherwise.
//
// Policy:
//   - Authenticated caller (access token or PAT): always permitted here.
//   - Anonymous + protected method: denied.
//   - Anonymous + public method, open instance: permitted.
//   - Anonymous + public method, private instance (no InstanceURL): permitted only
//     for the auth-bootstrap set, plus CreateUser during first-run setup.
func (a *Authorizer) CheckAccess(ctx context.Context, procedure string, result *auth.AuthResult) error {
	if result != nil {
		return nil
	}
	if !IsPublicMethod(procedure) {
		return ErrUnauthenticated
	}
	if a.profile.AllowAnonymous() || a.allowedOnPrivateInstance(ctx, procedure) {
		return nil
	}
	return ErrUnauthenticated
}

// allowedOnPrivateInstance reports whether an anonymous request to a public
// procedure is still permitted while the instance is private. It allows the
// auth-bootstrap set, plus CreateUser while the instance has no users yet
// (first-run admin setup).
func (a *Authorizer) allowedOnPrivateInstance(ctx context.Context, procedure string) bool {
	if IsAuthBootstrapMethod(procedure) {
		return true
	}
	if procedure == createUserProcedure {
		return a.noUsersExist(ctx)
	}
	return false
}

// noUsersExist reports whether the instance has no users yet (fresh install).
func (a *Authorizer) noUsersExist(ctx context.Context) bool {
	limitOne := 1
	users, err := a.store.ListUsers(ctx, &store.FindUser{Limit: &limitOne})
	return err == nil && len(users) == 0
}
