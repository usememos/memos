package v1

import (
	"context"

	"github.com/pkg/errors"

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
	accessStore   anonymousAccessStore
}

type anonymousAccessStore interface {
	AllowsAnonymousAccess(ctx context.Context) (bool, error)
}

// NewAuthorizer creates an Authorizer backed by the given store and token secret.
func NewAuthorizer(store *store.Store, secret string) *Authorizer {
	return &Authorizer{
		authenticator: auth.NewAuthenticator(store, secret),
		accessStore:   store,
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
//   - Anonymous + auth-bootstrap method: permitted on every instance.
//   - Anonymous + other public method: permitted only when the stored access mode
//     is PUBLIC.
func (a *Authorizer) CheckAccess(ctx context.Context, procedure string, result *auth.AuthResult) error {
	if result != nil {
		return nil
	}
	if !IsPublicMethod(procedure) {
		return ErrUnauthenticated
	}
	if IsAuthBootstrapMethod(procedure) {
		return nil
	}
	allowsAnonymous, err := a.accessStore.AllowsAnonymousAccess(ctx)
	if err != nil {
		return errors.Wrap(err, "failed to resolve instance access policy")
	}
	if allowsAnonymous {
		return nil
	}
	return ErrUnauthenticated
}
