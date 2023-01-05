package segment

import (
	"time"

	"github.com/segmentio/analytics-go"
	metric "github.com/usememos/memos/plugin/metrics"
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

// Identify will identify the server caller.
func (c *collector) Identify(id string) error {
	return c.client.Enqueue(analytics.Identify{
		UserId:    id,
		Timestamp: time.Now().UTC(),
	})
}

// Collect will exec all the segment collector.
func (c *collector) Collect(metric *metric.Metric) error {
	properties := analytics.NewProperties()
	for key, value := range metric.Labels {
		properties.Set(key, value)
	}

	return c.client.Enqueue(analytics.Track{
		UserId:     metric.ID,
		Timestamp:  time.Now().UTC(),
		Event:      metric.Name,
		Properties: properties,
	})
}
