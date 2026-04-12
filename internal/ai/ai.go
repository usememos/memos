package ai

// ProviderType identifies an AI provider implementation.
type ProviderType string

const (
	// ProviderOpenAI is OpenAI's hosted API.
	ProviderOpenAI ProviderType = "OPENAI"
	// ProviderOpenAICompatible is an OpenAI-compatible API endpoint.
	ProviderOpenAICompatible ProviderType = "OPENAI_COMPATIBLE"
	// ProviderGemini is Google's Gemini API.
	ProviderGemini ProviderType = "GEMINI"
	// ProviderAnthropic is Anthropic's API.
	ProviderAnthropic ProviderType = "ANTHROPIC"
)

// ProviderConfig configures a callable AI provider connection.
type ProviderConfig struct {
	ID           string
	Title        string
	Type         ProviderType
	Endpoint     string
	APIKey       string
	Models       []string
	DefaultModel string
}
