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
			{Id: "b", Type: storepb.AIProviderType_GEMINI, Endpoint: " https://proxy.example.com/ "},
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
	require.Equal(t, "https://proxy.example.com", setting.Providers[1].Endpoint)
	require.Equal(t, "a", setting.Transcription.ProviderId)
	require.Equal(t, "whisper-1", setting.Transcription.Model)
}
