package segment

import (
	"time"

	"github.com/google/uuid"
	"github.com/segmentio/analytics-go"
	metric "github.com/usememos/memos/plugin/metrics"
)

var (
	sessionUUID = uuid.NewString()
)

// collector is the metrics collector https://segment.com/.
type collector struct {
	client analytics.Client
}

// NewCollector creates a new instance of segment.
func NewCollector(key string) metric.Collector {
	client := analytics.New(key)

	return &collector{
		client: client,
	}
}

// Collect will exec all the segment collector.
func (c *collector) Collect(metric *metric.Metric) error {
	properties := analytics.NewProperties()
	for key, value := range metric.Labels {
		properties.Set(key, value)
	}

	return c.client.Enqueue(analytics.Track{
		Event:       string(metric.Name),
		AnonymousId: sessionUUID,
		Properties:  properties,
		Timestamp:   time.Now().UTC(),
	})
}
