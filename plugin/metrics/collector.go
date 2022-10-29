package metric

// Collector is the interface definition for metric collector.
type Collector interface {
	Collect(metric *Metric) error
}
