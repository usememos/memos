package ai

import (
	"net/url"
	"strings"

	"github.com/pkg/errors"
)

// NormalizeEndpoint resolves a provider's base URL, falling back to the
// provider type's default when the config leaves it empty. Every provider
// implementation resolves endpoints through here so validation cannot drift
// between capabilities.
func NormalizeEndpoint(providerType ProviderType, endpoint string) (string, error) {
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		endpoint = DefaultEndpoint(providerType)
	}
	if endpoint == "" {
		return "", errors.Errorf("provider type %q has no default endpoint; set one explicitly", providerType)
	}
	if _, err := url.ParseRequestURI(endpoint); err != nil {
		return "", errors.Wrap(err, "invalid AI provider endpoint")
	}
	return strings.TrimRight(endpoint, "/"), nil
}
