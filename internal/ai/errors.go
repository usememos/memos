package ai

import "github.com/pkg/errors"

var (
	// ErrProviderNotFound indicates that a requested provider ID does not exist.
	ErrProviderNotFound = errors.New("AI provider not found")
	// ErrCapabilityUnsupported indicates that the provider does not support the requested capability.
	ErrCapabilityUnsupported = errors.New("AI provider capability unsupported")
)
