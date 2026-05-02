package gemini_test

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

	"github.com/usememos/memos/internal/ai"
	"github.com/usememos/memos/internal/ai/audiollm"
	audiollmgemini "github.com/usememos/memos/internal/ai/audiollm/gemini"
)

func TestGenerateFromAudio(t *testing.T) {
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
		require.Equal(t, "transcribe please", request.Contents[0].Parts[1].Text)
		require.Equal(t, json.Number("0"), request.GenerationConfig["temperature"])

		w.Header().Set("Content-Type", "application/json")
		require.NoError(t, json.NewEncoder(w).Encode(map[string]any{
			"candidates": []map[string]any{
				{
					"finishReason": "STOP",
					"content": map[string]any{
						"parts": []map[string]string{{"text": "hello from gemini"}},
					},
				},
			},
		}))
	}))
	defer server.Close()

	model, err := audiollmgemini.New(ai.ProviderConfig{
		Type:     ai.ProviderGemini,
		Endpoint: server.URL + "/v1beta",
		APIKey:   "test-key",
	}, audiollm.ApplyOptions(nil))
	require.NoError(t, err)

	temp := float32(0)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	resp, err := model.GenerateFromAudio(ctx, audiollm.Request{
		Model:        "models/gemini-2.5-flash",
		ContentType:  "audio/mpeg",
		Audio:        strings.NewReader("audio bytes"),
		Instructions: "transcribe please",
		Temperature:  &temp,
	})
	require.NoError(t, err)
	require.Equal(t, "hello from gemini", resp.Text)
	require.Equal(t, audiollm.FinishStop, resp.FinishReason)
}

func TestGenerateFromAudioRejectsUnsupportedContentType(t *testing.T) {
	t.Parallel()

	model, err := audiollmgemini.New(ai.ProviderConfig{
		Type:     ai.ProviderGemini,
		Endpoint: "https://example.com/v1beta",
		APIKey:   "test-key",
	}, audiollm.ApplyOptions(nil))
	require.NoError(t, err)

	_, err = model.GenerateFromAudio(context.Background(), audiollm.Request{
		Model:        "gemini-2.5-flash",
		ContentType:  "video/mp4",
		Audio:        strings.NewReader("video bytes"),
		Instructions: "transcribe please",
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "not supported by Gemini")
}
