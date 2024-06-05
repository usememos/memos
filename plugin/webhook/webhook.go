package webhook

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

var (
	// timeout is the timeout for webhook request. Default to 30 seconds.
	timeout = 30 * time.Second
)

// Post posts the message to webhook endpoint.
func Post(requestPayload *v1pb.WebhookRequestPayload) error {
	body, err := protojson.Marshal(requestPayload)
	if err != nil {
		return errors.Wrapf(err, "failed to marshal webhook request to %s", requestPayload.Url)
	}

	req, err := http.NewRequest("POST", requestPayload.Url, bytes.NewBuffer(body))
	if err != nil {
		return errors.Wrapf(err, "failed to construct webhook request to %s", requestPayload.Url)
	}

	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{
		Timeout: timeout,
	}
	resp, err := client.Do(req)
	if err != nil {
		return errors.Wrapf(err, "failed to post webhook to %s", requestPayload.Url)
	}

	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return errors.Wrapf(err, "failed to read webhook response from %s", requestPayload.Url)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return errors.Errorf("failed to post webhook %s, status code: %d, response body: %s", requestPayload.Url, resp.StatusCode, b)
	}

	response := &struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	}{}
	if err := json.Unmarshal(b, response); err != nil {
		return errors.Wrapf(err, "failed to unmarshal webhook response from %s", requestPayload.Url)
	}

	if response.Code != 0 {
		return errors.Errorf("receive error code sent by webhook server, code %d, msg: %s", response.Code, response.Message)
	}

	return nil
}
