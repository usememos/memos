package v1

import (
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
)

func TestPreparePersistedTranscriptionConfigRejectsUnsupportedProviderType(t *testing.T) {
	setting := &storepb.InstanceAISetting{
		Providers:     []*storepb.AIProviderConfig{{Id: "router", Type: storepb.AIProviderType_OPENROUTER}},
		Transcription: &storepb.TranscriptionConfig{ProviderId: "router"},
	}

	err := preparePersistedTranscriptionConfig(setting, nil)
	require.ErrorContains(t, err, "not supported for transcription")
}

func TestPreparePersistedChatConfigRejectsUnsupportedProviderType(t *testing.T) {
	setting := &storepb.InstanceAISetting{
		Providers: []*storepb.AIProviderConfig{{Id: "gemini", Type: storepb.AIProviderType_GEMINI}},
		Chat:      &storepb.ChatConfig{ProviderId: "gemini", Model: "gemini-2.5-flash"},
	}

	err := preparePersistedChatConfig(setting, nil)
	require.ErrorContains(t, err, "not supported for chat")
}
