package server

import (
	"context"
	"fmt"

	metric "github.com/usememos/memos/plugin/metrics"
	"github.com/usememos/memos/plugin/metrics/segment"
	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/server/version"
	"github.com/usememos/memos/store"
)

// MetricCollector is the metric collector.
type MetricCollector struct {
	Collector metric.Collector
	Enabled   bool
	Profile   *profile.Profile
	Store     *store.Store
}

const (
	segmentMetricWriteKey = "fTn5BumOkj352n3TGw9tu0ARH2dOkcoQ"
)

func NewMetricCollector(profile *profile.Profile, store *store.Store) MetricCollector {
	c := segment.NewCollector(segmentMetricWriteKey)

	return MetricCollector{
		Collector: c,
		Enabled:   true,
		Profile:   profile,
		Store:     store,
	}
}

func (mc *MetricCollector) Collect(_ context.Context, metric *metric.Metric) {
	if !mc.Enabled {
		return
	}

	if mc.Profile.Mode == "dev" {
		return
	}

	if metric.Labels == nil {
		metric.Labels = map[string]string{}
	}
	metric.Labels["version"] = version.GetCurrentVersion(mc.Profile.Mode)

	err := mc.Collector.Collect(metric)
	if err != nil {
		fmt.Printf("Failed to request segment, error: %+v\n", err)
	}
}
