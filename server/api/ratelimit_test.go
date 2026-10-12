package api

import (
	"strings"
	"testing"
	"time"

	"connectrpc.com/connect"
	"github.com/stretchr/testify/require"
	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/usememos/memos/internal/identifier"
	"github.com/usememos/memos/internal/ratelimit"
)

func refusedDecision() ratelimit.Decision {
	return ratelimit.Decision{
		Allowed:    false,
		Rule:       ratelimit.Rule{Limit: 10, Window: time.Minute},
		Remaining:  0,
		RetryAfter: 42 * time.Second,
	}
}

func TestNewRateLimitErrorFollowsAIP193(t *testing.T) {
	err := newRateLimitError(ratelimit.ScopeSignInIP, refusedDecision())
	st := status.Convert(err)
	require.Equal(t, codes.ResourceExhausted, st.Code())
	require.Equal(t, rateLimitMessage, st.Message())

	var info *errdetails.ErrorInfo
	var retry *errdetails.RetryInfo
	for _, detail := range st.Details() {
		switch d := detail.(type) {
		case *errdetails.ErrorInfo:
			info = d
		case *errdetails.RetryInfo:
			retry = d
		default:
		}
	}
	require.NotNil(t, info, "ErrorInfo is mandatory")
	require.Equal(t, reasonRateLimited, info.Reason)
	require.Equal(t, errorInfoDomain, info.Domain)
	require.Equal(t, "signin_ip", info.Metadata["scope"])
	require.Equal(t, "42", info.Metadata["retry_after_seconds"])
	require.Equal(t, "10", info.Metadata["limit"])
	require.Equal(t, "60", info.Metadata["window_seconds"])
	require.Equal(t, "0", info.Metadata["remaining"])
	require.NotNil(t, retry, "a throttle carries RetryInfo so AIP-194 clients know it recovers")
	require.Equal(t, 42*time.Second, retry.RetryDelay.AsDuration())
}

func TestRateLimitHTTPHeaders(t *testing.T) {
	header := rateLimitHTTPHeaders(status.Convert(newRateLimitError(ratelimit.ScopeAnonymous, refusedDecision())))
	require.Equal(t, "42", header.Get("Retry-After"))
	require.Equal(t, `"anonymous";r=0;t=42`, header.Get("RateLimit"))
	require.Equal(t, `"anonymous";q=10;w=60`, header.Get("RateLimit-Policy"))

	require.Nil(t, rateLimitHTTPHeaders(status.New(codes.ResourceExhausted, "quota")), "a refusal without the reason carries no rate-limit fields")
	require.Nil(t, rateLimitHTTPHeaders(status.New(codes.InvalidArgument, "x")))
}

func TestConvertGRPCErrorCarriesDetailsAndHeaders(t *testing.T) {
	err := convertGRPCError(newRateLimitError(ratelimit.ScopeAnonymous, refusedDecision()))
	connectErr, ok := err.(*connect.Error)
	require.True(t, ok)
	require.Equal(t, connect.CodeResourceExhausted, connectErr.Code())
	require.Equal(t, "42", connectErr.Meta().Get("Retry-After"))
	require.Equal(t, `"anonymous";r=0;t=42`, connectErr.Meta().Get("RateLimit"))

	types := []string{}
	for _, detail := range connectErr.Details() {
		types = append(types, detail.Type())
	}
	require.ElementsMatch(t, []string{"google.rpc.ErrorInfo", "google.rpc.RetryInfo"}, types)
}

func TestNewChallengeRequiredError(t *testing.T) {
	st := status.Convert(newChallengeRequiredError("challenge token is required"))
	require.Equal(t, codes.FailedPrecondition, st.Code())
	require.Len(t, st.Details(), 1)
	info, ok := st.Details()[0].(*errdetails.ErrorInfo)
	require.True(t, ok)
	require.Equal(t, reasonChallengeRequired, info.Reason)
	require.Nil(t, rateLimitHTTPHeaders(st))
}

func TestAccountKeyBoundsLength(t *testing.T) {
	require.Equal(t, "alice", accountKey("alice"))
	long := strings.Repeat("a", identifier.MaxUsernameLength+1)
	key := accountKey(long)
	require.True(t, strings.HasPrefix(key, "sha256:"))
	require.Len(t, key, len("sha256:")+64)
	// Distinct submissions stay distinct; the same submission maps to one key.
	require.NotEqual(t, key, accountKey(long+"b"))
	require.Equal(t, key, accountKey(long))
}

// recordingLimiter allows every request and records the keys it is given.
type recordingLimiter struct {
	consumed map[ratelimit.Scope][]string
	refunded map[ratelimit.Scope][]string
}

func (l *recordingLimiter) Consume(scope ratelimit.Scope, key string, _ int) ratelimit.Decision {
	l.consumed[scope] = append(l.consumed[scope], key)
	return ratelimit.Decision{Allowed: true}
}

func (l *recordingLimiter) Refund(scope ratelimit.Scope, key string, _ int) {
	l.refunded[scope] = append(l.refunded[scope], key)
}

func (*recordingLimiter) Allowed(ratelimit.Scope, string, int) ratelimit.Decision {
	return ratelimit.Decision{Allowed: true}
}

func (*recordingLimiter) Hit(ratelimit.Scope, string, int) {}

func TestReserveSignInChargesAndRefundsBoundedAccountKey(t *testing.T) {
	limiter := &recordingLimiter{consumed: map[ratelimit.Scope][]string{}, refunded: map[ratelimit.Scope][]string{}}
	s := &APIService{RateLimiter: limiter}
	long := strings.Repeat("a", identifier.MaxUsernameLength+1)

	attempt, err := s.reserveSignIn("192.0.2.1", long)
	require.NoError(t, err)
	attempt.succeeded()

	want := []string{accountKey(long)}
	require.Equal(t, want, limiter.consumed[ratelimit.ScopeSignInAccount], "the raw submission must not become a limiter key")
	require.Equal(t, want, limiter.refunded[ratelimit.ScopeSignInAccount], "the refund must return the unit that was charged")
}
