package ai

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
)

func TestValidateAI(t *testing.T) {
	settingWith := func(providers ...*storepb.AIProviderConfig) *storepb.InstanceAISetting {
		return &storepb.InstanceAISetting{Providers: providers}
	}
	provider := func(id string) *storepb.AIProviderConfig {
		return &storepb.AIProviderConfig{Id: id, Title: "OpenAI", Type: storepb.AIProviderType_OPENAI, ApiKey: "key"}
	}
	require.NoError(t, ValidateSetting(settingWith()))
	require.NoError(t, ValidateSetting(settingWith(provider("a"), provider("b"))))
	require.ErrorContains(t, ValidateSetting(settingWith(provider(""))), "id is required")
	require.ErrorContains(t, ValidateSetting(settingWith(provider("a"), provider("a"))), "duplicate provider ID")

	noKey := provider("a")
	noKey.ApiKey = ""
	require.ErrorContains(t, ValidateSetting(settingWith(noKey)), "API key is required")

	badType := provider("a")
	badType.Type = storepb.AIProviderType_AI_PROVIDER_TYPE_UNSPECIFIED
	require.ErrorContains(t, ValidateSetting(settingWith(badType)), "unsupported type")

	// A base URL cannot carry a query or fragment to the provider.
	for _, endpoint := range []string{"ftp://example.com", "https://example.com/v1?api-version=1", "https://example.com?", "https://example.com/v1#a"} {
		badEndpoint := provider("a")
		badEndpoint.Endpoint = endpoint
		require.ErrorContains(t, ValidateSetting(settingWith(badEndpoint)), "without a query or fragment", endpoint)
	}

	setting := settingWith(provider("a"))
	setting.TextGeneration = &storepb.TextGenerationConfig{ProviderId: "missing", Model: "text"}
	require.ErrorContains(t, ValidateSetting(setting), "does not reference")
	setting.TextGeneration = &storepb.TextGenerationConfig{ProviderId: "a"}
	require.ErrorContains(t, ValidateSetting(setting), "model")
	setting.TextGeneration.Model = "text"
	require.NoError(t, ValidateSetting(setting))
	setting.Transcription = &storepb.TranscriptionConfig{ProviderId: "missing", Model: "speech"}
	require.ErrorContains(t, ValidateSetting(setting), "does not reference")
	setting.Transcription = &storepb.TranscriptionConfig{ProviderId: "a", Model: "speech", Language: strings.Repeat("x", maxTranscriptionLanguageLength+1)}
	require.ErrorContains(t, ValidateSetting(setting), "language is too long")

	// A capability that is set is on, so it names a provider and a model. Off is the capability left unset.
	setting.Transcription = &storepb.TranscriptionConfig{ProviderId: "a"}
	require.ErrorContains(t, ValidateSetting(setting), "transcription model")
	setting.Transcription = &storepb.TranscriptionConfig{Model: "speech"}
	require.ErrorContains(t, ValidateSetting(setting), "transcription provider_id is required")
	setting.Transcription = &storepb.TranscriptionConfig{}
	require.ErrorContains(t, ValidateSetting(setting), "transcription provider_id is required")
	setting.Transcription = nil
	setting.TextGeneration = &storepb.TextGenerationConfig{}
	require.ErrorContains(t, ValidateSetting(setting), "text_generation provider_id is required")
	setting.TextGeneration = nil
	require.NoError(t, ValidateSetting(setting))
}

// The catalog decides what a provider needs and what it can serve.
func TestValidateAIAgainstCatalog(t *testing.T) {
	validate := func(provider *storepb.AIProviderConfig, transcription bool) error {
		provider.Id, provider.Title = "p", "p"
		setting := &storepb.InstanceAISetting{
			Providers:      []*storepb.AIProviderConfig{provider},
			TextGeneration: &storepb.TextGenerationConfig{ProviderId: "p", Model: "m"},
		}
		if transcription {
			setting.Transcription = &storepb.TranscriptionConfig{ProviderId: "p", Model: "m"}
		}
		return ValidateSetting(setting)
	}

	// Local and compatible services may run without a key.
	require.NoError(t, validate(&storepb.AIProviderConfig{Type: storepb.AIProviderType_OLLAMA}, false))
	require.NoError(t, validate(&storepb.AIProviderConfig{Type: storepb.AIProviderType_OPENAI_COMPATIBLE, Endpoint: "http://gpu:8000/v1"}, true))
	require.NoError(t, validate(&storepb.AIProviderConfig{Type: storepb.AIProviderType_ANTHROPIC_COMPATIBLE, Endpoint: "http://gpu:8000"}, false))
	require.ErrorContains(t, validate(&storepb.AIProviderConfig{Type: storepb.AIProviderType_DEEPSEEK}, false), "API key is required")

	// A compatible type has no default endpoint.
	require.ErrorContains(t, validate(&storepb.AIProviderConfig{Type: storepb.AIProviderType_ANTHROPIC_COMPATIBLE}, false), "endpoint is required")
	require.ErrorContains(t, validate(&storepb.AIProviderConfig{Type: storepb.AIProviderType_OPENAI_COMPATIBLE}, false), "endpoint is required")

	// A slot accepts only types that serve it.
	require.NoError(t, validate(&storepb.AIProviderConfig{Type: storepb.AIProviderType_ANTHROPIC, ApiKey: "k"}, false))
	for _, providerType := range []storepb.AIProviderType{storepb.AIProviderType_ANTHROPIC, storepb.AIProviderType_DEEPSEEK, storepb.AIProviderType_OLLAMA, storepb.AIProviderType_ANTHROPIC_COMPATIBLE} {
		err := validate(&storepb.AIProviderConfig{Type: providerType, Endpoint: "https://example.com", ApiKey: "k"}, true)
		require.ErrorContains(t, err, "cannot be used for transcription", providerType.String())
	}
	for _, providerType := range []storepb.AIProviderType{storepb.AIProviderType_OPENAI, storepb.AIProviderType_GEMINI, storepb.AIProviderType_OPENROUTER} {
		require.NoError(t, validate(&storepb.AIProviderConfig{Type: providerType, ApiKey: "k"}, true), providerType.String())
	}
}

// Every stored type has a spec, and the store and catalog name types alike.
func TestCatalogCoversEveryType(t *testing.T) {
	for value, name := range storepb.AIProviderType_name {
		if value == 0 {
			continue
		}
		spec, ok := LookupSpec(TypeFromStore(storepb.AIProviderType(value)))
		require.True(t, ok, name)
		require.NotEmpty(t, spec.Capabilities, name)
		require.Equal(t, spec.DefaultEndpoint == "", strings.HasSuffix(name, "_COMPATIBLE"), name)
	}
	require.Len(t, Catalog(), len(storepb.AIProviderType_name)-1)
}

func TestNormalizeSetting(t *testing.T) {
	setting := &storepb.InstanceAISetting{
		Providers: []*storepb.AIProviderConfig{
			{Id: " a ", Title: " OpenAI ", Type: storepb.AIProviderType_OPENAI, Endpoint: "https://api.openai.com/v1/"},
			{Id: "b", Type: storepb.AIProviderType_GEMINI, Endpoint: " https://proxy.example.com/gemini/ "},
			nil,
		},
		Transcription:  &storepb.TranscriptionConfig{ProviderId: " a ", Model: " whisper-1 "},
		TextGeneration: &storepb.TextGenerationConfig{ProviderId: " b ", Model: " text "},
	}
	NormalizeSetting(setting)
	require.Equal(t, "b", setting.TextGeneration.ProviderId)
	require.Equal(t, "text", setting.TextGeneration.Model)
	require.Equal(t, "a", setting.Providers[0].Id)
	require.Equal(t, "OpenAI", setting.Providers[0].Title)
	// The default is stored as empty, so the provider follows it.
	require.Empty(t, setting.Providers[0].Endpoint)
	require.Equal(t, "https://api.openai.com/v1", ResolveEndpoint(setting.Providers[0]))
	require.Equal(t, "https://proxy.example.com/gemini", setting.Providers[1].Endpoint)
	require.Equal(t, "a", setting.Transcription.ProviderId)
	require.Equal(t, "whisper-1", setting.Transcription.Model)
}

// An address without a path is the service at that address, so it is stored
// and called with the path of its type's API.
func TestNormalizeSettingCompletesEndpoint(t *testing.T) {
	for _, test := range []struct {
		name         string
		providerType storepb.AIProviderType
		endpoint     string
		stored       string
		resolved     string
	}{
		{"ollama host", storepb.AIProviderType_OLLAMA, "http://192.168.1.10:11434", "http://192.168.1.10:11434/v1", "http://192.168.1.10:11434/v1"},
		{"ollama host with slash", storepb.AIProviderType_OLLAMA, " http://ollama:11434/ ", "http://ollama:11434/v1", "http://ollama:11434/v1"},
		{"ollama with its path", storepb.AIProviderType_OLLAMA, "http://ollama:11434/v1", "http://ollama:11434/v1", "http://ollama:11434/v1"},
		{"ollama behind a prefix", storepb.AIProviderType_OLLAMA, "https://example.com/ollama", "https://example.com/ollama", "https://example.com/ollama"},
		{"ollama default host", storepb.AIProviderType_OLLAMA, "http://localhost:11434", "", "http://localhost:11434/v1"},
		{"openai proxy host", storepb.AIProviderType_OPENAI, "https://proxy.example.com", "https://proxy.example.com/v1", "https://proxy.example.com/v1"},
		{"openai official host", storepb.AIProviderType_OPENAI, "https://api.openai.com", "", "https://api.openai.com/v1"},
		{"openai gateway path", storepb.AIProviderType_OPENAI, "https://gateway.example.com/acct/openai", "https://gateway.example.com/acct/openai", "https://gateway.example.com/acct/openai"},
		{"openrouter host", storepb.AIProviderType_OPENROUTER, "https://proxy.example.com", "https://proxy.example.com/api/v1", "https://proxy.example.com/api/v1"},
		{"gemini host", storepb.AIProviderType_GEMINI, "https://proxy.example.com", "https://proxy.example.com/v1beta", "https://proxy.example.com/v1beta"},
		{"gemini version", storepb.AIProviderType_GEMINI, "https://proxy.example.com/v1", "https://proxy.example.com/v1", "https://proxy.example.com/v1"},
		{"deepseek host", storepb.AIProviderType_DEEPSEEK, "https://proxy.example.com", "https://proxy.example.com", "https://proxy.example.com"},
		{"anthropic host", storepb.AIProviderType_ANTHROPIC, "https://proxy.example.com", "https://proxy.example.com", "https://proxy.example.com"},
		{"anthropic with v1", storepb.AIProviderType_ANTHROPIC, "https://proxy.example.com/v1/", "https://proxy.example.com", "https://proxy.example.com"},
		{"anthropic official with v1", storepb.AIProviderType_ANTHROPIC, "https://api.anthropic.com/v1", "", "https://api.anthropic.com"},
		{"anthropic compatible with v1", storepb.AIProviderType_ANTHROPIC_COMPATIBLE, "http://ollama:11434/v1", "http://ollama:11434", "http://ollama:11434"},
		{"anthropic compatible prefix", storepb.AIProviderType_ANTHROPIC_COMPATIBLE, "https://example.com/anthropic/v1", "https://example.com/anthropic", "https://example.com/anthropic"},
		{"anthropic host named v1", storepb.AIProviderType_ANTHROPIC_COMPATIBLE, "https://v1", "https://v1", "https://v1"},
		// A compatible service has no known path: the address is used as written.
		{"openai compatible host", storepb.AIProviderType_OPENAI_COMPATIBLE, "http://localhost:8080", "http://localhost:8080", "http://localhost:8080"},
		{"openai compatible path", storepb.AIProviderType_OPENAI_COMPATIBLE, "http://localhost:8080/v1", "http://localhost:8080/v1", "http://localhost:8080/v1"},
		// What is not a plain base URL is left for validation to judge.
		{"query", storepb.AIProviderType_OLLAMA, "http://ollama:11434?x=1", "http://ollama:11434?x=1", "http://ollama:11434?x=1"},
		{"empty query", storepb.AIProviderType_OLLAMA, "http://ollama:11434?", "http://ollama:11434?", "http://ollama:11434?"},
		{"empty fragment", storepb.AIProviderType_OLLAMA, "http://ollama:11434#", "http://ollama:11434#", "http://ollama:11434#"},
		{"no scheme", storepb.AIProviderType_OLLAMA, "ollama:11434", "ollama:11434", "ollama:11434"},
	} {
		provider := &storepb.AIProviderConfig{Id: "a", Type: test.providerType, Endpoint: test.endpoint}
		// A setting stored before the rule is still called at the completed address.
		require.Equal(t, test.resolved, ResolveEndpoint(provider), test.name)
		NormalizeSetting(&storepb.InstanceAISetting{Providers: []*storepb.AIProviderConfig{provider}})
		require.Equal(t, test.stored, provider.Endpoint, test.name)
		require.Equal(t, test.resolved, ResolveEndpoint(provider), test.name)
	}
}
