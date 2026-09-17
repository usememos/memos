package ai

// ProviderType identifies an AI provider implementation.
type ProviderType string

const (
	// ProviderOpenAI is OpenAI's hosted API.
	ProviderOpenAI ProviderType = "OPENAI"
	// ProviderGemini is Google's Gemini API.
	ProviderGemini ProviderType = "GEMINI"
	// ProviderOpenRouter is OpenRouter's OpenAI-compatible router.
	ProviderOpenRouter ProviderType = "OPENROUTER"
	// ProviderDeepInfra is DeepInfra's OpenAI-compatible API.
	ProviderDeepInfra ProviderType = "DEEPINFRA"
)

// DefaultEndpoint returns the base URL for a provider type, or an empty string
// when the type has no sensible default and the config must supply one.
func DefaultEndpoint(providerType ProviderType) string {
	switch providerType {
	case ProviderOpenAI:
		return "https://api.openai.com/v1"
	case ProviderOpenRouter:
		return "https://openrouter.ai/api/v1"
	case ProviderDeepInfra:
		return "https://api.deepinfra.com/v1/openai"
	case ProviderGemini:
		return "https://generativelanguage.googleapis.com/v1beta"
	default:
		return ""
	}
}

// IsOpenAICompatible reports whether a provider type speaks the OpenAI wire
// protocol. Every OpenAI-compatible provider shares one chat implementation.
func IsOpenAICompatible(providerType ProviderType) bool {
	switch providerType {
	case ProviderOpenAI, ProviderOpenRouter, ProviderDeepInfra:
		return true
	default:
		return false
	}
}

// ProviderConfig configures a callable AI provider connection.
type ProviderConfig struct {
	ID       string
	Title    string
	Type     ProviderType
	Endpoint string
	APIKey   string
}
