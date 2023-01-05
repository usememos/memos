package metric

// Metric is the API message for metric.
type Metric struct {
	ID     string
	Name   string
	Labels map[string]string
}

// Collector is the interface definition for metric collector.
type Collector interface {
	Identify(id string) error
	Collect(metric *Metric) error
}
