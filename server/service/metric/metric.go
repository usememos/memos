package metric

import (
	"github.com/posthog/posthog-go"

	"github.com/usememos/memos/server/profile"
)

const (
	PostHogAPIKey = "phc_YFEi1aqUBW9sX2KDzdvMtK43DNu0mkeoKMKc0EQum2t"
)

var (
	client *MetricClient
)

// nolint
type MetricClient struct {
	workspaceID string
	profile     *profile.Profile
	phClient    *posthog.Client
}

func NewMetricClient(workspaceID string, profile profile.Profile) (*MetricClient, error) {
	phClient, err := posthog.NewWithConfig(PostHogAPIKey, posthog.Config{
		Endpoint: "https://app.posthog.com",
	})
	if err != nil {
		return nil, err
	}
	client = &MetricClient{
		workspaceID: workspaceID,
		profile:     &profile,
		phClient:    &phClient,
	}
	return client, nil
}

func Enqueue(event string) {
	if client == nil {
		return
	}
	if client.profile.Mode != "prod" {
		return
	}

	// nolint
	(*client.phClient).Enqueue(posthog.Capture{
		DistinctId: `memos-` + client.workspaceID,
		Event:      event,
	})
}
