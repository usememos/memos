package llm

import (
	"fmt"
	"sync"
)

// Manager manages LLM providers.
type Manager struct {
	providers map[string]Provider
	mu        sync.RWMutex

	defaultProvider string
	defaultModel    string
	enabled         bool
}

// NewManager creates a new LLM manager.
func NewManager() *Manager {
	return &Manager{
		providers: make(map[string]Provider),
	}
}

// SetEnabled sets whether AI is enabled.
func (m *Manager) SetEnabled(enabled bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.enabled = enabled
}

// IsEnabled returns whether AI is enabled.
func (m *Manager) IsEnabled() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.enabled
}

// SetDefaults sets the default provider and model.
func (m *Manager) SetDefaults(provider, model string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.defaultProvider = provider
	m.defaultModel = model
}

// GetDefaults returns the default provider and model.
func (m *Manager) GetDefaults() (provider, model string) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.defaultProvider, m.defaultModel
}

// Register registers a provider.
func (m *Manager) Register(provider Provider) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.providers[provider.Name()] = provider
}

// GetProvider returns a provider by name.
func (m *Manager) GetProvider(name string) (Provider, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if name == "" {
		name = m.defaultProvider
	}

	if p, ok := m.providers[name]; ok {
		return p, nil
	}
	return nil, fmt.Errorf("provider not found: %s", name)
}

// ListProviders returns all registered providers.
func (m *Manager) ListProviders() []Provider {
	m.mu.RLock()
	defer m.mu.RUnlock()

	providers := make([]Provider, 0, len(m.providers))
	for _, p := range m.providers {
		providers = append(providers, p)
	}
	return providers
}
