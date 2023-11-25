package webhook

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/pkg/errors"
)

var (
	// timeout is the timeout for webhook request. Default to 30 seconds.
	timeout = 30 * time.Second
)

type Memo struct {
	ID        int32 `json:"id"`
	CreatorID int32 `json:"creatorId"`
	CreatedTs int64 `json:"createdTs"`
	UpdatedTs int64 `json:"updatedTs"`

	// Domain specific fields
	Content      string          `json:"content"`
	Visibility   string          `json:"visibility"`
	Pinned       bool            `json:"pinned"`
	ResourceList []*Resource     `json:"resourceList"`
	RelationList []*MemoRelation `json:"relationList"`
}

type Resource struct {
	ID int32 `json:"id"`

	// Standard fields
	CreatorID int32 `json:"creatorId"`
	CreatedTs int64 `json:"createdTs"`
	UpdatedTs int64 `json:"updatedTs"`

	// Domain specific fields
	Filename     string `json:"filename"`
	InternalPath string `json:"internalPath"`
	ExternalLink string `json:"externalLink"`
	Type         string `json:"type"`
	Size         int64  `json:"size"`
}

type MemoRelation struct {
	MemoID        int32  `json:"memoId"`
	RelatedMemoID int32  `json:"relatedMemoId"`
	Type          string `json:"type"`
}

// WebhookPayload is the payload of webhook request.
// nolint
type WebhookPayload struct {
	URL          string `json:"url"`
	ActivityType string `json:"activityType"`
	CreatorID    int32  `json:"creatorId"`
	CreatedTs    int64  `json:"createdTs"`
	Memo         *Memo  `json:"memo"`
}

// WebhookResponse is the response of webhook request.
// nolint
type WebhookResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// Post posts the message to webhook endpoint.
func Post(payload WebhookPayload) error {
	body, err := json.Marshal(&payload)
	if err != nil {
		return errors.Wrapf(err, "failed to marshal webhook request to %s", payload.URL)
	}
	req, err := http.NewRequest("POST",
		payload.URL, bytes.NewBuffer(body))
	if err != nil {
		return errors.Wrapf(err, "failed to construct webhook request to %s", payload.URL)
	}

	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{
		Timeout: timeout,
	}
	resp, err := client.Do(req)
	if err != nil {
		return errors.Wrapf(err, "failed to post webhook to %s", payload.URL)
	}

	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return errors.Wrapf(err, "failed to read webhook response from %s", payload.URL)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return errors.Errorf("failed to post webhook %s, status code: %d, response body: %s", payload.URL, resp.StatusCode, b)
	}

	response := &WebhookResponse{}
	if err := json.Unmarshal(b, response); err != nil {
		return errors.Wrapf(err, "failed to unmarshal webhook response from %s", payload.URL)
	}

	if response.Code != 0 {
		return errors.Errorf("receive error code sent by webhook server, code %d, msg: %s", response.Code, response.Message)
	}

	return nil
}
