package test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
)

func TestTranscribe(t *testing.T) {
	ctx := context.Background()

	t.Run("requires authentication", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		_, err := ts.Service.Transcribe(ctx, &apipb.TranscribeRequest{
			Audio: &apipb.TranscriptionAudio{
				Source:      &apipb.TranscriptionAudio_Content{Content: []byte("RIFF")},
				Filename:    "voice.wav",
				ContentType: "audio/wav",
			},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "user not authenticated")
	})

	t.Run("transcribes audio file using persisted transcription setting", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "alice")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		openAIServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.Equal(t, "/audio/transcriptions", r.URL.Path)
			require.Equal(t, "Bearer sk-test", r.Header.Get("Authorization"))
			require.NoError(t, r.ParseMultipartForm(10<<20))
			require.Equal(t, "whisper-1", r.FormValue("model"))
			require.Equal(t, "fr", r.FormValue("language"))
			require.Equal(t, "names: Alice", r.FormValue("prompt"))

			file, header, err := r.FormFile("file")
			require.NoError(t, err)
			defer file.Close()
			require.Equal(t, "voice.wav", header.Filename)

			w.Header().Set("Content-Type", "application/json")
			require.NoError(t, json.NewEncoder(w).Encode(map[string]string{
				"text": "transcribed text",
			}))
		}))
		defer openAIServer.Close()

		_, err = ts.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
			Key: storepb.InstanceSettingKey_AI,
			Value: &storepb.InstanceSetting_AiSetting{
				AiSetting: &storepb.InstanceAISetting{
					Providers: []*storepb.AIProviderConfig{
						{
							Id:       "openai-main",
							Title:    "OpenAI",
							Type:     storepb.AIProviderType_OPENAI,
							Endpoint: openAIServer.URL,
							ApiKey:   "sk-test",
						},
					},
					Transcription: &storepb.TranscriptionConfig{
						ProviderId: "openai-main",
						Model:      "whisper-1",
						Language:   "fr",
						Prompt:     "names: Alice",
					},
				},
			},
		})
		require.NoError(t, err)

		resp, err := ts.Service.Transcribe(userCtx, &apipb.TranscribeRequest{
			Audio: &apipb.TranscriptionAudio{
				Source:      &apipb.TranscriptionAudio_Content{Content: []byte("RIFF")},
				Filename:    "voice.wav",
				ContentType: "audio/wav",
			},
		})
		require.NoError(t, err)
		require.Equal(t, "transcribed text", resp.Text)
	})

	t.Run("returns provider error without rewriting it", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "notfound-user")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		openAIServer := httptest.NewServer(http.NotFoundHandler())
		defer openAIServer.Close()

		_, err = ts.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
			Key: storepb.InstanceSettingKey_AI,
			Value: &storepb.InstanceSetting_AiSetting{
				AiSetting: &storepb.InstanceAISetting{
					Providers: []*storepb.AIProviderConfig{
						{
							Id:       "openai-main",
							Title:    "OpenAI",
							Type:     storepb.AIProviderType_OPENAI,
							Endpoint: openAIServer.URL,
							ApiKey:   "sk-test",
						},
					},
					Transcription: &storepb.TranscriptionConfig{
						ProviderId: "openai-main",
						Model:      "gpt-transcribe",
					},
				},
			},
		})
		require.NoError(t, err)

		_, err = ts.Service.Transcribe(userCtx, &apipb.TranscribeRequest{
			Audio: &apipb.TranscriptionAudio{
				Source:      &apipb.TranscriptionAudio_Content{Content: []byte("RIFF")},
				Filename:    "voice.wav",
				ContentType: "audio/wav",
			},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "failed to transcribe audio")
	})

	t.Run("transcribes audio file with Gemini provider", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "gemini-user")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		geminiServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.Equal(t, "/v1beta/models/gemini-2.5-flash:generateContent", r.URL.Path)
			require.Equal(t, "gemini-key", r.Header.Get("x-goog-api-key"))
			w.Header().Set("Content-Type", "application/json")
			require.NoError(t, json.NewEncoder(w).Encode(map[string]any{
				"candidates": []map[string]any{
					{
						"finishReason": "STOP",
						"content": map[string]any{
							"parts": []map[string]string{{"text": "gemini transcript"}},
						},
					},
				},
			}))
		}))
		defer geminiServer.Close()

		_, err = ts.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
			Key: storepb.InstanceSettingKey_AI,
			Value: &storepb.InstanceSetting_AiSetting{
				AiSetting: &storepb.InstanceAISetting{
					Providers: []*storepb.AIProviderConfig{
						{
							Id:       "gemini-main",
							Title:    "Gemini",
							Type:     storepb.AIProviderType_GEMINI,
							Endpoint: geminiServer.URL + "/v1beta",
							ApiKey:   "gemini-key",
						},
					},
					Transcription: &storepb.TranscriptionConfig{
						ProviderId: "gemini-main",
						Model:      "gemini-2.5-flash",
					},
				},
			},
		})
		require.NoError(t, err)

		resp, err := ts.Service.Transcribe(userCtx, &apipb.TranscribeRequest{
			Audio: &apipb.TranscriptionAudio{
				Source:      &apipb.TranscriptionAudio_Content{Content: []byte("mp3 bytes")},
				Filename:    "voice.mp3",
				ContentType: "audio/mp3",
			},
		})
		require.NoError(t, err)
		require.Equal(t, "gemini transcript", resp.Text)
	})

	t.Run("rejects audio the Gemini provider cannot take as InvalidArgument", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "gemini-unsupported")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		geminiServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			t.Error("Gemini must not be called for audio it cannot take")
			w.WriteHeader(http.StatusInternalServerError)
		}))
		defer geminiServer.Close()

		_, err = ts.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
			Key: storepb.InstanceSettingKey_AI,
			Value: &storepb.InstanceSetting_AiSetting{
				AiSetting: &storepb.InstanceAISetting{
					Providers: []*storepb.AIProviderConfig{
						{
							Id:       "gemini-main",
							Title:    "Gemini",
							Type:     storepb.AIProviderType_GEMINI,
							Endpoint: geminiServer.URL + "/v1beta",
							ApiKey:   "gemini-key",
						},
					},
					Transcription: &storepb.TranscriptionConfig{
						ProviderId: "gemini-main",
						Model:      "gemini-2.5-flash",
					},
				},
			},
		})
		require.NoError(t, err)

		for _, audio := range []*apipb.TranscriptionAudio{
			// Accepted by the API (OpenAI's format list), not by Gemini.
			{Source: &apipb.TranscriptionAudio_Content{Content: []byte("m4a bytes")}, Filename: "memo.m4a", ContentType: "audio/x-m4a"},
			{Source: &apipb.TranscriptionAudio_Content{Content: []byte("mp4 bytes")}, Filename: "recording.mp4", ContentType: "audio/mp4"},
			// Within the API's 25 MiB limit, over Gemini's inline limit.
			{Source: &apipb.TranscriptionAudio_Content{Content: make([]byte, 15<<20)}, Filename: "long.wav", ContentType: "audio/wav"},
		} {
			_, err := ts.Service.Transcribe(userCtx, &apipb.TranscribeRequest{Audio: audio})
			require.Error(t, err, audio.Filename)
			require.Equal(t, codes.InvalidArgument, status.Code(err), "%s: %v", audio.Filename, err)
		}
	})

	t.Run("treats a setting stored without a model as not configured", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "bob")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		openAIServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			t.Error("no model is guessed, so the provider must not be called")
			w.WriteHeader(http.StatusInternalServerError)
		}))
		defer openAIServer.Close()

		_, err = ts.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
			Key: storepb.InstanceSettingKey_AI,
			Value: &storepb.InstanceSetting_AiSetting{
				AiSetting: &storepb.InstanceAISetting{
					Providers: []*storepb.AIProviderConfig{
						{
							Id:       "openai-main",
							Title:    "OpenAI",
							Type:     storepb.AIProviderType_OPENAI,
							Endpoint: openAIServer.URL,
							ApiKey:   "sk-test",
						},
					},
					Transcription: &storepb.TranscriptionConfig{
						ProviderId: "openai-main",
					},
				},
			},
		})
		require.NoError(t, err)

		_, err = ts.Service.Transcribe(userCtx, &apipb.TranscribeRequest{
			Audio: &apipb.TranscriptionAudio{
				Source:      &apipb.TranscriptionAudio_Content{Content: []byte("RIFF")},
				Filename:    "voice.wav",
				ContentType: "audio/wav",
			},
		})
		require.Equal(t, codes.FailedPrecondition, status.Code(err))
		require.Contains(t, err.Error(), "transcription is not configured")

		// The same holds for every reader of the setting, including the availability flags.
		profile, err := ts.Service.GetInstanceProfile(userCtx, &apipb.GetInstanceProfileRequest{})
		require.NoError(t, err)
		require.False(t, profile.GetAiFeatures().GetTranscription())
	})

	t.Run("rejects non-audio content before provider call", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "charlie")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		_, err = ts.Service.Transcribe(userCtx, &apipb.TranscribeRequest{
			Audio: &apipb.TranscriptionAudio{
				Source:      &apipb.TranscriptionAudio_Content{Content: []byte("not audio")},
				Filename:    "notes.txt",
				ContentType: "text/plain",
			},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "not supported")
	})

	t.Run("returns FailedPrecondition when transcription is not configured", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "alice-empty")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		_, err = ts.Service.Transcribe(userCtx, &apipb.TranscribeRequest{
			Audio: &apipb.TranscriptionAudio{
				Source:      &apipb.TranscriptionAudio_Content{Content: []byte("RIFF")},
				Filename:    "voice.wav",
				ContentType: "audio/wav",
			},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "transcription is not configured")
	})
}
