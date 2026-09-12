package v1

import (
	"context"
	"log/slog"
	"math"
	"net/http"
	"strconv"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/durationpb"

	"github.com/usememos/memos/internal/clientip"
	"github.com/usememos/memos/internal/ratelimit"
	"github.com/usememos/memos/server/auth"
)

const (
	// errorInfoDomain is the google.rpc.ErrorInfo domain for every reason this
	// service emits. AIP-193 requires it to be globally unique.
	errorInfoDomain = "memos.usememos.com"
	// reasonRateLimited marks a refusal that recovers on its own after the
	// advertised delay. Metering will use QUOTA_EXCEEDED for refusals that do not.
	reasonRateLimited = "RATE_LIMITED"
	// reasonChallengeRequired marks a request that must carry a valid challenge token.
	reasonChallengeRequired = "CHALLENGE_REQUIRED"

	rateLimitMessage = "too many requests, try again later"

	// challengeTokenHeader carries the proof-of-humanity token on the wire; both
	// transports forward it to metadata under challengeTokenMetadataKey.
	challengeTokenHeader      = "Challenge-Token"
	challengeTokenMetadataKey = "challenge-token"
)

// newRateLimitError builds the refusal described in docs/design/api-abuse-controls.md:
// RESOURCE_EXHAUSTED with an ErrorInfo naming the reason and scope and a RetryInfo
// carrying the delay, so an AIP-194 client knows this recovers in seconds.
func newRateLimitError(scope ratelimit.Scope, decision ratelimit.Decision) error {
	retryAfter := int(math.Ceil(decision.RetryAfter.Seconds()))
	if retryAfter < 1 {
		retryAfter = 1
	}
	st := status.New(codes.ResourceExhausted, rateLimitMessage)
	detailed, err := st.WithDetails(
		&errdetails.ErrorInfo{
			Reason: reasonRateLimited,
			Domain: errorInfoDomain,
			Metadata: map[string]string{
				"scope":               string(scope),
				"retry_after_seconds": strconv.Itoa(retryAfter),
				"limit":               strconv.Itoa(decision.Rule.Limit),
				"window_seconds":      strconv.Itoa(int(decision.Rule.Window.Seconds())),
				"remaining":           strconv.Itoa(decision.Remaining),
			},
		},
		&errdetails.RetryInfo{RetryDelay: durationpb.New(decision.RetryAfter)},
	)
	if err != nil {
		return st.Err()
	}
	return detailed.Err()
}

// newChallengeRequiredError builds the refusal for a missing or failed challenge
// token. It uses a different code from rate limiting so a client renders the
// widget instead of waiting.
func newChallengeRequiredError(message string) error {
	st := status.New(codes.FailedPrecondition, message)
	detailed, err := st.WithDetails(&errdetails.ErrorInfo{Reason: reasonChallengeRequired, Domain: errorInfoDomain})
	if err != nil {
		return st.Err()
	}
	return detailed.Err()
}

// rateLimitErrorInfo returns the ErrorInfo of a rate-limit refusal, or nil.
func rateLimitErrorInfo(st *status.Status) *errdetails.ErrorInfo {
	if st == nil || st.Code() != codes.ResourceExhausted {
		return nil
	}
	for _, detail := range st.Details() {
		if info, ok := detail.(*errdetails.ErrorInfo); ok && info.GetReason() == reasonRateLimited {
			return info
		}
	}
	return nil
}

// rateLimitHTTPHeaders derives the HTTP header fields for a rate-limit refusal:
// Retry-After, and the RateLimit and RateLimit-Policy structured fields from
// draft-ietf-httpapi-ratelimit-headers. It returns nil for any other error.
func rateLimitHTTPHeaders(st *status.Status) http.Header {
	info := rateLimitErrorInfo(st)
	if info == nil {
		return nil
	}
	meta := info.GetMetadata()
	header := http.Header{}
	header.Set("Retry-After", meta["retry_after_seconds"])
	header.Set("RateLimit", `"`+meta["scope"]+`";r=`+meta["remaining"]+";t="+meta["retry_after_seconds"])
	header.Set("RateLimit-Policy", `"`+meta["scope"]+`";q=`+meta["limit"]+";w="+meta["window_seconds"])
	return header
}

// callerBudget names the catch-all scope and key for the caller of ctx: the
// user id when authenticated, the client address otherwise.
func callerBudget(ctx context.Context) (ratelimit.Scope, string) {
	if userID := auth.GetUserID(ctx); userID != 0 {
		return ratelimit.ScopeAuthenticated, userKey(userID)
	}
	return ratelimit.ScopeAnonymous, clientip.FromContext(ctx)
}

// userKey is the limiter key for a per-user scope.
func userKey(userID int32) string {
	return strconv.Itoa(int(userID))
}

// throttle refuses the request when cost more units would exceed the rule for
// scope and key. It records nothing; pair it with charge.
func (s *APIV1Service) throttle(scope ratelimit.Scope, key string, cost int) error {
	if s.RateLimiter == nil || key == "" {
		return nil
	}
	decision := s.RateLimiter.Allowed(scope, key, cost)
	if decision.Allowed {
		return nil
	}
	slog.Info("rate limit refused request", slog.String("scope", string(scope)), slog.String("key", key))
	return newRateLimitError(scope, decision)
}

// charge records cost units against scope and key.
func (s *APIV1Service) charge(scope ratelimit.Scope, key string, cost int) {
	if s.RateLimiter == nil || key == "" {
		return
	}
	s.RateLimiter.Hit(scope, key, cost)
}

// throttleAndCharge is the common check-then-count for activities where every
// attempt counts.
func (s *APIV1Service) throttleAndCharge(scope ratelimit.Scope, key string, cost int) error {
	if err := s.throttle(scope, key, cost); err != nil {
		return err
	}
	s.charge(scope, key, cost)
	return nil
}

// chargeBatch adds the extra cost of a batch request to the caller's catch-all
// budget. The authorizer already counted the request once, so a batch of n
// items costs n in total.
func (s *APIV1Service) chargeBatch(ctx context.Context, items int) {
	if items <= 1 {
		return
	}
	scope, key := callerBudget(ctx)
	s.charge(scope, key, items-1)
}

// requireChallenge verifies the challenge token on the request when a
// challenge is configured. With no challenge configured it is a no-op.
func (s *APIV1Service) requireChallenge(ctx context.Context, scope ratelimit.Scope) error {
	if s.Challenge == nil {
		return nil
	}
	token := ""
	if md, ok := metadata.FromIncomingContext(ctx); ok {
		if values := md.Get(challengeTokenMetadataKey); len(values) > 0 {
			token = values[0]
		}
	}
	if token == "" {
		return newChallengeRequiredError("challenge token is required")
	}
	if err := s.Challenge.Verify(ctx, scope, token, clientip.FromContext(ctx)); err != nil {
		slog.Info("challenge verification failed", slog.String("scope", string(scope)), slog.String("error", err.Error()))
		return newChallengeRequiredError("challenge verification failed")
	}
	return nil
}

// recordSignInFailure counts one failed credential check against both sign-in scopes.
func (s *APIV1Service) recordSignInFailure(clientIP, username string) {
	s.charge(ratelimit.ScopeSignInIP, clientIP, 1)
	if username != "" {
		s.charge(ratelimit.ScopeSignInAccount, username, 1)
	}
}
