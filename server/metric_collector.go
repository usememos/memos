package server

import (
	"context"
	"fmt"

	metric "github.com/usememos/memos/plugin/metrics"
	"github.com/usememos/memos/plugin/metrics/segment"
	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/server/version"
)

// MetricCollector is the metric collector.
type MetricCollector struct {
	collector metric.Collector
	ID        string
	Enabled   bool
	Profile   *profile.Profile
}

const (
	segmentMetricWriteKey = "NbPruMMmfqfD2AMCw3pkxZTsszVS3hKq"
)

func (s *Server) registerMetricCollector() {
	c := segment.NewCollector(segmentMetricWriteKey)
	mc := &MetricCollector{
		collector: c,
		ID:        s.ID,
		Enabled:   false,
		Profile:   s.Profile,
	}
	s.Collector = mc
}

func (mc *MetricCollector) Identify(_ context.Context) {
	if !mc.Enabled {
		return
	}

	err := mc.collector.Identify(mc.ID)
	if err != nil {
		fmt.Printf("Failed to request segment, error: %+v\n", err)
	}
}

func (mc *MetricCollector) Collect(_ context.Context, metric *metric.Metric) {
	if !mc.Enabled {
		return
	}

	if metric.Labels == nil {
		metric.Labels = map[string]string{}
	}
	metric.Labels["mode"] = mc.Profile.Mode
	metric.Labels["version"] = version.GetCurrentVersion(mc.Profile.Mode)
	metric.ID = mc.ID
	err := mc.collector.Collect(metric)
	if err != nil {
		fmt.Printf("Failed to request segment, error: %+v\n", err)
	}
}
