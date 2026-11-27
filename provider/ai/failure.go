package ai

import (
	"context"
	stderrors "errors"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"github.com/anthropics/anthropic-sdk-go/v2"
	"github.com/openai/openai-go/v3"
	"github.com/pkg/errors"
	"google.golang.org/genai"
)

// FailureKind groups the ways a provider call fails by what an administrator
// does about it: fix the key, fix the model, top up, wait, or fix the URL.
type FailureKind string

const (
	// FailureAuth is a key the provider rejected, blocked, or gave no permission.
	FailureAuth FailureKind = "auth"
	// FailureNotFound is a model or endpoint path the provider does not have.
	FailureNotFound FailureKind = "not_found"
	// FailureQuota is exhausted credit or a spend limit. Waiting does not clear it.
	FailureQuota FailureKind = "quota"
	// FailureRateLimited is a request-rate refusal that clears by itself.
	FailureRateLimited FailureKind = "rate_limited"
	// FailureRejected is a request the provider refused, usually a model that does
	// not take this input or parameter.
	FailureRejected FailureKind = "rejected"
	// FailureUnreachable is a name, connection or TLS error before any response.
	FailureUnreachable FailureKind = "unreachable"
	// FailureTimeout is a call that outran its deadline.
	FailureTimeout FailureKind = "timeout"
	// FailureRedirected is a redirect, which provider calls never follow.
	FailureRedirected FailureKind = "redirected"
	// FailureServer is a provider-side error (5xx).
	FailureServer FailureKind = "server"
	// FailureResponse is a response that arrived but cannot be used.
	FailureResponse FailureKind = "response"
)

// ErrUnusableResponse marks a provider response this package rejected. Errors
// that wrap it carry text written here, so their message is safe to log.
var ErrUnusableResponse = errors.New("unusable provider response")

// Failure is a provider error reduced to fields that are safe to show and log.
//
// Provider error bodies are attacker-influenced (the endpoint is configurable)
// and echo key fragments, and the SDK error strings embed them along with the
// request URL. Nothing here carries that free text: only the HTTP status, a
// shape-checked machine code, and, when no response arrived, the local
// transport error.
type Failure struct {
	Kind FailureKind
	// Status is the upstream HTTP status, or 0 when no response arrived.
	Status int
	// Code is the provider's machine-readable error code, such as
	// "insufficient_quota" or "API_KEY_INVALID". Empty when absent or malformed.
	Code string
	// RequestID is the provider's request ID, for a support request.
	RequestID string
	// Detail is local error text for a failure without a provider-written body.
	Detail string
}

// ClassifyFailure reduces an error from a provider call to a Failure.
func ClassifyFailure(err error) Failure {
	if e, ok := stderrors.AsType[*openai.Error](err); ok {
		failure := Failure{Kind: openAIFailureKind(e), Status: e.StatusCode, Code: token(e.Code)}
		if failure.Code == "" {
			failure.Code = token(e.Type)
		}
		if e.Response != nil {
			failure.RequestID = token(e.Response.Header.Get("x-request-id"))
		}
		return failure
	}
	if e, ok := stderrors.AsType[*anthropic.Error](err); ok {
		code := token(string(e.Type()))
		return Failure{Kind: anthropicFailureKind(e.StatusCode, code), Status: e.StatusCode, Code: code, RequestID: token(e.RequestID)}
	}
	if e, ok := stderrors.AsType[genai.APIError](err); ok {
		reason := geminiErrorReason(e)
		failure := Failure{Kind: geminiFailureKind(e, reason), Status: e.Code, Code: reason}
		if failure.Code == "" {
			failure.Code = token(e.Status)
		}
		return failure
	}

	// No provider response from here on, so the error text is local.
	failure := Failure{Detail: localText(err)}
	netErr, isNetErr := stderrors.AsType[net.Error](err)
	switch {
	case stderrors.Is(err, ErrRedirected):
		failure.Kind = FailureRedirected
	case stderrors.Is(err, context.DeadlineExceeded), isNetErr && netErr.Timeout():
		failure.Kind = FailureTimeout
	case isTransportError(err):
		failure.Kind = FailureUnreachable
	default:
		failure.Kind = FailureResponse
		if !stderrors.Is(err, ErrUnusableResponse) {
			// A decode error may quote the body it failed on.
			failure.Detail = ""
		}
	}
	return failure
}

// Codes that mean the account cannot pay for the request. OpenAI returns them
// with 429, the same status as a request-rate refusal.
var billingCodes = map[string]bool{
	"insufficient_quota":                true,
	"credit_balance_exhausted":          true,
	"organization_spend_limit_exceeded": true,
	"project_spend_limit_exceeded":      true,
	"organization_usage_limit_exceeded": true,
	"billing_hard_limit_reached":        true,
	"payment_required":                  true,
	"quota_exceeded":                    true,
	"BILLING_DISABLED":                  true,
	"RESOURCE_QUOTA_EXCEEDED":           true,
}

var keyCodes = map[string]bool{
	"invalid_api_key":      true,
	"wrong_api_key":        true,
	"authentication":       true,
	"authentication_error": true,
	"permission_denied":    true,
	"ACCESS_DENIED":        true,
	"CONSUMER_SUSPENDED":   true,
	"SERVICE_DISABLED":     true,
}

func openAIFailureKind(e *openai.Error) FailureKind {
	switch {
	case billingCodes[e.Code], billingCodes[e.Type]:
		return FailureQuota
	case keyCodes[e.Code], keyCodes[e.Type]:
		return FailureAuth
	case e.Code == "model_not_found":
		return FailureNotFound
	}
	return statusFailureKind(e.StatusCode)
}

// anthropicFailureKind maps an Anthropic error type. Overloaded (529) is the
// provider's state, as is a 5xx.
func anthropicFailureKind(status int, errorType string) FailureKind {
	switch errorType {
	case "authentication_error", "permission_error":
		return FailureAuth
	case "billing_error":
		return FailureQuota
	case "rate_limit_error":
		return FailureRateLimited
	case "not_found_error":
		return FailureNotFound
	case "overloaded_error", "api_error":
		return FailureServer
	}
	return statusFailureKind(status)
}

func geminiFailureKind(e genai.APIError, reason string) FailureKind {
	switch {
	// Before the status: a disabled billing account answers PERMISSION_DENIED.
	case billingCodes[reason]:
		return FailureQuota
	case reason == "RATE_LIMIT_EXCEEDED":
		return FailureRateLimited
	// A wrong Gemini key is HTTP 400 with this reason, not 401.
	case strings.HasPrefix(reason, "API_KEY_"), keyCodes[reason], e.Status == "UNAUTHENTICATED", e.Status == "PERMISSION_DENIED":
		return FailureAuth
	}
	return statusFailureKind(e.Code)
}

func statusFailureKind(status int) FailureKind {
	switch {
	case status == http.StatusUnauthorized, status == http.StatusForbidden:
		return FailureAuth
	case status == http.StatusPaymentRequired:
		return FailureQuota
	case status == http.StatusNotFound:
		return FailureNotFound
	case status == http.StatusTooManyRequests:
		return FailureRateLimited
	case status >= 300 && status < 400:
		return FailureRedirected
	case status >= 400 && status < 500:
		return FailureRejected
	case status >= 500:
		return FailureServer
	default:
		return FailureResponse
	}
}

// geminiErrorReason returns the google.rpc.ErrorInfo reason of a Gemini error.
func geminiErrorReason(e genai.APIError) string {
	for _, detail := range e.Details {
		if reason, ok := detail["reason"].(string); ok {
			if reason = token(reason); reason != "" {
				return reason
			}
		}
	}
	return ""
}

func isTransportError(err error) bool {
	if _, ok := stderrors.AsType[*url.Error](err); ok {
		return true
	}
	_, ok := stderrors.AsType[net.Error](err)
	return ok
}

var tokenPattern = regexp.MustCompile(`^[A-Za-z0-9_.:-]{1,64}$`)

// token returns a provider-supplied identifier only if it has the shape of
// one, so a field that carries prose or markup never reaches a log line.
func token(value string) string {
	if tokenPattern.MatchString(value) {
		return value
	}
	return ""
}

// localText flattens an error message to one bounded line.
func localText(err error) string {
	text := strings.Map(func(r rune) rune {
		if r < ' ' || r == 0x7f {
			return ' '
		}
		return r
	}, err.Error())
	const limit = 300
	if len(text) > limit {
		text = text[:limit]
	}
	return text
}
