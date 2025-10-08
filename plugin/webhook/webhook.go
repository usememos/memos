package webhook

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/json"
	"encoding/hex"
	"fmt"
	"io"
	"log/slog"
	"os"
	"net/http"
	"net"
	"net/url"
	"strings"
	"time"

	"github.com/pkg/errors"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

var (
	// timeout is the timeout for webhook request. Default to 30 seconds.
	timeout = 30 * time.Second
)

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
	// 基础 SSRF 防护：仅允许 http/https 且禁止回环/内网等目标。
	if err := validateOutboundURL(requestPayload.URL); err != nil {
		return errors.Wrapf(err, "invalid webhook target: %s", requestPayload.URL)
	}
	body, err := json.Marshal(requestPayload)
	if err != nil {
		return errors.Wrapf(err, "failed to marshal webhook request to %s", requestPayload.URL)
	}

	req, err := http.NewRequest("POST", requestPayload.URL, bytes.NewBuffer(body))
	if err != nil {
		return errors.Wrapf(err, "failed to construct webhook request to %s", requestPayload.URL)
	}

	req.Header.Set("Content-Type", "application/json")
	// 可选 HMAC 签名：设置 MEMOS_OUTBOUND_WEBHOOK_HMAC_SECRET 即可启用。
	if secret := strings.TrimSpace(os.Getenv("MEMOS_OUTBOUND_WEBHOOK_HMAC_SECRET")); secret != "" {
		ts := time.Now().Unix()
		msg := append([]byte(fmt.Sprintf("%d.", ts)), body...)
		h := hmac.New(sha256.New, []byte(secret))
		h.Write(msg)
		sig := hex.EncodeToString(h.Sum(nil))
		req.Header.Set("X-Memos-Signature", fmt.Sprintf("t=%d,v1=%s", ts, sig))
		req.Header.Set("X-Memos-Source", "memos")
	}
	client := &http.Client{
		Timeout: timeout,
	}
	resp, err := client.Do(req)
	if err != nil {
		return errors.Wrapf(err, "failed to post webhook to %s", requestPayload.URL)
	}

	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return errors.Wrapf(err, "failed to read webhook response from %s", requestPayload.URL)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return errors.Errorf("failed to post webhook %s, status code: %d, response body: %s", requestPayload.URL, resp.StatusCode, b)
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
			// Since we're in a goroutine, we can only log the error
			slog.Warn("Failed to dispatch webhook asynchronously",
				slog.String("url", requestPayload.URL),
				slog.String("activityType", requestPayload.ActivityType),
				slog.Any("err", err))
		}
	}()
}

// validateOutboundURL 基础 SSRF 防护（与 server/notification 略重复，保持插件自包含）。
func validateOutboundURL(raw string) error {
    u, err := url.Parse(raw)
    if err != nil {
        return err
    }
    scheme := strings.ToLower(u.Scheme)
    if scheme != "http" && scheme != "https" {
        return errors.Errorf("unsupported scheme: %s", scheme)
    }
    host := u.Hostname()
    if host == "" {
        return errors.Errorf("empty host")
    }
    ips, err := net.LookupIP(host)
    if err != nil {
        return errors.Wrap(err, "dns lookup failed")
    }
    for _, ip := range ips {
        if isDisallowedIP(ip) {
            return errors.Errorf("disallowed target ip: %s", ip.String())
        }
    }
    return nil
}

func isDisallowedIP(ip net.IP) bool {
    if ip.IsLoopback() {
        return true
    }
    privateCIDRs := []string{
        "10.0.0.0/8",
        "172.16.0.0/12",
        "192.168.0.0/16",
        "169.254.0.0/16",
        "127.0.0.0/8",
        "169.254.169.254/32",
    }
    for _, cidr := range privateCIDRs {
        _, block, _ := net.ParseCIDR(cidr)
        if block.Contains(ip) {
            return true
        }
    }
    if ip.To4() == nil {
        v6Blocks := []string{
            "::1/128",
            "fc00::/7",
            "fe80::/10",
        }
        for _, c := range v6Blocks {
            _, block, _ := net.ParseCIDR(c)
            if block.Contains(ip) {
                return true
            }
        }
    }
    return false
}
