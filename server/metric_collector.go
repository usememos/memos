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
	collector metric.Collector
	profile   *profile.Profile
	store     *store.Store
}

const (
	segmentMetricWriteKey = "FqYUl1CmssHytFSnnVd0efV4gyGeH0dx"
)

func NewMetricCollector(profile *profile.Profile, store *store.Store) MetricCollector {
	c := segment.NewCollector(segmentMetricWriteKey)

	return MetricCollector{
		collector: c,
		profile:   profile,
		store:     store,
	}
}

func (mc *MetricCollector) Collect(_ context.Context, metric *metric.Metric) {
	if mc.profile.Mode == "dev" {
		return
	}

	if metric.Labels == nil {
		metric.Labels = map[string]string{}
	}
	metric.Labels["version"] = version.GetCurrentVersion(mc.profile.Mode)

	err := mc.collector.Collect(metric)
	if err != nil {
		fmt.Printf("Failed to request segment, error: %+v\n", err)
	}
}
