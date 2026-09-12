package test

import (
	"context"
	"errors"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"github.com/usememos/memos/internal/clientip"
	"github.com/usememos/memos/internal/ratelimit"
	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/server/auth"
	apiv1server "github.com/usememos/memos/server/router/api/v1"
	"github.com/usememos/memos/store"
)

// limitedPolicy returns the default table with one scope tightened.
func limitedPolicy(scope ratelimit.Scope, limit int) ratelimit.Policy {
	policy := ratelimit.DefaultPolicy()
	policy[scope] = ratelimit.Rule{Limit: limit, Window: time.Hour}
	return policy
}

func withClientIP(ctx context.Context, ip string) context.Context {
	return clientip.WithClientIP(ctx, ip)
}

func requireRateLimited(t *testing.T, err error, scope ratelimit.Scope) {
	t.Helper()
	st := status.Convert(err)
	require.Equal(t, codes.ResourceExhausted, st.Code(), "got %v", err)
	for _, detail := range st.Details() {
		if info, ok := detail.(*errdetails.ErrorInfo); ok {
			require.Equal(t, "RATE_LIMITED", info.Reason)
			require.Equal(t, string(scope), info.Metadata["scope"])
			retryAfter, err := strconv.Atoi(info.Metadata["retry_after_seconds"])
			require.NoError(t, err)
			require.Positive(t, retryAfter)
			return
		}
	}
	t.Fatalf("no ErrorInfo detail on %v", err)
}

func passwordSignIn(ctx context.Context, ts *TestService, username, password string) error {
	_, err := ts.Service.SignIn(apiv1server.WithHeaderCarrier(ctx), &apiv1.SignInRequest{
		Credentials: &apiv1.SignInRequest_PasswordCredentials_{
			PasswordCredentials: &apiv1.SignInRequest_PasswordCredentials{Username: username, Password: password},
		},
	})
	return err
}

func TestSignInRateLimits(t *testing.T) {
	ctx := withClientIP(context.Background(), "203.0.113.10")

	t.Run("failures count and the check precedes the credential check", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()
		ts.Service.RateLimiter = ratelimit.NewMemoryLimiter(limitedPolicy(ratelimit.ScopeSignInAccount, 2))
		createPasswordUser(ctx, t, ts, "alice", "correct-password")

		require.Equal(t, codes.InvalidArgument, status.Code(passwordSignIn(ctx, ts, "alice", "wrong")))
		require.Equal(t, codes.InvalidArgument, status.Code(passwordSignIn(ctx, ts, "alice", "wrong")))
		// The third attempt is refused even with the right password: the limit
		// is checked before the password is looked at.
		requireRateLimited(t, passwordSignIn(ctx, ts, "alice", "correct-password"), ratelimit.ScopeSignInAccount)
		// Another account is unaffected.
		createPasswordUser(ctx, t, ts, "bob", "bob-password")
		require.NoError(t, passwordSignIn(ctx, ts, "bob", "bob-password"))
	})

	t.Run("successes do not count", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()
		ts.Service.RateLimiter = ratelimit.NewMemoryLimiter(limitedPolicy(ratelimit.ScopeSignInAccount, 1))
		createPasswordUser(ctx, t, ts, "alice", "correct-password")
		for range 5 {
			require.NoError(t, passwordSignIn(ctx, ts, "alice", "correct-password"))
		}
	})

	t.Run("the account limit does not reveal whether the account exists", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()
		ts.Service.RateLimiter = ratelimit.NewMemoryLimiter(limitedPolicy(ratelimit.ScopeSignInAccount, 1))
		createPasswordUser(ctx, t, ts, "alice", "correct-password")

		require.Equal(t, codes.InvalidArgument, status.Code(passwordSignIn(ctx, ts, "alice", "wrong")))
		require.Equal(t, codes.InvalidArgument, status.Code(passwordSignIn(ctx, ts, "nobody", "wrong")))
		requireRateLimited(t, passwordSignIn(ctx, ts, "alice", "wrong"), ratelimit.ScopeSignInAccount)
		requireRateLimited(t, passwordSignIn(ctx, ts, "nobody", "wrong"), ratelimit.ScopeSignInAccount)
	})

	t.Run("the address limit is keyed by resolved address", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()
		ts.Service.RateLimiter = ratelimit.NewMemoryLimiter(limitedPolicy(ratelimit.ScopeSignInIP, 1))

		require.Equal(t, codes.InvalidArgument, status.Code(passwordSignIn(ctx, ts, "nobody", "wrong")))
		requireRateLimited(t, passwordSignIn(ctx, ts, "someone-else", "wrong"), ratelimit.ScopeSignInIP)
		other := withClientIP(context.Background(), "203.0.113.11")
		require.Equal(t, codes.InvalidArgument, status.Code(passwordSignIn(other, ts, "nobody", "wrong")))
	})

	t.Run("a nil limiter leaves sign-in unbounded", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()
		for range 20 {
			require.Equal(t, codes.InvalidArgument, status.Code(passwordSignIn(ctx, ts, "nobody", "wrong")))
		}
	})
}

func TestCreateUserRateLimits(t *testing.T) {
	ctx := withClientIP(context.Background(), "203.0.113.20")
	signup := func(ts *TestService, ctx context.Context, username string, validateOnly bool) error {
		_, err := ts.Service.CreateUser(ctx, &apiv1.CreateUserRequest{
			User:         &apiv1.User{Username: username, Password: "password123"},
			ValidateOnly: validateOnly,
		})
		return err
	}

	t.Run("self-service signup is bounded per address", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()
		_, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		ts.Service.RateLimiter = ratelimit.NewMemoryLimiter(limitedPolicy(ratelimit.ScopeSignupIP, 1))

		require.NoError(t, signup(ts, ctx, "first", false))
		requireRateLimited(t, signup(ts, ctx, "second", false), ratelimit.ScopeSignupIP)
		// validate_only has its own scope and is still allowed.
		require.NoError(t, signup(ts, ctx, "third", true))
		// Another address is unaffected.
		require.NoError(t, signup(ts, withClientIP(context.Background(), "203.0.113.21"), "fourth", false))
	})

	t.Run("admin creation is exempt", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()
		admin, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		ts.Service.RateLimiter = ratelimit.NewMemoryLimiter(limitedPolicy(ratelimit.ScopeSignupIP, 1))
		adminCtx := ts.CreateUserContext(ctx, admin.ID)
		for i := range 3 {
			require.NoError(t, signup(ts, adminCtx, "staff"+strconv.Itoa(i), false))
		}
	})

	t.Run("first user setup is exempt", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()
		limiter := ratelimit.NewMemoryLimiter(limitedPolicy(ratelimit.ScopeSignupIP, 1))
		ts.Service.RateLimiter = limiter
		require.NoError(t, signup(ts, ctx, "owner", false))
		require.Equal(t, 1, limiter.Allowed(ratelimit.ScopeSignupIP, "203.0.113.20", 1).Remaining, "setup did not spend the signup budget")
	})
}

type fakeChallenge struct {
	accept string
	seen   []string
}

func (*fakeChallenge) Provider() string { return "fake" }
func (*fakeChallenge) SiteKey() string  { return "site-key" }
func (c *fakeChallenge) Verify(_ context.Context, _ ratelimit.Scope, token string, clientIP string) error {
	c.seen = append(c.seen, clientIP)
	if token != c.accept {
		return errors.New("bad token")
	}
	return nil
}

func withChallengeToken(ctx context.Context, token string) context.Context {
	return metadata.NewIncomingContext(ctx, metadata.Pairs("challenge-token", token))
}

func requireChallengeRequired(t *testing.T, err error) {
	t.Helper()
	st := status.Convert(err)
	require.Equal(t, codes.FailedPrecondition, st.Code(), "got %v", err)
	require.Len(t, st.Details(), 1)
	info, ok := st.Details()[0].(*errdetails.ErrorInfo)
	require.True(t, ok)
	require.Equal(t, "CHALLENGE_REQUIRED", info.Reason)
}

func TestChallengeSeam(t *testing.T) {
	ctx := withClientIP(context.Background(), "203.0.113.30")

	t.Run("signup requires a valid token when configured", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()
		_, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		challenge := &fakeChallenge{accept: "good"}
		ts.Service.Challenge = challenge

		request := func(ctx context.Context) error {
			_, err := ts.Service.CreateUser(ctx, &apiv1.CreateUserRequest{User: &apiv1.User{Username: "newcomer", Password: "password123"}})
			return err
		}
		requireChallengeRequired(t, request(ctx))
		requireChallengeRequired(t, request(withChallengeToken(ctx, "bad")))
		require.NoError(t, request(withChallengeToken(ctx, "good")))
		require.Equal(t, []string{"203.0.113.30", "203.0.113.30"}, challenge.seen, "the resolver's address is handed to the verifier")

		profile, err := ts.Service.GetInstanceProfile(ctx, &apiv1.GetInstanceProfileRequest{})
		require.NoError(t, err)
		require.Equal(t, "fake", profile.GetChallenge().GetProvider())
		require.Equal(t, "site-key", profile.GetChallenge().GetSiteKey())
	})

	t.Run("password sign-in requires a valid token, SSO does not", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()
		createPasswordUser(ctx, t, ts, "alice", "correct-password")
		ts.Service.Challenge = &fakeChallenge{accept: "good"}

		requireChallengeRequired(t, passwordSignIn(ctx, ts, "alice", "correct-password"))
		require.NoError(t, passwordSignIn(withChallengeToken(ctx, "good"), ts, "alice", "correct-password"))
	})

	t.Run("admin creation skips the challenge", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()
		admin, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		ts.Service.Challenge = &fakeChallenge{accept: "good"}
		_, err = ts.Service.CreateUser(ts.CreateUserContext(ctx, admin.ID), &apiv1.CreateUserRequest{User: &apiv1.User{Username: "staff", Password: "password123"}})
		require.NoError(t, err)
	})

	t.Run("no challenge configured means no profile entry and no requirement", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()
		profile, err := ts.Service.GetInstanceProfile(ctx, &apiv1.GetInstanceProfileRequest{})
		require.NoError(t, err)
		require.Nil(t, profile.GetChallenge())
	})
}

type denyDomainPolicy struct{ domain string }

func (p denyDomainPolicy) AllowSignup(_ context.Context, email string, _ string) error {
	if len(email) > len(p.domain) && email[len(email)-len(p.domain):] == p.domain {
		return errors.New("addresses at " + p.domain + " are not accepted")
	}
	return nil
}

func TestSignupPolicySeam(t *testing.T) {
	ctx := withClientIP(context.Background(), "203.0.113.40")
	ts := NewTestService(t)
	defer ts.Cleanup()
	admin, err := ts.CreateHostUser(ctx, "admin")
	require.NoError(t, err)
	ts.Service.SignupPolicy = denyDomainPolicy{domain: "@blocked.example"}

	_, err = ts.Service.CreateUser(ctx, &apiv1.CreateUserRequest{User: &apiv1.User{Username: "spammer", Email: "Spam@Blocked.Example", Password: "password123"}})
	require.Equal(t, codes.PermissionDenied, status.Code(err))
	require.Contains(t, status.Convert(err).Message(), "blocked.example")

	_, err = ts.Service.CreateUser(ctx, &apiv1.CreateUserRequest{User: &apiv1.User{Username: "welcome", Email: "hi@allowed.example", Password: "password123"}})
	require.NoError(t, err)

	// The policy is consulted for self-service signups only.
	_, err = ts.Service.CreateUser(ts.CreateUserContext(ctx, admin.ID), &apiv1.CreateUserRequest{User: &apiv1.User{Username: "staff", Email: "staff@blocked.example", Password: "password123"}})
	require.NoError(t, err)
}

func TestLinkMetadataRateLimit(t *testing.T) {
	ctx := withClientIP(context.Background(), "203.0.113.50")
	ts := NewTestService(t)
	defer ts.Cleanup()
	limiter := ratelimit.NewMemoryLimiter(limitedPolicy(ratelimit.ScopeLinkMetadata, 2))
	ts.Service.RateLimiter = limiter

	// Three URLs exceed the budget of two, so the batch is refused before any
	// fetch: these hosts do not exist and would otherwise fail differently.
	_, err := ts.Service.BatchGetLinkMetadata(ctx, &apiv1.BatchGetLinkMetadataRequest{Urls: []string{
		"http://a.invalid/", "http://b.invalid/", "http://c.invalid/",
	}})
	requireRateLimited(t, err, ratelimit.ScopeLinkMetadata)
	require.Equal(t, 2, limiter.Allowed(ratelimit.ScopeLinkMetadata, "203.0.113.50", 1).Remaining, "a refused batch costs nothing")

	// An authenticated caller is keyed by user, not address: spending the
	// user's budget elsewhere refuses them while the address stays untouched.
	user, err := ts.CreateRegularUser(ctx, "reader")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)
	limiter.Hit(ratelimit.ScopeLinkMetadata, strconv.Itoa(int(user.ID)), 2)
	_, err = ts.Service.GetLinkMetadata(userCtx, &apiv1.GetLinkMetadataRequest{Url: "http://a.invalid/"})
	requireRateLimited(t, err, ratelimit.ScopeLinkMetadata)
	require.Equal(t, 2, limiter.Allowed(ratelimit.ScopeLinkMetadata, "203.0.113.50", 1).Remaining)
}

func TestWriteAndUploadBudgets(t *testing.T) {
	ctx := withClientIP(context.Background(), "203.0.113.60")
	ts := NewTestService(t)
	defer ts.Cleanup()
	ts.Service.RateLimiter = ratelimit.NewMemoryLimiter(limitedPolicy(ratelimit.ScopeWriteUser, 2))
	user, err := ts.CreateRegularUser(ctx, "writer")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	createMemo := func(content string) error {
		_, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{Memo: &apiv1.Memo{Content: content, Visibility: apiv1.Visibility_PRIVATE}})
		return err
	}
	require.NoError(t, createMemo("one"))
	require.NoError(t, createMemo("two"))
	requireRateLimited(t, createMemo("three"), ratelimit.ScopeWriteUser)

	// Another user has their own budget.
	other, err := ts.CreateRegularUser(ctx, "other")
	require.NoError(t, err)
	_, err = ts.Service.CreateMemo(ts.CreateUserContext(ctx, other.ID), &apiv1.CreateMemoRequest{Memo: &apiv1.Memo{Content: "hi", Visibility: apiv1.Visibility_PRIVATE}})
	require.NoError(t, err)
}

func TestAuthorizerBudgets(t *testing.T) {
	ctx := withClientIP(context.Background(), "203.0.113.70")
	ts := NewTestService(t)
	defer ts.Cleanup()
	policy := ratelimit.DefaultPolicy()
	policy[ratelimit.ScopeAnonymous] = ratelimit.Rule{Limit: 2, Window: time.Hour}
	policy[ratelimit.ScopeAuthenticated] = ratelimit.Rule{Limit: 3, Window: time.Hour}
	limiter := ratelimit.NewMemoryLimiter(policy)
	authorizer := apiv1server.NewAuthorizer(ts.Store, ts.Secret).WithRateLimiter(limiter)
	const procedure = "/memos.api.v1.MemoService/ListMemos"

	// Anonymous callers share a budget per address.
	require.NoError(t, authorizer.Throttle(ctx, procedure, nil))
	require.NoError(t, authorizer.Throttle(ctx, procedure, nil))
	requireRateLimited(t, authorizer.Throttle(ctx, procedure, nil), ratelimit.ScopeAnonymous)
	require.NoError(t, authorizer.Throttle(withClientIP(context.Background(), "203.0.113.71"), procedure, nil))

	// Authenticated callers are keyed by user, whether the identity came from
	// access-token claims or from a personal access token.
	claims := &auth.AuthResult{Claims: &auth.UserClaims{UserID: 7}}
	pat := &auth.AuthResult{User: &store.User{ID: 7}}
	require.NoError(t, authorizer.Throttle(ctx, procedure, claims))
	require.NoError(t, authorizer.Throttle(ctx, procedure, pat))
	require.NoError(t, authorizer.Throttle(ctx, procedure, claims))
	requireRateLimited(t, authorizer.Throttle(ctx, procedure, pat), ratelimit.ScopeAuthenticated)
	require.NoError(t, authorizer.Throttle(ctx, procedure, &auth.AuthResult{Claims: &auth.UserClaims{UserID: 8}}))

	// A request with no resolvable address is not counted rather than lumped together.
	require.NoError(t, authorizer.Throttle(context.Background(), procedure, nil))
	require.NoError(t, authorizer.Throttle(context.Background(), procedure, nil))
	require.NoError(t, authorizer.Throttle(context.Background(), procedure, nil))

	// Without a limiter nothing is bounded.
	unlimited := apiv1server.NewAuthorizer(ts.Store, ts.Secret)
	for range 10 {
		require.NoError(t, unlimited.Throttle(ctx, procedure, nil))
	}
}

func TestBatchRequestsCostTheirItemCount(t *testing.T) {
	ctx := withClientIP(context.Background(), "203.0.113.80")
	ts := NewTestService(t)
	defer ts.Cleanup()
	limiter := ratelimit.NewMemoryLimiter(ratelimit.DefaultPolicy())
	ts.Service.RateLimiter = limiter
	user, err := ts.CreateRegularUser(ctx, "batcher")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	before := limiter.Allowed(ratelimit.ScopeAuthenticated, strconv.Itoa(int(user.ID)), 1).Remaining
	_, err = ts.Service.BatchGetUsers(userCtx, &apiv1.BatchGetUsersRequest{Usernames: []string{"a", "b", "c", "d"}})
	require.NoError(t, err)
	after := limiter.Allowed(ratelimit.ScopeAuthenticated, strconv.Itoa(int(user.ID)), 1).Remaining
	require.Equal(t, 3, before-after, "the authorizer counts one; the handler adds the other three")
}

// createPasswordUser creates a user who can sign in with the given password.
func createPasswordUser(ctx context.Context, t *testing.T, ts *TestService, username, password string) *store.User {
	t.Helper()
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	require.NoError(t, err)
	user, err := ts.Store.CreateUser(ctx, &store.User{
		Username:     username,
		Role:         store.RoleUser,
		Email:        testEmailForUsername(username),
		PasswordHash: string(passwordHash),
	})
	require.NoError(t, err)
	return user
}
