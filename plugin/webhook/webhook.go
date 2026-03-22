package webhook

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net"
	"net/http"
	"time"

	"github.com/pkg/errors"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

var (
	// timeout is the timeout for webhook request. Default to 30 seconds.
	timeout = 30 * time.Second

	// safeClient is the shared HTTP client used for all webhook dispatches.
	// Its Transport guards against SSRF by blocking connections to reserved/private
	// IP addresses at dial time, which also defeats DNS rebinding attacks.
	safeClient = &http.Client{
		Timeout: timeout,
		Transport: &http.Transport{
			DialContext: safeDialContext,
		},
	}
)

// safeDialContext is a net.Dialer.DialContext replacement that resolves the target
// hostname and rejects any address that falls within a reserved/private IP range.
func safeDialContext(ctx context.Context, network, addr string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, errors.Errorf("webhook: invalid address %q", addr)
	}

	ips, err := net.DefaultResolver.LookupHost(ctx, host)
	if err != nil {
		return nil, errors.Wrapf(err, "webhook: failed to resolve host %q", host)
	}

	for _, ipStr := range ips {
		if ip := net.ParseIP(ipStr); ip != nil && isReservedIP(ip) {
			return nil, errors.Errorf("webhook: connection to reserved/private IP address is not allowed")
		}
	}

	return (&net.Dialer{}).DialContext(ctx, network, net.JoinHostPort(host, port))
}

type WebhookRequestPayload struct {
	// The target URL for the webhook request.
	URL string `json:"url"`
	// The type of activity that triggered this webhook.
	ActivityType string `json:"activityType"`
	// The resource name of the creator. Format: users/{user}
	Creator string `json:"creator"`
	// The memo that triggered this webhook (if applicable).
	Memo *v1pb.Memo `json:"memo"`
}

// Post posts the message to webhook endpoint.
func Post(requestPayload *WebhookRequestPayload) error {
	body, err := json.Marshal(requestPayload)
	if err != nil {
		return errors.Wrapf(err, "failed to marshal webhook request to %s", requestPayload.URL)
	}

	req, err := http.NewRequest("POST", requestPayload.URL, bytes.NewBuffer(body))
	if err != nil {
		return errors.Wrapf(err, "failed to construct webhook request to %s", requestPayload.URL)
	}

	req.Header.Set("Content-Type", "application/json")
	resp, err := safeClient.Do(req)
	if err != nil {
		return errors.Wrapf(err, "failed to post webhook to %s", requestPayload.URL)
	}
	defer resp.Body.Close()

	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return errors.Wrapf(err, "failed to read webhook response from %s", requestPayload.URL)
	}

	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return errors.Errorf("failed to post webhook %s, status code: %d", requestPayload.URL, resp.StatusCode)
	}

	response := &struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	}{}
	if err := json.Unmarshal(b, response); err != nil {
		return errors.Wrapf(err, "failed to unmarshal webhook response from %s", requestPayload.URL)
	}

	if response.Code != 0 {
		return errors.Errorf("receive error code sent by webhook server, code %d, msg: %s", response.Code, response.Message)
	}

	return nil
}

// PostAsync posts the message to webhook endpoint asynchronously.
// It spawns a new goroutine to handle the request and does not wait for the response.
func PostAsync(requestPayload *WebhookRequestPayload) {
	go func() {
		if err := Post(requestPayload); err != nil {
			slog.Warn("Failed to dispatch webhook asynchronously",
				slog.String("url", requestPayload.URL),
				slog.String("activityType", requestPayload.ActivityType),
				slog.Any("err", err))
		}
	}()
}
