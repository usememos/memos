package v1

import (
	"bytes"
	"context"
	"mime"
	"net/http"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/usememos/memos/internal/ai"
	"github.com/usememos/memos/internal/ai/gemini"
	"github.com/usememos/memos/internal/ai/openai"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
)

const (
	maxTranscriptionAudioSizeBytes = 25 * MebiByte
	maxTranscriptionPromptLength   = 4096
	maxTranscriptionLanguageLength = 32
	maxTranscriptionFilenameLength = 255
)

var supportedTranscriptionContentTypes = map[string]bool{
	"audio/aac":    true,
	"audio/aiff":   true,
	"audio/flac":   true,
	"audio/mpeg":   true,
	"audio/mp3":    true,
	"audio/mp4":    true,
	"audio/mpga":   true,
	"audio/ogg":    true,
	"audio/wav":    true,
	"audio/x-wav":  true,
	"audio/x-flac": true,
	"audio/x-m4a":  true,
	"audio/webm":   true,
	"video/mp4":    true,
	"video/mpeg":   true,
	"video/webm":   true,
}

// Transcribe transcribes an audio file using an instance AI provider.
func (s *APIV1Service) Transcribe(ctx context.Context, request *v1pb.TranscribeRequest) (*v1pb.TranscribeResponse, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	if strings.TrimSpace(request.ProviderId) == "" {
		return nil, status.Errorf(codes.InvalidArgument, "provider_id is required")
	}
	if request.Config == nil {
		return nil, status.Errorf(codes.InvalidArgument, "config is required")
	}
	prompt := strings.TrimSpace(request.Config.GetPrompt())
	if len(prompt) > maxTranscriptionPromptLength {
		return nil, status.Errorf(codes.InvalidArgument, "prompt is too long; maximum length is %d characters", maxTranscriptionPromptLength)
	}
	language := strings.TrimSpace(request.Config.GetLanguage())
	if len(language) > maxTranscriptionLanguageLength {
		return nil, status.Errorf(codes.InvalidArgument, "language is too long; maximum length is %d characters", maxTranscriptionLanguageLength)
	}
	if request.Audio == nil {
		return nil, status.Errorf(codes.InvalidArgument, "audio is required")
	}
	if request.Audio.GetUri() != "" {
		return nil, status.Errorf(codes.InvalidArgument, "audio uri is not supported")
	}
	content := request.Audio.GetContent()
	if len(content) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "audio content is required")
	}
	if len(content) > maxTranscriptionAudioSizeBytes {
		return nil, status.Errorf(codes.InvalidArgument, "audio file is too large; maximum size is 25 MiB")
	}
	filename := strings.TrimSpace(request.Audio.GetFilename())
	if len(filename) > maxTranscriptionFilenameLength {
		return nil, status.Errorf(codes.InvalidArgument, "filename is too long; maximum length is %d characters", maxTranscriptionFilenameLength)
	}
	contentType := strings.TrimSpace(request.Audio.GetContentType())
	if contentType == "" {
		contentType = http.DetectContentType(content)
	}
	if !isSupportedTranscriptionContentType(contentType) {
		return nil, status.Errorf(codes.InvalidArgument, "audio content type %q is not supported", contentType)
	}

	provider, model, err := s.resolveAIProviderForTranscription(ctx, request.ProviderId, request.Config.GetModel())
	if err != nil {
		return nil, err
	}
	transcriber, err := newAITranscriber(provider)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "failed to create AI transcriber: %v", err)
	}

	transcription, err := transcriber.Transcribe(ctx, ai.TranscribeRequest{
		Model:       model,
		Filename:    filename,
		ContentType: contentType,
		Audio:       bytes.NewReader(content),
		Size:        int64(len(content)),
		Prompt:      prompt,
		Language:    language,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to transcribe audio: %v", err)
	}
	return &v1pb.TranscribeResponse{
		Text: transcription.Text,
	}, nil
}

func (s *APIV1Service) resolveAIProviderForTranscription(ctx context.Context, providerID string, model string) (ai.ProviderConfig, string, error) {
	setting, err := s.Store.GetInstanceAISetting(ctx)
	if err != nil {
		return ai.ProviderConfig{}, "", status.Errorf(codes.Internal, "failed to get AI setting: %v", err)
	}

	providers := make([]ai.ProviderConfig, 0, len(setting.GetProviders()))
	for _, provider := range setting.GetProviders() {
		if provider == nil {
			continue
		}
		providers = append(providers, convertAIProviderConfigFromStore(provider))
	}

	provider, err := ai.FindProvider(providers, providerID)
	if err != nil {
		return ai.ProviderConfig{}, "", status.Errorf(codes.NotFound, "AI provider not found")
	}
	selectedModel := strings.TrimSpace(model)
	if selectedModel == "" {
		selectedModel = provider.DefaultModel
	}
	if selectedModel == "" {
		return ai.ProviderConfig{}, "", status.Errorf(codes.InvalidArgument, "model is required")
	}
	if !containsString(provider.Models, selectedModel) {
		return ai.ProviderConfig{}, "", status.Errorf(codes.InvalidArgument, "model %q is not configured for provider %q", selectedModel, provider.ID)
	}
	return *provider, selectedModel, nil
}

func convertAIProviderConfigFromStore(provider *storepb.AIProviderConfig) ai.ProviderConfig {
	return ai.ProviderConfig{
		ID:           provider.GetId(),
		Title:        provider.GetTitle(),
		Type:         convertAIProviderTypeFromStore(provider.GetType()),
		Endpoint:     provider.GetEndpoint(),
		APIKey:       provider.GetApiKey(),
		Models:       provider.GetModels(),
		DefaultModel: provider.GetDefaultModel(),
	}
}

func convertAIProviderTypeFromStore(providerType storepb.AIProviderType) ai.ProviderType {
	switch providerType {
	case storepb.AIProviderType_OPENAI:
		return ai.ProviderOpenAI
	case storepb.AIProviderType_OPENAI_COMPATIBLE:
		return ai.ProviderOpenAICompatible
	case storepb.AIProviderType_GEMINI:
		return ai.ProviderGemini
	case storepb.AIProviderType_ANTHROPIC:
		return ai.ProviderAnthropic
	default:
		return ""
	}
}

func newAITranscriber(provider ai.ProviderConfig) (ai.Transcriber, error) {
	switch provider.Type {
	case ai.ProviderOpenAI, ai.ProviderOpenAICompatible:
		return openai.NewTranscriber(provider)
	case ai.ProviderGemini:
		return gemini.NewTranscriber(provider)
	default:
		return nil, errors.Wrapf(ai.ErrCapabilityUnsupported, "provider type %q", provider.Type)
	}
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func isSupportedTranscriptionContentType(contentType string) bool {
	mediaType, _, err := mime.ParseMediaType(strings.TrimSpace(contentType))
	if err != nil {
		return false
	}
	mediaType = strings.ToLower(mediaType)
	return supportedTranscriptionContentTypes[mediaType]
}
