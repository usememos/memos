package openai

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	openaisdk "github.com/openai/openai-go/v3"

	"github.com/usememos/memos/provider/ai/chat"
)

// wrapSDKError converts an SDK error into chat.APIError when the provider
// answered with a non-2xx status. Network and decoding failures are returned
// unchanged so callers can distinguish "provider said no" from "could not ask".
func wrapSDKError(err error) error {
	var apiErr *openaisdk.Error
	if !errors.As(err, &apiErr) {
		return err
	}

	// The SDK only populates Message when the body is JSON. Providers that
	// answer errors with plain text or HTML would otherwise lose their reason
	// and surface as a bare status line.
	message := strings.TrimSpace(apiErr.Message)
	if message == "" {
		message = strings.TrimSpace(apiErr.Code)
	}
	if message == "" && apiErr.Response != nil {
		if body, readErr := io.ReadAll(io.LimitReader(apiErr.Response.Body, chat.TruncatedErrorBodyLimit)); readErr == nil {
			message = extractErrorMessage(body)
		}
	}
	if message == "" {
		message = http.StatusText(apiErr.StatusCode)
	}
	return &chat.APIError{StatusCode: apiErr.StatusCode, Message: truncate(message)}
}

// newAPIError builds a chat.APIError from a raw provider response, reading the
// body for a human-readable message.
func newAPIError(response *http.Response) error {
	body, readErr := io.ReadAll(io.LimitReader(response.Body, chat.TruncatedErrorBodyLimit))
	if readErr != nil {
		return &chat.APIError{StatusCode: response.StatusCode, Message: http.StatusText(response.StatusCode)}
	}
	return &chat.APIError{StatusCode: response.StatusCode, Message: truncate(extractErrorMessage(body))}
}

// extractErrorMessage prefers a JSON error message and falls back to the raw
// body, since providers answer errors with anything from JSON to an HTML page.
func extractErrorMessage(body []byte) string {
	trimmed := strings.TrimSpace(string(body))
	if trimmed == "" {
		return ""
	}
	var payload struct {
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
		Message string `json:"message"`
		Detail  string `json:"detail"`
	}
	if err := json.Unmarshal(body, &payload); err == nil {
		for _, candidate := range []string{payload.Error.Message, payload.Message, payload.Detail} {
			if strings.TrimSpace(candidate) != "" {
				return strings.TrimSpace(candidate)
			}
		}
	}
	return trimmed
}

func truncate(message string) string {
	if len(message) <= chat.TruncatedErrorBodyLimit {
		return message
	}
	return message[:chat.TruncatedErrorBodyLimit] + "…"
}
