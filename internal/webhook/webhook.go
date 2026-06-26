package webhook

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
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

	asyncPostQueue = make(chan *WebhookRequestPayload, 128)
)

func init() {
	for range 4 {
		go func() {
			for payload := range asyncPostQueue {
				if err := Post(payload); err != nil {
					slog.Warn("Failed to dispatch webhook asynchronously",
						slog.String("url", payload.URL),
						slog.String("activityType", payload.ActivityType),
						slog.Any("err", err))
				}
			}
		}()
	}
}

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
	// Optional signing secret for HMAC-SHA256 signature. Not serialized to JSON.
	SigningSecret string `json:"-"`
}

// resolveSigningKey returns the raw HMAC key for a signing secret. Secrets using
// the Standard Webhooks "whsec_<base64>" serialization are base64-decoded to their
// raw bytes; any other secret is used as-is. It returns an error when a whsec_-prefixed
// secret is not valid base64, so callers fail loudly instead of silently signing with
// the wrong key (which would make every signature unverifiable by the receiver).
func resolveSigningKey(secret string) ([]byte, error) {
	if rest, ok := strings.CutPrefix(secret, "whsec_"); ok {
		decoded, err := base64.StdEncoding.DecodeString(rest)
		if err != nil {
			return nil, errors.Wrap(err, "signing secret has whsec_ prefix but is not valid base64")
		}
		return decoded, nil
	}
	return []byte(secret), nil
}

// GenerateSigningSecret returns a new Standard Webhooks signing secret in the
// "whsec_<base64>" form, backed by 32 cryptographically-random bytes — comfortably
// within the spec's 24–64 byte range.
func GenerateSigningSecret() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", errors.Wrap(err, "failed to read random bytes for signing secret")
	}
	return "whsec_" + base64.StdEncoding.EncodeToString(buf), nil
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

	if requestPayload.SigningSecret != "" {
		key, err := resolveSigningKey(requestPayload.SigningSecret)
		if err != nil {
			return errors.Wrapf(err, "failed to derive signing key for webhook to %s", requestPayload.URL)
		}

		msgID := "msg_" + uuid.New().String()
		timestamp := strconv.FormatInt(time.Now().Unix(), 10)

		mac := hmac.New(sha256.New, key)
		mac.Write([]byte(msgID + "." + timestamp + "."))
		mac.Write(body)
		signature := base64.StdEncoding.EncodeToString(mac.Sum(nil))

		req.Header.Set("webhook-id", msgID)
		req.Header.Set("webhook-timestamp", timestamp)
		req.Header.Set("webhook-signature", "v1,"+signature)
	}

	resp, err := safeClient.Do(req)
	if err != nil {
		return errors.Wrapf(err, "failed to post webhook to %s", requestPayload.URL)
	}
	defer resp.Body.Close()

	b, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
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
// It enqueues the request for bounded asynchronous dispatch and does not wait for the response.
func PostAsync(requestPayload *WebhookRequestPayload) {
	if requestPayload == nil {
		slog.Warn("Dropped webhook dispatch because payload is nil")
		return
	}
	select {
	case asyncPostQueue <- requestPayload:
	default:
		slog.Warn("Dropped webhook dispatch because the async queue is full",
			slog.String("url", requestPayload.URL),
			slog.String("activityType", requestPayload.ActivityType))
	}
}
