package ai

// ProviderType identifies the service an AI provider connects to. The values
// match the names of the store's AIProviderType enum.
type ProviderType string

const (
	// ProviderOpenAI is OpenAI's hosted API.
	ProviderOpenAI ProviderType = "OPENAI"
	// ProviderGemini is Google's Gemini API.
	ProviderGemini ProviderType = "GEMINI"
	// ProviderAnthropic is Anthropic's hosted API.
	ProviderAnthropic ProviderType = "ANTHROPIC"
	// ProviderDeepSeek is DeepSeek's hosted API.
	ProviderDeepSeek ProviderType = "DEEPSEEK"
	// ProviderOpenRouter is OpenRouter's hosted API.
	ProviderOpenRouter ProviderType = "OPENROUTER"
	// ProviderOllama is an Ollama server, usually next to this one.
	ProviderOllama ProviderType = "OLLAMA"
	// ProviderOpenAICompatible is any service that speaks the OpenAI Chat Completions API.
	ProviderOpenAICompatible ProviderType = "OPENAI_COMPATIBLE"
	// ProviderAnthropicCompatible is any service that speaks the Anthropic Messages API.
	ProviderAnthropicCompatible ProviderType = "ANTHROPIC_COMPATIBLE"
)

// ProviderConfig configures a callable AI provider connection.
type ProviderConfig struct {
	ID    string
	Title string
	Type  ProviderType
	// Endpoint is the resolved base URL: the configured one, or the type's default.
	Endpoint string
	APIKey   string
}
