package api

import (
	"log/slog"
	"net/url"
	"strconv"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/usememos/memos/provider/ai"
)

// google.rpc.ErrorInfo reasons for a failed AI provider call, in errorInfoDomain.
// A client keys its own wording on the reason; the message is the English default.
const (
	reasonAIAuthFailed      = "AI_PROVIDER_AUTH_FAILED"
	reasonAIModelNotFound   = "AI_MODEL_NOT_FOUND"
	reasonAIQuotaExhausted  = "AI_PROVIDER_QUOTA_EXHAUSTED"
	reasonAIRateLimited     = "AI_PROVIDER_RATE_LIMITED"
	reasonAIRequestRejected = "AI_REQUEST_REJECTED"
	reasonAIUnreachable     = "AI_PROVIDER_UNREACHABLE"
	reasonAITimeout         = "AI_PROVIDER_TIMEOUT"
	reasonAIRedirected      = "AI_PROVIDER_REDIRECTED"
	reasonAIServerError     = "AI_PROVIDER_ERROR"
	reasonAIInvalidResponse = "AI_INVALID_RESPONSE"
)

// aiFailureResponse is what the API says about one kind of provider failure.
//
// The code follows who can fix it. FAILED_PRECONDITION: the stored or drafted
// configuration is wrong, and retrying the same request cannot help.
// UNAVAILABLE: the provider side is at fault for now, and a retry may succeed.
// RESOURCE_EXHAUSTED is left to this server's own limits, so a client never
// mistakes the provider's quota for its own budget.
type aiFailureResponse struct {
	code    codes.Code
	reason  string
	message string
}

var aiFailureResponses = map[ai.FailureKind]aiFailureResponse{
	ai.FailureAuth:        {codes.FailedPrecondition, reasonAIAuthFailed, "the provider rejected the API key or denied access"},
	ai.FailureNotFound:    {codes.FailedPrecondition, reasonAIModelNotFound, "the provider could not find this model or endpoint"},
	ai.FailureQuota:       {codes.FailedPrecondition, reasonAIQuotaExhausted, "the provider account is out of credit or over its spending limit"},
	ai.FailureRejected:    {codes.FailedPrecondition, reasonAIRequestRejected, "the provider rejected the request; check the model and its supported parameters"},
	ai.FailureRedirected:  {codes.FailedPrecondition, reasonAIRedirected, "the endpoint redirected the request; enter the final URL"},
	ai.FailureRateLimited: {codes.Unavailable, reasonAIRateLimited, "the provider is limiting requests for this key; wait and try again, or check its quota"},
	ai.FailureUnreachable: {codes.Unavailable, reasonAIUnreachable, "could not connect to the provider endpoint; check the URL and the network"},
	ai.FailureServer:      {codes.Unavailable, reasonAIServerError, "the provider reported a server error; try again later"},
	ai.FailureResponse:    {codes.Unavailable, reasonAIInvalidResponse, "the provider did not return a usable response; check the endpoint and model settings"},
	ai.FailureTimeout:     {codes.DeadlineExceeded, reasonAITimeout, "the provider did not respond in time"},
}

// newAIFailureError reports a provider failure with a fixed message and an
// ErrorInfo reason. Nothing the provider wrote reaches the caller.
func newAIFailureError(prefix string, failure ai.Failure) error {
	response, ok := aiFailureResponses[failure.Kind]
	if !ok {
		response = aiFailureResponses[ai.FailureResponse]
	}
	return newAIReasonError(response.code, response.reason, prefix+response.message, failure.Status)
}

func newAIReasonError(code codes.Code, reason, message string, upstreamStatus int) error {
	st := status.New(code, message)
	info := &errdetails.ErrorInfo{Reason: reason, Domain: errorInfoDomain}
	if upstreamStatus != 0 {
		info.Metadata = map[string]string{"upstream_status": strconv.Itoa(upstreamStatus)}
	}
	detailed, err := st.WithDetails(info)
	if err != nil {
		return st.Err()
	}
	return detailed.Err()
}

// logAIFailure writes the one line an operator needs to find the cause: which
// call, against which host and model, and the provider's status, code and
// request ID. It is built from fields, never from the SDK error string, which
// embeds the request URL and the raw response body.
func logAIFailure(operation string, provider ai.ProviderConfig, model string, failure ai.Failure) {
	host := ""
	if parsed, err := url.Parse(provider.Endpoint); err == nil {
		host = parsed.Host
	}
	slog.Warn("AI provider call failed",
		"operation", operation,
		"provider", provider.ID,
		"provider_type", string(provider.Type),
		"host", host,
		"model", model,
		"failure", string(failure.Kind),
		"upstream_status", failure.Status,
		"upstream_code", failure.Code,
		"request_id", failure.RequestID,
		"detail", failure.Detail,
	)
}
