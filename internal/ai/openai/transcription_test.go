package openai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/ai"
)

func TestTranscribe(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)
		require.Equal(t, "/audio/transcriptions", r.URL.Path)
		require.Equal(t, "Bearer test-key", r.Header.Get("Authorization"))
		require.NoError(t, r.ParseMultipartForm(10<<20))
		require.Equal(t, "gpt-4o-transcribe", r.FormValue("model"))
		require.Equal(t, "json", r.FormValue("response_format"))
		require.Equal(t, "domain words", r.FormValue("prompt"))
		require.Equal(t, "en", r.FormValue("language"))

		file, header, err := r.FormFile("file")
		require.NoError(t, err)
		defer file.Close()
		require.Equal(t, "voice.wav", header.Filename)
		require.Equal(t, "audio/wav", header.Header.Get("Content-Type"))

		w.Header().Set("Content-Type", "application/json")
		require.NoError(t, json.NewEncoder(w).Encode(map[string]any{
			"text":     "hello world",
			"language": "en",
			"duration": 1.5,
		}))
	}))
	defer server.Close()

	transcriber, err := NewTranscriber(ai.ProviderConfig{
		Endpoint: server.URL,
		APIKey:   "test-key",
	})
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	response, err := transcriber.Transcribe(ctx, ai.TranscribeRequest{
		Model:       "gpt-4o-transcribe",
		Filename:    "voice.wav",
		ContentType: "audio/wav",
		Audio:       strings.NewReader("RIFF"),
		Prompt:      "domain words",
		Language:    "en",
	})
	require.NoError(t, err)
	require.Equal(t, "hello world", response.Text)
	require.Equal(t, "en", response.Language)
	require.Equal(t, 1.5, response.Duration)
}
