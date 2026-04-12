package gemini

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"mime"
	"net/http"
	"net/url"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/ai"
)

const (
	transcriptionInstruction = `Transcribe the audio accurately. Return only the transcript text. Do not summarize, explain, or add content that is not spoken.`
	maxInlineAudioSizeBytes  = 14 * 1024 * 1024
)

var supportedContentTypes = map[string]string{
	"audio/wav":    "audio/wav",
	"audio/x-wav":  "audio/wav",
	"audio/mp3":    "audio/mp3",
	"audio/mpeg":   "audio/mp3",
	"audio/aiff":   "audio/aiff",
	"audio/aac":    "audio/aac",
	"audio/ogg":    "audio/ogg",
	"audio/flac":   "audio/flac",
	"audio/x-flac": "audio/flac",
}

type generateContentRequest struct {
	Contents         []content              `json:"contents"`
	GenerationConfig map[string]json.Number `json:"generationConfig,omitempty"`
}

type content struct {
	Role  string `json:"role,omitempty"`
	Parts []part `json:"parts"`
}

type part struct {
	Text       string      `json:"text,omitempty"`
	InlineData *inlineData `json:"inlineData,omitempty"`
}

type inlineData struct {
	MIMEType string `json:"mimeType"`
	Data     string `json:"data"`
}

type generateContentResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

type errorResponse struct {
	Error struct {
		Message string `json:"message"`
		Status  string `json:"status"`
	} `json:"error"`
}

// Transcribe transcribes audio with Gemini generateContent.
func (t *Transcriber) Transcribe(ctx context.Context, request ai.TranscribeRequest) (*ai.TranscribeResponse, error) {
	if strings.TrimSpace(request.Model) == "" {
		return nil, errors.New("model is required")
	}
	if request.Audio == nil {
		return nil, errors.New("audio is required")
	}
	audio, err := io.ReadAll(request.Audio)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read audio")
	}
	if len(audio) == 0 {
		return nil, errors.New("audio is required")
	}
	if len(audio) > maxInlineAudioSizeBytes {
		return nil, errors.Errorf("audio is too large for Gemini inline transcription; maximum size is %d bytes", maxInlineAudioSizeBytes)
	}

	contentType, err := normalizeContentType(request.ContentType)
	if err != nil {
		return nil, err
	}
	prompt := buildTranscriptionPrompt(request.Prompt, request.Language)
	body, err := json.Marshal(generateContentRequest{
		Contents: []content{
			{
				Role: "user",
				Parts: []part{
					{InlineData: &inlineData{
						MIMEType: contentType,
						Data:     base64.StdEncoding.EncodeToString(audio),
					}},
					{Text: prompt},
				},
			},
		},
		GenerationConfig: map[string]json.Number{
			"temperature": json.Number("0"),
		},
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal Gemini transcription request")
	}

	httpRequest, err := http.NewRequestWithContext(ctx, http.MethodPost, t.endpoint+"/models/"+url.PathEscape(normalizeModelName(request.Model))+":generateContent", bytes.NewReader(body))
	if err != nil {
		return nil, errors.Wrap(err, "failed to create Gemini transcription request")
	}
	httpRequest.Header.Set("Content-Type", "application/json")
	httpRequest.Header.Set("x-goog-api-key", t.apiKey)

	httpResponse, err := t.httpClient.Do(httpRequest)
	if err != nil {
		return nil, errors.Wrap(err, "failed to send Gemini transcription request")
	}
	defer httpResponse.Body.Close()

	responseBody, err := io.ReadAll(httpResponse.Body)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read Gemini transcription response")
	}
	if httpResponse.StatusCode < http.StatusOK || httpResponse.StatusCode >= http.StatusMultipleChoices {
		return nil, errors.Errorf("Gemini transcription request failed with status %d: %s", httpResponse.StatusCode, extractErrorMessage(responseBody))
	}

	var response generateContentResponse
	if err := json.Unmarshal(responseBody, &response); err != nil {
		return nil, errors.Wrap(err, "failed to unmarshal Gemini transcription response")
	}
	text := extractText(response)
	if text == "" {
		return nil, errors.New("Gemini transcription response did not include text")
	}
	return &ai.TranscribeResponse{
		Text: text,
	}, nil
}

func normalizeContentType(contentType string) (string, error) {
	mediaType, _, err := mime.ParseMediaType(strings.TrimSpace(contentType))
	if err != nil {
		return "", errors.Wrap(err, "invalid audio content type")
	}
	mediaType = strings.ToLower(mediaType)
	normalized, ok := supportedContentTypes[mediaType]
	if !ok {
		return "", errors.Errorf("audio content type %q is not supported by Gemini", mediaType)
	}
	return normalized, nil
}

func buildTranscriptionPrompt(prompt string, language string) string {
	parts := []string{transcriptionInstruction}
	language = strings.TrimSpace(language)
	if language != "" {
		parts = append(parts, "The input language is "+language+".")
	}
	prompt = strings.TrimSpace(prompt)
	if prompt != "" {
		parts = append(parts, "Context and spelling hints:\n"+prompt)
	}
	return strings.Join(parts, "\n\n")
}

func normalizeModelName(model string) string {
	return strings.TrimPrefix(strings.TrimSpace(model), "models/")
}

func extractText(response generateContentResponse) string {
	var texts []string
	for _, candidate := range response.Candidates {
		for _, part := range candidate.Content.Parts {
			text := strings.TrimSpace(part.Text)
			if text != "" {
				texts = append(texts, text)
			}
		}
	}
	return strings.Join(texts, "\n")
}

func extractErrorMessage(responseBody []byte) string {
	var response errorResponse
	if err := json.Unmarshal(responseBody, &response); err == nil && response.Error.Message != "" {
		return response.Error.Message
	}
	return string(responseBody)
}
