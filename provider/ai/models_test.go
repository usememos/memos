package ai_test

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/provider/ai"
)

func TestOpenAITranscriptionDefault(t *testing.T) {
	for _, tc := range []struct{ endpoint, model string }{
		{"", "gpt-transcribe"},
		{"https://api.openai.com/v1/", "gpt-transcribe"},
		{"https://whisper.example.com/v1", "whisper-1"},
	} {
		model, err := ai.DefaultTranscriptionModel(ai.ProviderConfig{Type: ai.ProviderOpenAI, Endpoint: tc.endpoint})
		require.NoError(t, err)
		require.Equal(t, tc.model, model, tc.endpoint)
	}
}
