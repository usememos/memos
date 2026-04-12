package test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
)

func TestTranscribe(t *testing.T) {
	ctx := context.Background()

	t.Run("requires authentication", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		_, err := ts.Service.Transcribe(ctx, &v1pb.TranscribeRequest{
			ProviderId: "openai-main",
			Config: &v1pb.TranscriptionConfig{
				Model: "gpt-4o-transcribe",
			},
			Audio: &v1pb.TranscriptionAudio{
				Source:      &v1pb.TranscriptionAudio_Content{Content: []byte("RIFF")},
				Filename:    "voice.wav",
				ContentType: "audio/wav",
			},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "user not authenticated")
	})

	t.Run("transcribes audio file with configured provider", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "alice")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		openAIServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.Equal(t, "/audio/transcriptions", r.URL.Path)
			require.Equal(t, "Bearer sk-test", r.Header.Get("Authorization"))
			require.NoError(t, r.ParseMultipartForm(10<<20))
			require.Equal(t, "gpt-4o-transcribe", r.FormValue("model"))
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
							Id:           "openai-main",
							Title:        "OpenAI",
							Type:         storepb.AIProviderType_OPENAI_COMPATIBLE,
							Endpoint:     openAIServer.URL,
							ApiKey:       "sk-test",
							Models:       []string{"gpt-4o-transcribe"},
							DefaultModel: "gpt-4o-transcribe",
						},
					},
				},
			},
		})
		require.NoError(t, err)

		resp, err := ts.Service.Transcribe(userCtx, &v1pb.TranscribeRequest{
			ProviderId: "openai-main",
			Config: &v1pb.TranscriptionConfig{
				Prompt: "names: Alice",
			},
			Audio: &v1pb.TranscriptionAudio{
				Source:      &v1pb.TranscriptionAudio_Content{Content: []byte("RIFF")},
				Filename:    "voice.wav",
				ContentType: "audio/wav",
			},
		})
		require.NoError(t, err)
		require.Equal(t, "transcribed text", resp.Text)
	})

	t.Run("rejects unconfigured model", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "bob")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		_, err = ts.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
			Key: storepb.InstanceSettingKey_AI,
			Value: &storepb.InstanceSetting_AiSetting{
				AiSetting: &storepb.InstanceAISetting{
					Providers: []*storepb.AIProviderConfig{
						{
							Id:           "openai-main",
							Title:        "OpenAI",
							Type:         storepb.AIProviderType_OPENAI_COMPATIBLE,
							Endpoint:     "https://example.com/v1",
							ApiKey:       "sk-test",
							Models:       []string{"gpt-4o-transcribe"},
							DefaultModel: "gpt-4o-transcribe",
						},
					},
				},
			},
		})
		require.NoError(t, err)

		_, err = ts.Service.Transcribe(userCtx, &v1pb.TranscribeRequest{
			ProviderId: "openai-main",
			Config: &v1pb.TranscriptionConfig{
				Model: "other-model",
			},
			Audio: &v1pb.TranscriptionAudio{
				Source:      &v1pb.TranscriptionAudio_Content{Content: []byte("RIFF")},
				Filename:    "voice.wav",
				ContentType: "audio/wav",
			},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "not configured")
	})

	t.Run("rejects non-audio content before provider call", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "charlie")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		_, err = ts.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
			Key: storepb.InstanceSettingKey_AI,
			Value: &storepb.InstanceSetting_AiSetting{
				AiSetting: &storepb.InstanceAISetting{
					Providers: []*storepb.AIProviderConfig{
						{
							Id:           "openai-main",
							Title:        "OpenAI",
							Type:         storepb.AIProviderType_OPENAI_COMPATIBLE,
							Endpoint:     "https://example.com/v1",
							ApiKey:       "sk-test",
							Models:       []string{"gpt-4o-transcribe"},
							DefaultModel: "gpt-4o-transcribe",
						},
					},
				},
			},
		})
		require.NoError(t, err)

		_, err = ts.Service.Transcribe(userCtx, &v1pb.TranscribeRequest{
			ProviderId: "openai-main",
			Config: &v1pb.TranscriptionConfig{
				Model: "gpt-4o-transcribe",
			},
			Audio: &v1pb.TranscriptionAudio{
				Source:      &v1pb.TranscriptionAudio_Content{Content: []byte("not audio")},
				Filename:    "notes.txt",
				ContentType: "text/plain",
			},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "not supported")
	})
}
