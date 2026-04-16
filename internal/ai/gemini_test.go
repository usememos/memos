package ai

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestGeminiTranscribe(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)
		require.Equal(t, "/v1beta/models/gemini-2.5-flash:generateContent", r.URL.Path)
		require.Equal(t, "test-key", r.Header.Get("x-goog-api-key"))
		require.Equal(t, "application/json", r.Header.Get("Content-Type"))

		var request struct {
			Contents []struct {
				Parts []struct {
					Text       string `json:"text"`
					InlineData *struct {
						MIMEType string `json:"mimeType"`
						Data     string `json:"data"`
					} `json:"inlineData"`
				} `json:"parts"`
			} `json:"contents"`
			GenerationConfig map[string]json.Number `json:"generationConfig"`
		}
		require.NoError(t, json.NewDecoder(r.Body).Decode(&request))
		require.Len(t, request.Contents, 1)
		require.Len(t, request.Contents[0].Parts, 2)
		require.NotNil(t, request.Contents[0].Parts[0].InlineData)
		require.Equal(t, "audio/mp3", request.Contents[0].Parts[0].InlineData.MIMEType)
		audio, err := base64.StdEncoding.DecodeString(request.Contents[0].Parts[0].InlineData.Data)
		require.NoError(t, err)
		require.Equal(t, "audio bytes", string(audio))
		require.Contains(t, request.Contents[0].Parts[1].Text, "Return only the transcript text")
		require.Contains(t, request.Contents[0].Parts[1].Text, "Context and spelling hints")
		require.Equal(t, json.Number("0"), request.GenerationConfig["temperature"])

		w.Header().Set("Content-Type", "application/json")
		require.NoError(t, json.NewEncoder(w).Encode(map[string]any{
			"candidates": []map[string]any{
				{
					"content": map[string]any{
						"parts": []map[string]string{{"text": "hello from gemini"}},
					},
				},
			},
		}))
	}))
	defer server.Close()

	transcriber, err := NewTranscriber(ProviderConfig{
		Type:     ProviderGemini,
		Endpoint: server.URL + "/v1beta",
		APIKey:   "test-key",
	})
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	response, err := transcriber.Transcribe(ctx, TranscribeRequest{
		Model:       "models/gemini-2.5-flash",
		ContentType: "audio/mpeg",
		Audio:       strings.NewReader("audio bytes"),
		Prompt:      "Memos, Steven",
		Language:    "en",
	})
	require.NoError(t, err)
	require.Equal(t, "hello from gemini", response.Text)
}

func TestGeminiTranscribeRejectsUnsupportedContentType(t *testing.T) {
	t.Parallel()

	transcriber, err := NewTranscriber(ProviderConfig{
		Type:     ProviderGemini,
		Endpoint: "https://example.com/v1beta",
		APIKey:   "test-key",
	})
	require.NoError(t, err)

	_, err = transcriber.Transcribe(context.Background(), TranscribeRequest{
		Model:       "gemini-2.5-flash",
		ContentType: "video/mp4",
		Audio:       strings.NewReader("video bytes"),
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "not supported by Gemini")
}
