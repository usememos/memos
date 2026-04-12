package openai

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/ai"
)

type transcriptionResponse struct {
	Text     string  `json:"text"`
	Language string  `json:"language"`
	Duration float64 `json:"duration"`
}

type errorResponse struct {
	Error struct {
		Message string `json:"message"`
		Type    string `json:"type"`
		Code    string `json:"code"`
	} `json:"error"`
}

// Transcribe transcribes audio with the /audio/transcriptions endpoint.
func (t *Transcriber) Transcribe(ctx context.Context, request ai.TranscribeRequest) (*ai.TranscribeResponse, error) {
	if strings.TrimSpace(request.Model) == "" {
		return nil, errors.New("model is required")
	}
	if request.Audio == nil {
		return nil, errors.New("audio is required")
	}

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	if err := writeAudioFilePart(writer, request); err != nil {
		return nil, err
	}
	if err := writer.WriteField("model", request.Model); err != nil {
		return nil, errors.Wrap(err, "failed to write model field")
	}
	if err := writer.WriteField("response_format", "json"); err != nil {
		return nil, errors.Wrap(err, "failed to write response format field")
	}
	if request.Prompt != "" {
		if err := writer.WriteField("prompt", request.Prompt); err != nil {
			return nil, errors.Wrap(err, "failed to write prompt field")
		}
	}
	if request.Language != "" {
		if err := writer.WriteField("language", request.Language); err != nil {
			return nil, errors.Wrap(err, "failed to write language field")
		}
	}
	if err := writer.Close(); err != nil {
		return nil, errors.Wrap(err, "failed to close multipart writer")
	}

	httpRequest, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(t.endpoint, "/")+"/audio/transcriptions", body)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create transcription request")
	}
	httpRequest.Header.Set("Authorization", "Bearer "+t.apiKey)
	httpRequest.Header.Set("Content-Type", writer.FormDataContentType())

	httpResponse, err := t.httpClient.Do(httpRequest)
	if err != nil {
		return nil, errors.Wrap(err, "failed to send transcription request")
	}
	defer httpResponse.Body.Close()

	responseBody, err := io.ReadAll(httpResponse.Body)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read transcription response")
	}
	if httpResponse.StatusCode < http.StatusOK || httpResponse.StatusCode >= http.StatusMultipleChoices {
		return nil, errors.Errorf("transcription request failed with status %d: %s", httpResponse.StatusCode, extractErrorMessage(responseBody))
	}

	var response transcriptionResponse
	if err := json.Unmarshal(responseBody, &response); err != nil {
		return nil, errors.Wrap(err, "failed to unmarshal transcription response")
	}
	return &ai.TranscribeResponse{
		Text:     response.Text,
		Language: response.Language,
		Duration: response.Duration,
	}, nil
}

func writeAudioFilePart(writer *multipart.Writer, request ai.TranscribeRequest) error {
	filename := strings.TrimSpace(request.Filename)
	if filename == "" {
		filename = "audio"
	}
	contentType := strings.TrimSpace(request.ContentType)
	if contentType == "" {
		contentType = "application/octet-stream"
	} else {
		mediaType, _, err := mime.ParseMediaType(contentType)
		if err != nil {
			return errors.Wrap(err, "invalid audio content type")
		}
		contentType = mediaType
	}

	header := make(textproto.MIMEHeader)
	header.Set("Content-Disposition", mime.FormatMediaType("form-data", map[string]string{
		"name":     "file",
		"filename": sanitizeFilename(filename),
	}))
	header.Set("Content-Type", contentType)
	part, err := writer.CreatePart(header)
	if err != nil {
		return errors.Wrap(err, "failed to create audio file part")
	}
	if _, err := io.Copy(part, request.Audio); err != nil {
		return errors.Wrap(err, "failed to write audio file part")
	}
	return nil
}

func extractErrorMessage(responseBody []byte) string {
	var response errorResponse
	if err := json.Unmarshal(responseBody, &response); err == nil && response.Error.Message != "" {
		return response.Error.Message
	}
	return string(responseBody)
}

func sanitizeFilename(filename string) string {
	filename = strings.NewReplacer("\r", "_", "\n", "_").Replace(filename)
	if strings.TrimSpace(filename) == "" {
		return "audio"
	}
	return filename
}
