package metric

// Metric is the API message for metric.
type Metric struct {
	Name   string
	Labels map[string]string
}
