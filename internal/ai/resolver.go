package ai

import "github.com/pkg/errors"

// FindProvider returns the provider with the given ID.
func FindProvider(providers []ProviderConfig, providerID string) (*ProviderConfig, error) {
	if providerID == "" {
		return nil, errors.Wrap(ErrProviderNotFound, "provider ID is required")
	}
	for _, provider := range providers {
		if provider.ID == providerID {
			return &provider, nil
		}
	}
	return nil, errors.Wrapf(ErrProviderNotFound, "provider ID %q", providerID)
}
