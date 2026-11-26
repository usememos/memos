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

func TestNormalizeSetting(t *testing.T) {
	setting := &storepb.InstanceAISetting{
		Providers: []*storepb.AIProviderConfig{
			{Id: " a ", Title: " OpenAI ", Type: storepb.AIProviderType_OPENAI},
			{Id: "b", Type: storepb.AIProviderType_GEMINI, Endpoint: " https://proxy.example.com "},
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
	require.Equal(t, defaultOpenAIEndpoint, setting.Providers[0].Endpoint)
	require.Equal(t, "https://proxy.example.com", setting.Providers[1].Endpoint)
	require.Equal(t, "a", setting.Transcription.ProviderId)
	require.Equal(t, "whisper-1", setting.Transcription.Model)
}
