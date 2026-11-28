package ai

import "slices"

// Protocol is the wire API a provider type speaks.
type Protocol string

const (
	// ProtocolOpenAI is the OpenAI Chat Completions API, with /models and /audio/transcriptions.
	ProtocolOpenAI Protocol = "openai"
	// ProtocolGemini is the Gemini generateContent API.
	ProtocolGemini Protocol = "gemini"
	// ProtocolAnthropic is the Anthropic Messages API.
	ProtocolAnthropic Protocol = "anthropic"
)

// Capability is a task the instance hands to a provider.
type Capability string

const (
	// CapabilityTextGeneration generates text, used for tag suggestions.
	CapabilityTextGeneration Capability = "text_generation"
	// CapabilityTranscription turns speech into text.
	CapabilityTranscription Capability = "transcription"
)

// CapabilitySpec is one capability a provider type serves.
type CapabilitySpec struct {
	Capability Capability
	// SuggestedModel serves the capability well. Empty when there is no single good default.
	SuggestedModel string
}

// ProviderSpec is what memos knows about a provider type. Everything that
// depends on the type is here, so a stored provider holds only its type,
// endpoint and key.
type ProviderSpec struct {
	Type     ProviderType
	Protocol Protocol
	// DefaultEndpoint is used when a provider leaves its endpoint empty. Empty
	// means the type has no default and the endpoint is required.
	DefaultEndpoint string
	APIKeyRequired  bool
	// APIKeyURL is where to create a key. Empty when there is no single place.
	APIKeyURL string
	// Local marks services that usually run on the administrator's own machine.
	Local        bool
	Capabilities []CapabilitySpec
	// LenientJSON marks types whose servers may refuse a structured-output
	// request: text generation retries once without the constraint and reads
	// the JSON out of the reply.
	LenientJSON bool
}

// Supports reports whether the type serves the capability.
func (s ProviderSpec) Supports(capability Capability) bool {
	return slices.ContainsFunc(s.Capabilities, func(c CapabilitySpec) bool { return c.Capability == capability })
}

var catalog = []ProviderSpec{
	{
		Type:            ProviderOpenAI,
		Protocol:        ProtocolOpenAI,
		DefaultEndpoint: "https://api.openai.com/v1",
		APIKeyRequired:  true,
		APIKeyURL:       "https://platform.openai.com/api-keys",
		Capabilities: []CapabilitySpec{
			{CapabilityTextGeneration, "gpt-5-mini"},
			{CapabilityTranscription, "gpt-transcribe"},
		},
	},
	{
		Type:            ProviderAnthropic,
		Protocol:        ProtocolAnthropic,
		DefaultEndpoint: "https://api.anthropic.com",
		APIKeyRequired:  true,
		APIKeyURL:       "https://platform.claude.com/settings/keys",
		Capabilities: []CapabilitySpec{
			{CapabilityTextGeneration, "claude-opus-5-5"},
		},
	},
	{
		Type:            ProviderGemini,
		Protocol:        ProtocolGemini,
		DefaultEndpoint: "https://generativelanguage.googleapis.com/v1beta",
		APIKeyRequired:  true,
		APIKeyURL:       "https://aistudio.google.com/apikey",
		Capabilities: []CapabilitySpec{
			{CapabilityTextGeneration, "gemini-2.5-flash"},
			{CapabilityTranscription, "gemini-2.5-flash"},
		},
	},
	{
		Type:            ProviderDeepSeek,
		Protocol:        ProtocolOpenAI,
		DefaultEndpoint: "https://api.deepseek.com",
		APIKeyRequired:  true,
		APIKeyURL:       "https://platform.deepseek.com/api_keys",
		Capabilities: []CapabilitySpec{
			{CapabilityTextGeneration, "deepseek-flash"},
		},
	},
	{
		Type:            ProviderOpenRouter,
		Protocol:        ProtocolOpenAI,
		DefaultEndpoint: "https://openrouter.ai/api/v1",
		APIKeyRequired:  true,
		APIKeyURL:       "https://openrouter.ai/settings/keys",
		Capabilities: []CapabilitySpec{
			{CapabilityTextGeneration, "openai/gpt-5-mini"},
			{CapabilityTranscription, ""},
		},
		// Structured output support differs per routed model.
		LenientJSON: true,
	},
	{
		Type:            ProviderOllama,
		Protocol:        ProtocolOpenAI,
		DefaultEndpoint: "http://localhost:11434/v1",
		Local:           true,
		Capabilities: []CapabilitySpec{
			{CapabilityTextGeneration, ""},
		},
		LenientJSON: true,
	},
	{
		Type:     ProviderOpenAICompatible,
		Protocol: ProtocolOpenAI,
		Capabilities: []CapabilitySpec{
			{CapabilityTextGeneration, ""},
			{CapabilityTranscription, ""},
		},
		LenientJSON: true,
	},
	{
		Type:     ProviderAnthropicCompatible,
		Protocol: ProtocolAnthropic,
		Capabilities: []CapabilitySpec{
			{CapabilityTextGeneration, ""},
		},
		LenientJSON: true,
	},
}

// Catalog returns every supported provider type, in the order a picker should offer them.
func Catalog() []ProviderSpec {
	return slices.Clone(catalog)
}

// LookupSpec returns the spec of a provider type.
func LookupSpec(providerType ProviderType) (ProviderSpec, bool) {
	index := slices.IndexFunc(catalog, func(spec ProviderSpec) bool { return spec.Type == providerType })
	if index < 0 {
		return ProviderSpec{}, false
	}
	return catalog[index], true
}
