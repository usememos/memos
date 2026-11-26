package store

import (
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
)

// A capability is a provider and a model together. Settings stored before both were
// required read as off, so no reader has to handle half a capability.
func TestAISettingStoredWithoutProviderOrModelReadsAsOff(t *testing.T) {
	read := func(value string) *storepb.InstanceAISetting {
		t.Helper()
		setting, err := convertInstanceSettingFromRaw(&InstanceSetting{Name: storepb.InstanceSettingKey_AI.String(), Value: value})
		require.NoError(t, err)
		return setting.GetAiSetting()
	}

	legacy := read(`{"providers":[{"id":"p","type":"OPENAI"}],"transcription":{"providerId":"p","language":"en"},"textGeneration":{"providerId":""}}`)
	require.Len(t, legacy.Providers, 1)
	require.Nil(t, legacy.Transcription, "a provider without a model")
	require.Nil(t, legacy.TextGeneration, "the old way of saying off")

	complete := read(`{"transcription":{"providerId":"p","model":"speech","language":"en"},"textGeneration":{"providerId":"p","model":"text"}}`)
	require.Equal(t, "speech", complete.Transcription.Model)
	require.Equal(t, "en", complete.Transcription.Language)
	require.Equal(t, "text", complete.TextGeneration.Model)
}
