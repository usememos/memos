package v1

import (
	"context"
	"log/slog"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/clientip"
	"github.com/usememos/memos/internal/ratelimit"
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
	limiter       ratelimit.Limiter
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

// WithRateLimiter enables the catch-all request budgets. A nil limiter leaves
// every request unbounded.
func (a *Authorizer) WithRateLimiter(limiter ratelimit.Limiter) *Authorizer {
	a.limiter = limiter
	return a
}

// Throttle enforces the catch-all budget for a request that CheckAccess has
// already permitted: the authenticated budget keyed by user, or the anonymous
// budget keyed by client address. Every request costs one unit; batch
// handlers add their item count afterwards. It returns a RESOURCE_EXHAUSTED
// status when the budget is spent.
func (a *Authorizer) Throttle(ctx context.Context, _ string, result *auth.AuthResult) error {
	if a.limiter == nil {
		return nil
	}
	scope, key := ratelimit.ScopeAnonymous, clientip.FromContext(ctx)
	switch {
	case result == nil:
	case result.Claims != nil:
		scope, key = ratelimit.ScopeAuthenticated, userKey(result.Claims.UserID)
	case result.User != nil:
		scope, key = ratelimit.ScopeAuthenticated, userKey(result.User.ID)
	default:
	}
	if key == "" {
		return nil
	}
	decision := a.limiter.Allowed(scope, key, 1)
	if !decision.Allowed {
		slog.Info("rate limit refused request", slog.String("scope", string(scope)), slog.String("key", key))
		return newRateLimitError(scope, decision)
	}
	a.limiter.Hit(scope, key, 1)
	return nil
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
