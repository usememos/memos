# STT and Audio-LLM Split — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `internal/ai/` into a `stt/` (deterministic transcription) and `audiollm/` (multimodal audio LLM) package pair, port behavior from the current `openai.go` and `gemini.go`, refactor the `Transcribe` API handler to dispatch by provider type, then update proto comments and frontend i18n. End state preserves current end-to-end behavior; the response field for Gemini failures is more informative (`FinishReason`).

**Architecture:** Two new packages under `internal/ai/`. Each has a thin interface in the parent (`stt.Transcriber`, `audiollm.Model`), a factory that switches on `ai.ProviderType`, and a sub-package per provider (`stt/openai/`, `audiollm/gemini/`). Application-layer dispatch in the gRPC handler decides which interface to invoke. No proto field changes — only two comment updates.

**Tech Stack:** Go 1.x (existing Memos toolchain), `github.com/openai/openai-go/v3`, `google.golang.org/genai`, `github.com/pkg/errors`, `github.com/stretchr/testify`. Proto: buf v2. Frontend: TypeScript + bufbuild/es.

**Spec:** `docs/superpowers/specs/2026-05-02-stt-audiollm-split-design.md` — read it before starting; this plan implements §6–§7 of the spec.

**Worktree:** Run from a dedicated worktree (e.g., `git worktree add ../memos-stt-split`). Each stage is a separate commit; the branch should be PR-ready when all 7 stages are done.

---

## File Manifest

**Created (new files):**
- `internal/ai/stt/stt.go`
- `internal/ai/stt/options.go`
- `internal/ai/stt/factory.go`
- `internal/ai/stt/openai/openai.go`
- `internal/ai/stt/openai/openai_test.go`
- `internal/ai/audiollm/audiollm.go`
- `internal/ai/audiollm/options.go`
- `internal/ai/audiollm/factory.go`
- `internal/ai/audiollm/gemini/gemini.go`
- `internal/ai/audiollm/gemini/gemini_test.go`

**Modified:**
- `internal/ai/errors.go` (add 2 sentinel errors)
- `proto/store/instance_setting.proto` (2 field-comment blocks)
- `proto/gen/store/instance_setting.pb.go` (regenerated)
- `web/src/types/proto/store/instance_setting_pb.ts` (regenerated)
- `server/router/api/v1/ai_service.go` (refactor `Transcribe` handler)
- `web/src/locales/en.json` (3 strings)

**Deleted:**
- `internal/ai/transcription.go`
- `internal/ai/client.go`
- `internal/ai/openai.go`
- `internal/ai/openai_test.go`
- `internal/ai/gemini.go`
- `internal/ai/gemini_test.go`

**Untouched:**
- `internal/ai/ai.go`, `resolver.go`, `models.go`
- `internal/ai/audio/webm.go`, `audio/webm_test.go`
- `web/src/components/Settings/AISection.tsx` (no structural change; only the i18n strings it consumes change)

---

## Stage A: Scaffold new packages and add sentinel errors

**Files:**
- Modify: `internal/ai/errors.go`
- Create: `internal/ai/stt/stt.go`
- Create: `internal/ai/stt/options.go`
- Create: `internal/ai/stt/factory.go`
- Create: `internal/ai/audiollm/audiollm.go`
- Create: `internal/ai/audiollm/options.go`
- Create: `internal/ai/audiollm/factory.go`

This stage adds types and stubs only. No real provider implementation yet — both factories return errors for every provider type. We verify the project still builds.

- [ ] **A.1: Add sentinel errors**

Open `internal/ai/errors.go`, read the existing file. Append (or replace if you find a clearer location) so the file ends with these errors in addition to whatever is already there:

```go
// ErrSTTNotSupported indicates that the provider does not have a dedicated
// speech-to-text endpoint. Use the audiollm package for multimodal audio
// understanding when this is returned.
var ErrSTTNotSupported = errors.New("provider does not support speech-to-text capability")

// ErrAudioLLMNotSupported indicates that the provider does not have a
// multimodal-audio LLM available in this codebase.
var ErrAudioLLMNotSupported = errors.New("provider does not support multimodal audio capability")
```

If `errors.go` does not yet import `errors`, add:
```go
import "errors"
```
to its imports block. Use the standard library `errors`, not `github.com/pkg/errors` — `errors.New` from stdlib is what `errors.Is` uses for sentinel comparison.

- [ ] **A.2: Create `internal/ai/stt/stt.go`**

```go
// Package stt defines the speech-to-text capability for AI providers.
// Implementations call dedicated STT endpoints (e.g. OpenAI /audio/transcriptions)
// and return deterministic transcription output. For multimodal LLMs that
// happen to accept audio input, see internal/ai/audiollm.
package stt

import (
	"context"
	"io"
)

// Transcriber transcribes audio to text using a provider's dedicated STT endpoint.
type Transcriber interface {
	Transcribe(ctx context.Context, req Request) (*Response, error)
}

// Request is the input to a transcription call.
type Request struct {
	Audio       io.Reader
	Size        int64
	Filename    string
	ContentType string // IANA media type, e.g. "audio/wav"
	Model       string // provider-specific model id (e.g. "whisper-1", "gpt-4o-transcribe")
	Prompt      string // soft spelling/vocabulary hint (Whisper "prompt" parameter)
	Language    string // ISO 639-1, optional
}

// Response is the output of a transcription call.
type Response struct {
	Text     string
	Language string    // empty if provider did not return it
	Segments []Segment // empty unless provider returned timestamps
}

// Segment is a timestamped portion of the transcript.
type Segment struct {
	Text    string
	Start   float64
	End     float64
	Speaker string // empty unless using a diarization-capable model
}
```

- [ ] **A.3: Create `internal/ai/stt/options.go`**

```go
package stt

import (
	"net/http"
	"time"
)

const defaultHTTPTimeout = 2 * time.Minute

// Options is the resolved option set passed to provider implementations.
type Options struct {
	HTTPClient *http.Client
}

// TranscriberOption customizes a Transcriber.
type TranscriberOption func(*Options)

// WithHTTPClient overrides the HTTP client used by the transcriber.
func WithHTTPClient(client *http.Client) TranscriberOption {
	return func(o *Options) {
		if client != nil {
			o.HTTPClient = client
		}
	}
}

// ApplyOptions resolves a TranscriberOption slice into Options with defaults.
func ApplyOptions(opts []TranscriberOption) Options {
	resolved := Options{HTTPClient: &http.Client{Timeout: defaultHTTPTimeout}}
	for _, apply := range opts {
		apply(&resolved)
	}
	return resolved
}
```

- [ ] **A.4: Create `internal/ai/stt/factory.go`**

```go
package stt

import (
	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/ai"
)

// NewTranscriber returns a Transcriber for the given provider, or an error if
// the provider type does not have a dedicated STT endpoint.
func NewTranscriber(cfg ai.ProviderConfig, opts ...TranscriberOption) (Transcriber, error) {
	switch cfg.Type {
	case ai.ProviderOpenAI:
		// Implemented in stage B; keep the stub return so the package compiles.
		return nil, errors.New("stt/openai not implemented yet")
	case ai.ProviderGemini:
		return nil, errors.Wrap(ai.ErrSTTNotSupported,
			"Gemini does not provide a dedicated STT endpoint; use audiollm.NewModel instead")
	default:
		return nil, errors.Wrapf(ai.ErrCapabilityUnsupported, "provider type %q", cfg.Type)
	}
}
```

- [ ] **A.5: Create `internal/ai/audiollm/audiollm.go`**

```go
// Package audiollm defines the multimodal-audio capability for AI providers.
// Implementations call chat-completions or generate-content style APIs that
// accept audio as input. For deterministic transcription, prefer internal/ai/stt
// where a dedicated STT endpoint exists.
package audiollm

import (
	"context"
	"io"
)

// Model invokes a multimodal LLM with audio input.
type Model interface {
	GenerateFromAudio(ctx context.Context, req Request) (*Response, error)
}

// Request is the input to a multimodal-audio call.
type Request struct {
	Audio        io.Reader
	Size         int64
	ContentType  string
	Model        string
	Instructions string   // literal instruction the model is expected to follow
	Temperature  *float32 // optional; nil leaves the provider default in place
}

// Response is the output of a multimodal-audio call.
type Response struct {
	Text         string
	FinishReason FinishReason
}

// FinishReason describes why the model stopped generating.
type FinishReason string

const (
	FinishStop   FinishReason = "stop"   // model finished normally
	FinishLength FinishReason = "length" // truncated by max-tokens
	FinishSafety FinishReason = "safety" // safety filter blocked output
	FinishOther  FinishReason = "other"  // anything else, including unknown
)
```

- [ ] **A.6: Create `internal/ai/audiollm/options.go`**

```go
package audiollm

import (
	"net/http"
	"time"
)

const defaultHTTPTimeout = 2 * time.Minute

// Options is the resolved option set passed to provider implementations.
type Options struct {
	HTTPClient *http.Client
}

// ModelOption customizes a Model.
type ModelOption func(*Options)

// WithHTTPClient overrides the HTTP client used by the model.
func WithHTTPClient(client *http.Client) ModelOption {
	return func(o *Options) {
		if client != nil {
			o.HTTPClient = client
		}
	}
}

// ApplyOptions resolves a ModelOption slice into Options with defaults.
func ApplyOptions(opts []ModelOption) Options {
	resolved := Options{HTTPClient: &http.Client{Timeout: defaultHTTPTimeout}}
	for _, apply := range opts {
		apply(&resolved)
	}
	return resolved
}
```

- [ ] **A.7: Create `internal/ai/audiollm/factory.go`**

```go
package audiollm

import (
	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/ai"
)

// NewModel returns a Model for the given provider, or an error if the provider
// type does not expose a multimodal-audio capability in this codebase.
func NewModel(cfg ai.ProviderConfig, opts ...ModelOption) (Model, error) {
	switch cfg.Type {
	case ai.ProviderGemini:
		// Implemented in stage C; keep the stub return so the package compiles.
		return nil, errors.New("audiollm/gemini not implemented yet")
	case ai.ProviderOpenAI:
		// gpt-4o-audio-preview support is intentionally out of scope (see spec §2).
		return nil, errors.Wrap(ai.ErrAudioLLMNotSupported,
			"OpenAI multimodal audio (gpt-4o-audio) is not implemented")
	default:
		return nil, errors.Wrapf(ai.ErrCapabilityUnsupported, "provider type %q", cfg.Type)
	}
}
```

- [ ] **A.8: Verify the project still builds**

```bash
go build ./...
```

Expected: exits 0, no output. (`internal/ai/transcription.go`, `client.go`, `openai.go`, `gemini.go` are still in place from before this plan; the new packages compile alongside them.)

- [ ] **A.9: Commit**

```bash
git add internal/ai/errors.go \
        internal/ai/stt \
        internal/ai/audiollm

git commit -m "$(cat <<'EOF'
feat(ai): scaffold stt and audiollm packages

Adds two new sub-packages under internal/ai/ that will replace the single
Transcriber abstraction:

- stt/ — deterministic speech-to-text (dedicated STT endpoints)
- audiollm/ — multimodal audio LLMs (chat-completions / generateContent)

This commit only adds the interface types, factories with stub returns,
and two sentinel errors. Provider implementations land in the next two
commits; until then the existing internal/ai/transcription.go path is
still the live code path.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Stage B: Implement `stt/openai`

**Files:**
- Create: `internal/ai/stt/openai/openai.go`
- Create: `internal/ai/stt/openai/openai_test.go`
- Modify: `internal/ai/stt/factory.go`

Port the wire behavior of `internal/ai/openai.go::openAITranscriber.Transcribe` into the new package. TDD: write the test (adapted from `internal/ai/openai_test.go`) first.

- [ ] **B.1: Write the failing test**

Create `internal/ai/stt/openai/openai_test.go`:

```go
package openai_test

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
	"github.com/usememos/memos/internal/ai/stt"
	sttopenai "github.com/usememos/memos/internal/ai/stt/openai"
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

	transcriber, err := sttopenai.New(ai.ProviderConfig{
		Type:     ai.ProviderOpenAI,
		Endpoint: server.URL,
		APIKey:   "test-key",
	}, stt.ApplyOptions(nil))
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	response, err := transcriber.Transcribe(ctx, stt.Request{
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
	// Note: Duration intentionally omitted from stt.Response — not exposed in the new contract.
}
```

- [ ] **B.2: Run the test to verify it fails**

```bash
go test ./internal/ai/stt/openai/...
```

Expected: build failure with "undefined: openai.New" or similar — the implementation file does not exist yet.

- [ ] **B.3: Create `internal/ai/stt/openai/openai.go`**

Port from `internal/ai/openai.go`. The body is structurally identical to today's `openAITranscriber.Transcribe`, only the Request/Response types and package boundary change.

```go
// Package openai implements stt.Transcriber against the OpenAI
// /audio/transcriptions endpoint (and any compatible third-party endpoint
// such as Groq Whisper, faster-whisper self-hosted, or Azure Whisper).
package openai

import (
	"context"
	"mime"
	"net/url"
	"strings"

	openaisdk "github.com/openai/openai-go/v3"
	openaioption "github.com/openai/openai-go/v3/option"
	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/ai"
	"github.com/usememos/memos/internal/ai/stt"
)

const defaultEndpoint = "https://api.openai.com/v1"

// Transcriber implements stt.Transcriber for OpenAI-compatible STT endpoints.
type Transcriber struct {
	client openaisdk.Client
}

// New constructs a Transcriber from a provider config.
func New(cfg ai.ProviderConfig, options stt.Options) (*Transcriber, error) {
	endpoint, err := normalizeEndpoint(cfg.Endpoint)
	if err != nil {
		return nil, err
	}
	if cfg.APIKey == "" {
		return nil, errors.New("OpenAI API key is required")
	}
	return &Transcriber{
		client: openaisdk.NewClient(
			openaioption.WithAPIKey(cfg.APIKey),
			openaioption.WithBaseURL(endpoint),
			openaioption.WithHTTPClient(options.HTTPClient),
		),
	}, nil
}

// Transcribe sends the audio to /audio/transcriptions.
func (t *Transcriber) Transcribe(ctx context.Context, req stt.Request) (*stt.Response, error) {
	if strings.TrimSpace(req.Model) == "" {
		return nil, errors.New("model is required")
	}
	if req.Audio == nil {
		return nil, errors.New("audio is required")
	}

	filename, contentType, err := normalizeAudioMetadata(req)
	if err != nil {
		return nil, err
	}

	params := openaisdk.AudioTranscriptionNewParams{
		File:           openaisdk.File(req.Audio, filename, contentType),
		Model:          openaisdk.AudioModel(req.Model),
		ResponseFormat: openaisdk.AudioResponseFormatJSON,
	}
	if req.Prompt != "" {
		params.Prompt = openaisdk.String(req.Prompt)
	}
	if req.Language != "" {
		params.Language = openaisdk.String(req.Language)
	}

	resp, err := t.client.Audio.Transcriptions.New(ctx, params)
	if err != nil {
		return nil, errors.Wrap(err, "failed to send OpenAI transcription request")
	}
	return &stt.Response{
		Text:     resp.Text,
		Language: resp.Language,
	}, nil
}

func normalizeEndpoint(endpoint string) (string, error) {
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		endpoint = defaultEndpoint
	}
	if _, err := url.ParseRequestURI(endpoint); err != nil {
		return "", errors.Wrap(err, "invalid OpenAI endpoint")
	}
	return strings.TrimRight(endpoint, "/"), nil
}

func normalizeAudioMetadata(req stt.Request) (string, string, error) {
	filename := strings.TrimSpace(req.Filename)
	if filename == "" {
		filename = "audio"
	}
	contentType := strings.TrimSpace(req.ContentType)
	if contentType == "" {
		contentType = "application/octet-stream"
	} else {
		mediaType, _, err := mime.ParseMediaType(contentType)
		if err != nil {
			return "", "", errors.Wrap(err, "invalid audio content type")
		}
		contentType = mediaType
	}
	return sanitizeFilename(filename), contentType, nil
}

func sanitizeFilename(filename string) string {
	filename = strings.NewReplacer("\r", "_", "\n", "_").Replace(filename)
	if strings.TrimSpace(filename) == "" {
		return "audio"
	}
	return filename
}
```

- [ ] **B.4: Wire the factory to use the new implementation**

Replace the stub branch in `internal/ai/stt/factory.go`:

```go
package stt

import (
	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/ai"
	sttopenai "github.com/usememos/memos/internal/ai/stt/openai"
)

func NewTranscriber(cfg ai.ProviderConfig, opts ...TranscriberOption) (Transcriber, error) {
	switch cfg.Type {
	case ai.ProviderOpenAI:
		return sttopenai.New(cfg, ApplyOptions(opts))
	case ai.ProviderGemini:
		return nil, errors.Wrap(ai.ErrSTTNotSupported,
			"Gemini does not provide a dedicated STT endpoint; use audiollm.NewModel instead")
	default:
		return nil, errors.Wrapf(ai.ErrCapabilityUnsupported, "provider type %q", cfg.Type)
	}
}
```

- [ ] **B.5: Run the test to verify it passes**

```bash
go test ./internal/ai/stt/openai/... -v
```

Expected: `--- PASS: TestTranscribe`. Exit 0.

- [ ] **B.6: Verify the whole project still builds**

```bash
go build ./...
```

Expected: exits 0, no output.

- [ ] **B.7: Commit**

```bash
git add internal/ai/stt

git commit -m "$(cat <<'EOF'
feat(ai/stt): implement OpenAI-compatible Transcriber

Ports the wire behavior of internal/ai/openai.go into the new
internal/ai/stt/openai package. Behavior is identical: same SDK, same
endpoint, same request shape; only the contract types (stt.Request,
stt.Response) change. Duration is intentionally dropped from the response
shape (audio file metadata, not transcription metadata).

The legacy internal/ai/openai.go is still in place — it will be removed
once the handler is refactored to call into the new stack.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Stage C: Implement `audiollm/gemini`

**Files:**
- Create: `internal/ai/audiollm/gemini/gemini.go`
- Create: `internal/ai/audiollm/gemini/gemini_test.go`
- Modify: `internal/ai/audiollm/factory.go`

Port the wire behavior of `internal/ai/gemini.go::geminiTranscriber.Transcribe` with two semantic upgrades:
1. The transcription instruction is no longer hardcoded in this package — the caller passes `Request.Instructions`.
2. The Gemini API's `FinishReason` is mapped to `audiollm.FinishReason` and surfaced in the response, instead of being collapsed into a generic error.

- [ ] **C.1: Write the failing tests**

Create `internal/ai/audiollm/gemini/gemini_test.go`. Two tests: happy path and unsupported-content-type rejection. The happy-path test asserts that the caller-supplied `Instructions` string flows through to the request and that `FinishStop` is returned. We also verify that WebM input is transcoded to WAV by re-using `internal/ai/audio.WebMOpusToWAV`.

```go
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
```

- [ ] **C.2: Run the tests to verify they fail**

```bash
go test ./internal/ai/audiollm/gemini/...
```

Expected: build failure ("undefined: gemini.New" or similar).

- [ ] **C.3: Create `internal/ai/audiollm/gemini/gemini.go`**

Port from `internal/ai/gemini.go`. The structure mirrors the existing file; the differences are:
- No hardcoded transcription prompt (caller passes `Instructions`).
- `Temperature` comes from the request, not from a package constant.
- Response includes a mapped `FinishReason`, and we no longer treat empty text as an error here — that decision moves to the caller (the handler), which knows whether `FinishStop` is required.

```go
// Package gemini implements audiollm.Model against the Gemini generateContent
// endpoint. Used by Memos transcription when the user picks a Gemini provider:
// the handler issues a transcription instruction via audiollm.Request.Instructions.
package gemini

import (
	"context"
	"io"
	"mime"
	"net/url"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/genai"

	"github.com/usememos/memos/internal/ai"
	"github.com/usememos/memos/internal/ai/audio"
	"github.com/usememos/memos/internal/ai/audiollm"
)

const (
	defaultEndpoint   = "https://generativelanguage.googleapis.com/v1beta"
	defaultAPIVersion = "v1beta"
	maxInlineSize     = 14 * 1024 * 1024
	providerName      = "Gemini"
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

// Model implements audiollm.Model for Gemini generateContent.
type Model struct {
	client *genai.Client
}

// New constructs a Model from a provider config.
func New(cfg ai.ProviderConfig, options audiollm.Options) (*Model, error) {
	endpoint, err := normalizeEndpoint(cfg.Endpoint)
	if err != nil {
		return nil, err
	}
	if cfg.APIKey == "" {
		return nil, errors.Errorf("%s API key is required", providerName)
	}
	baseURL, apiVersion, err := splitEndpoint(endpoint)
	if err != nil {
		return nil, err
	}
	httpOptions := genai.HTTPOptions{BaseURL: baseURL, APIVersion: apiVersion}
	if options.HTTPClient != nil && options.HTTPClient.Timeout > 0 {
		timeout := options.HTTPClient.Timeout
		httpOptions.Timeout = &timeout
	}
	client, err := genai.NewClient(context.Background(), &genai.ClientConfig{
		APIKey:      cfg.APIKey,
		Backend:     genai.BackendGeminiAPI,
		HTTPClient:  options.HTTPClient,
		HTTPOptions: httpOptions,
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to create Gemini client")
	}
	return &Model{client: client}, nil
}

// GenerateFromAudio calls Gemini generateContent with the audio attached.
func (m *Model) GenerateFromAudio(ctx context.Context, req audiollm.Request) (*audiollm.Response, error) {
	if strings.TrimSpace(req.Model) == "" {
		return nil, errors.New("model is required")
	}
	if req.Audio == nil {
		return nil, errors.New("audio is required")
	}
	if strings.TrimSpace(req.Instructions) == "" {
		return nil, errors.New("instructions are required")
	}

	audioBytes, err := io.ReadAll(req.Audio)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read audio")
	}
	if len(audioBytes) == 0 {
		return nil, errors.New("audio is required")
	}

	contentType := req.ContentType
	if audio.IsWebMContentType(contentType) {
		wav, err := audio.WebMOpusToWAV(audioBytes)
		if err != nil {
			return nil, errors.Wrap(err, "failed to transcode webm audio for Gemini")
		}
		audioBytes = wav
		contentType = "audio/wav"
	}

	if len(audioBytes) > maxInlineSize {
		return nil, errors.Errorf("audio is too large for Gemini inline request; maximum size is %d bytes", maxInlineSize)
	}

	contentType, err = normalizeContentType(contentType)
	if err != nil {
		return nil, err
	}

	cfg := &genai.GenerateContentConfig{}
	if req.Temperature != nil {
		t := *req.Temperature
		cfg.Temperature = &t
	}

	resp, err := m.client.Models.GenerateContent(ctx, normalizeModelName(req.Model), []*genai.Content{
		genai.NewContentFromParts([]*genai.Part{
			genai.NewPartFromBytes(audioBytes, contentType),
			genai.NewPartFromText(req.Instructions),
		}, genai.RoleUser),
	}, cfg)
	if err != nil {
		return nil, errors.Wrap(err, "failed to send Gemini request")
	}

	return &audiollm.Response{
		Text:         strings.TrimSpace(resp.Text()),
		FinishReason: mapFinishReason(resp),
	}, nil
}

func mapFinishReason(resp *genai.GenerateContentResponse) audiollm.FinishReason {
	if resp == nil || len(resp.Candidates) == 0 {
		return audiollm.FinishOther
	}
	switch resp.Candidates[0].FinishReason {
	case genai.FinishReasonStop:
		return audiollm.FinishStop
	case genai.FinishReasonMaxTokens:
		return audiollm.FinishLength
	case genai.FinishReasonSafety:
		return audiollm.FinishSafety
	default:
		return audiollm.FinishOther
	}
}

func normalizeEndpoint(endpoint string) (string, error) {
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		endpoint = defaultEndpoint
	}
	if _, err := url.ParseRequestURI(endpoint); err != nil {
		return "", errors.Wrapf(err, "invalid %s endpoint", providerName)
	}
	return strings.TrimRight(endpoint, "/"), nil
}

func splitEndpoint(endpoint string) (string, string, error) {
	parsed, err := url.Parse(endpoint)
	if err != nil {
		return "", "", errors.Wrap(err, "invalid Gemini endpoint")
	}
	path := strings.TrimRight(parsed.Path, "/")
	apiVersion := defaultAPIVersion
	for _, supported := range []string{"v1alpha", "v1beta", "v1"} {
		if path == "/"+supported || strings.HasSuffix(path, "/"+supported) {
			apiVersion = supported
			parsed.Path = strings.TrimSuffix(path, "/"+supported)
			break
		}
	}
	return strings.TrimRight(parsed.String(), "/"), apiVersion, nil
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

func normalizeModelName(model string) string {
	return strings.TrimPrefix(strings.TrimSpace(model), "models/")
}
```

- [ ] **C.4: Wire the factory to use the new implementation**

Replace the stub branch in `internal/ai/audiollm/factory.go`:

```go
package audiollm

import (
	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/ai"
	audiollmgemini "github.com/usememos/memos/internal/ai/audiollm/gemini"
)

func NewModel(cfg ai.ProviderConfig, opts ...ModelOption) (Model, error) {
	switch cfg.Type {
	case ai.ProviderGemini:
		return audiollmgemini.New(cfg, ApplyOptions(opts))
	case ai.ProviderOpenAI:
		return nil, errors.Wrap(ai.ErrAudioLLMNotSupported,
			"OpenAI multimodal audio (gpt-4o-audio) is not implemented")
	default:
		return nil, errors.Wrapf(ai.ErrCapabilityUnsupported, "provider type %q", cfg.Type)
	}
}
```

- [ ] **C.5: Run the tests to verify they pass**

```bash
go test ./internal/ai/audiollm/gemini/... -v
```

Expected: `--- PASS: TestGenerateFromAudio` and `--- PASS: TestGenerateFromAudioRejectsUnsupportedContentType`.

If `TestGenerateFromAudio` fails because the genai SDK constant for "STOP" is named differently from `genai.FinishReasonStop`, look up the exact constant name in `google.golang.org/genai` and adjust `mapFinishReason`. The behavioral expectation is unchanged: a JSON `"finishReason": "STOP"` from the server must map to `audiollm.FinishStop`.

- [ ] **C.6: Verify the whole project still builds**

```bash
go build ./...
```

Expected: exits 0.

- [ ] **C.7: Commit**

```bash
git add internal/ai/audiollm

git commit -m "$(cat <<'EOF'
feat(ai/audiollm): implement Gemini multimodal audio Model

Ports internal/ai/gemini.go into the new internal/ai/audiollm/gemini
package. Two behavior changes from the previous code:

- Transcription instructions are now caller-supplied via
  audiollm.Request.Instructions instead of being hardcoded in the package.
  This frees the audiollm/gemini package to serve future non-transcription
  use cases (audio summarization, etc.) without changes.
- The genai FinishReason is mapped to audiollm.FinishReason and surfaced
  on the response, replacing the previous "did not include text" error
  that collapsed safety-filter, max-tokens, and other failure modes.

The legacy internal/ai/gemini.go is still in place and still wired to the
handler — that switches in the next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Stage D: Refactor the Transcribe handler to dispatch by provider type

**Files:**
- Modify: `server/router/api/v1/ai_service.go`

The handler currently calls `ai.NewTranscriber(provider)` and `transcriber.Transcribe(...)`. We replace that core block with a `switch provider.Type` that calls either `stt.NewTranscriber` or `audiollm.NewModel`. All input validation and provider resolution above it stays the same.

- [ ] **D.1: Replace the core call block**

In `server/router/api/v1/ai_service.go`, locate the existing call sequence inside the `Transcribe` method:

```go
	transcriber, err := ai.NewTranscriber(provider)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "failed to create AI transcriber: %v", err)
	}

	transcription, err := transcriber.Transcribe(ctx, ai.TranscribeRequest{
		Model:       model,
		Filename:    filename,
		ContentType: contentType,
		Audio:       bytes.NewReader(content),
		Size:        int64(len(content)),
		Prompt:      persisted.GetPrompt(),
		Language:    persisted.GetLanguage(),
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to transcribe audio: %v", err)
	}
	return &v1pb.TranscribeResponse{
		Text: transcription.Text,
	}, nil
```

Replace that entire sequence (everything from `transcriber, err := ai.NewTranscriber(provider)` through the closing `}, nil` of the return statement) with:

```go
	var text string
	switch provider.Type {
	case ai.ProviderOpenAI:
		text, err = s.transcribeViaSTT(ctx, provider, persisted, model, content, filename, contentType)
	case ai.ProviderGemini:
		text, err = s.transcribeViaAudioLLM(ctx, provider, persisted, model, content, contentType)
	default:
		return nil, status.Errorf(codes.FailedPrecondition,
			"provider type %q is not supported for transcription", provider.Type)
	}
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to transcribe audio: %v", err)
	}
	return &v1pb.TranscribeResponse{Text: text}, nil
}
```

Remove the now-unused import of `bytes` if Go points it out — `bytes.NewReader(content)` moves into the helpers below.

- [ ] **D.2: Add the two helpers and the instruction builder**

Append to the same file, after the `Transcribe` function:

```go
func (*APIV1Service) transcribeViaSTT(
	ctx context.Context,
	provider ai.ProviderConfig,
	persisted *storepb.TranscriptionConfig,
	model string,
	content []byte,
	filename string,
	contentType string,
) (string, error) {
	transcriber, err := stt.NewTranscriber(provider)
	if err != nil {
		return "", errors.Wrap(err, "failed to create STT transcriber")
	}
	resp, err := transcriber.Transcribe(ctx, stt.Request{
		Audio:       bytes.NewReader(content),
		Size:        int64(len(content)),
		Filename:    filename,
		ContentType: contentType,
		Model:       model,
		Prompt:      persisted.GetPrompt(),
		Language:    persisted.GetLanguage(),
	})
	if err != nil {
		return "", err
	}
	return resp.Text, nil
}

func (*APIV1Service) transcribeViaAudioLLM(
	ctx context.Context,
	provider ai.ProviderConfig,
	persisted *storepb.TranscriptionConfig,
	model string,
	content []byte,
	contentType string,
) (string, error) {
	m, err := audiollm.NewModel(provider)
	if err != nil {
		return "", errors.Wrap(err, "failed to create audio LLM")
	}
	resp, err := m.GenerateFromAudio(ctx, audiollm.Request{
		Audio:        bytes.NewReader(content),
		Size:         int64(len(content)),
		ContentType:  contentType,
		Model:        model,
		Instructions: buildTranscriptionInstructions(persisted.GetPrompt(), persisted.GetLanguage()),
	})
	if err != nil {
		return "", err
	}
	if resp.FinishReason != audiollm.FinishStop {
		return "", errors.Errorf("transcription incomplete (finish reason: %s)", resp.FinishReason)
	}
	if strings.TrimSpace(resp.Text) == "" {
		return "", errors.New("transcription response did not include text")
	}
	return resp.Text, nil
}

func buildTranscriptionInstructions(prompt, language string) string {
	parts := []string{
		"Transcribe the audio accurately. Return only the transcript text. " +
			"Do not summarize, explain, or add content that is not spoken.",
	}
	if language = strings.TrimSpace(language); language != "" {
		parts = append(parts, "The input language is "+language+".")
	}
	if prompt = strings.TrimSpace(prompt); prompt != "" {
		parts = append(parts, "Context and spelling hints:\n"+prompt)
	}
	return strings.Join(parts, "\n\n")
}
```

- [ ] **D.3: Update the imports**

The imports block of `ai_service.go` needs:

```go
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
	"github.com/usememos/memos/internal/ai/audiollm"
	"github.com/usememos/memos/internal/ai/stt"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
)
```

(`bytes` and `mime` were already there; `errors`, `audiollm`, and `stt` are new.)

- [ ] **D.4: Verify the project builds**

```bash
go build ./...
```

Expected: exits 0.

- [ ] **D.5: Run the existing handler tests**

```bash
go test ./server/router/api/v1/... -run Transcrib -v
```

Expected: any existing tests touching `Transcribe` still pass. If there are no Transcribe tests yet, the command will print `no tests to run` — that is fine.

- [ ] **D.6: Run the full Go test suite**

```bash
go test ./...
```

Expected: exits 0. Watch for any test that imports `internal/ai.Transcriber`, `internal/ai.NewTranscriber`, `internal/ai.TranscribeRequest`, or `internal/ai.TranscribeResponse` — if such a test exists outside the files we delete in stage E, it must be migrated now.

- [ ] **D.7: Commit**

```bash
git add server/router/api/v1/ai_service.go

git commit -m "$(cat <<'EOF'
refactor(ai_service): dispatch transcription by provider type

The Transcribe handler now switches on the resolved provider's Type and
calls into either internal/ai/stt (OpenAI-compatible) or internal/ai/audiollm
(Gemini multimodal). buildTranscriptionInstructions centralizes the
literal instruction sent to multimodal LLMs, replacing the previously
hardcoded prompt inside internal/ai/gemini.go.

The legacy internal/ai package is no longer called by the handler. It is
still on disk; it gets removed in the next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Stage E: Delete legacy internal/ai files

**Files (deleted):**
- `internal/ai/transcription.go`
- `internal/ai/client.go`
- `internal/ai/openai.go`
- `internal/ai/openai_test.go`
- `internal/ai/gemini.go`
- `internal/ai/gemini_test.go`

After the handler refactor in stage D, nothing references the legacy `Transcriber` interface or its implementations. We delete them.

- [ ] **E.1: Confirm no callers remain**

```bash
git grep -nE 'ai\.(NewTranscriber|TranscribeRequest|TranscribeResponse|Transcriber)\b' -- ':(exclude)internal/ai/transcription.go' ':(exclude)internal/ai/client.go' ':(exclude)internal/ai/openai.go' ':(exclude)internal/ai/openai_test.go' ':(exclude)internal/ai/gemini.go' ':(exclude)internal/ai/gemini_test.go'
```

Expected: no output (no remaining external callers). If anything matches, fix it before deleting.

- [ ] **E.2: Delete the files**

```bash
git rm internal/ai/transcription.go \
       internal/ai/client.go \
       internal/ai/openai.go \
       internal/ai/openai_test.go \
       internal/ai/gemini.go \
       internal/ai/gemini_test.go
```

- [ ] **E.3: Verify the project still builds**

```bash
go build ./...
```

Expected: exits 0.

- [ ] **E.4: Run the full Go test suite**

```bash
go test ./...
```

Expected: exits 0.

- [ ] **E.5: Confirm `internal/ai/` only has the surviving files**

```bash
ls internal/ai/
```

Expected output (alphabetical, may include `audio/`):

```
ai.go
audio
audiollm
errors.go
models.go
resolver.go
stt
```

(`audio/` is the existing webm package, untouched.)

- [ ] **E.6: Commit**

```bash
git commit -m "$(cat <<'EOF'
refactor(ai): remove legacy Transcriber implementations

The Transcribe handler now uses internal/ai/stt and internal/ai/audiollm
exclusively. Removes the obsolete single-interface Transcriber, its
factory, and both provider implementations. internal/ai/ now contains
only shared primitives (ProviderConfig, errors, default models, provider
resolver) plus the per-capability sub-packages.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Stage F: Update proto comments and regenerate bindings

**Files:**
- Modify: `proto/store/instance_setting.proto`
- Regenerate: `proto/gen/store/instance_setting.pb.go`
- Regenerate: `web/src/types/proto/store/instance_setting_pb.ts`

Documentation-only proto change; no field tags moved or renamed.

- [ ] **F.1: Verify `buf` is available**

```bash
buf --version
```

Expected: prints a version. If absent: `brew install bufbuild/buf/buf`.

- [ ] **F.2: Update the `model` field comment**

Edit `proto/store/instance_setting.proto`. Find the existing block (around lines 179–182):

```proto
  // model is the provider-specific model identifier.
  // Empty string falls back to the engine default
  // (whisper-1 for OPENAI providers, gemini-2.5-flash for GEMINI providers).
  string model = 2;
```

Replace with:

```proto
  // model is the provider-specific model identifier.
  // Empty string falls back to the engine default.
  // OPENAI examples:
  //   - whisper-1 (legacy, lower cost)
  //   - gpt-4o-transcribe, gpt-4o-mini-transcribe (higher quality)
  //   - gpt-4o-transcribe-diarize (includes speaker labels)
  // GEMINI examples:
  //   - gemini-2.5-flash (default, multimodal call)
  //   - gemini-2.5-pro
  string model = 2;
```

- [ ] **F.3: Update the `prompt` field comment**

In the same file, find (around lines 188–191):

```proto
  // prompt is a default spelling/vocabulary hint passed to the provider.
  // Used as the OpenAI Whisper "prompt" parameter and folded into the Gemini
  // generation prompt as a "Context and spelling hints" block.
  string prompt = 4;
```

Replace with:

```proto
  // prompt is a default spelling/vocabulary hint passed to the provider.
  // Used as the OpenAI Whisper "prompt" parameter (a soft hint that the model
  // may ignore) and folded into the Gemini generation prompt as a "Context and
  // spelling hints" block (which the LLM will treat more literally).
  string prompt = 4;
```

- [ ] **F.4: Format and regenerate**

```bash
cd proto && buf format -w && buf generate && cd ..
```

Expected: each command exits 0; `proto/gen/store/instance_setting.pb.go` and `web/src/types/proto/store/instance_setting_pb.ts` are rewritten in place.

- [ ] **F.5: Verify the generated Go file picked up both comments**

```bash
grep -A 9 "model is the provider-specific model identifier" proto/gen/store/instance_setting.pb.go
grep -A 4 "prompt is a default spelling/vocabulary hint" proto/gen/store/instance_setting.pb.go
```

Expected: both blocks contain the new wording (model: 9 lines including the OPENAI/GEMINI examples and `Model string ...`; prompt: 4 lines of comment + the `Prompt string ...` line).

- [ ] **F.6: Verify the generated TypeScript file picked up both comments**

```bash
grep -A 9 "model is the provider-specific model identifier" web/src/types/proto/store/instance_setting_pb.ts
grep -A 4 "prompt is a default spelling/vocabulary hint" web/src/types/proto/store/instance_setting_pb.ts
```

Expected: both blocks contain the new wording (TS comments are JSDoc-formatted with leading `*` per line).

- [ ] **F.7: Verify only three files changed**

```bash
git status --short
```

Expected: exactly:

```
 M proto/store/instance_setting.proto
 M proto/gen/store/instance_setting.pb.go
 M web/src/types/proto/store/instance_setting_pb.ts
```

If other generated files appear modified, the regen touched something unrelated — inspect with `git diff --stat` and stop.

- [ ] **F.8: Verify Go still builds**

```bash
go build ./...
```

Expected: exits 0. (Comment-only proto changes cannot break the build, but this catches accidental edits that bled into adjacent fields.)

- [ ] **F.9: Commit**

```bash
git add proto/store/instance_setting.proto \
        proto/gen/store/instance_setting.pb.go \
        web/src/types/proto/store/instance_setting_pb.ts

git commit -m "$(cat <<'EOF'
docs(proto): clarify TranscriptionConfig model and prompt fields

- model: list current OpenAI (whisper-1, gpt-4o-transcribe family,
  gpt-4o-transcribe-diarize) and Gemini (2.5-flash, 2.5-pro) examples.
  The /audio/transcriptions endpoint is no longer Whisper-only.
- prompt: note that OpenAI Whisper treats it as a soft hint while
  Gemini folds it literally into the generation prompt.

Documentation-only; no field changes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Stage G: Update frontend i18n strings

**Files:**
- Modify: `web/src/locales/en.json`

The `AISection.tsx` component already conditionally swaps the model placeholder by provider type and renders the prompt help string. Only the underlying strings need updating.

- [ ] **G.1: Update three strings in `web/src/locales/en.json`**

Find these three keys (they currently live under `setting.ai.*`, around lines 441–449):

```json
"transcription-model-placeholder-gemini": "gemini-2.5-flash",
"transcription-model-placeholder-openai": "whisper-1",
"transcription-prompt-help": "Improves spelling of proper nouns and jargon. Whisper limit is roughly 224 tokens.",
```

Replace with:

```json
"transcription-model-placeholder-gemini": "gemini-2.5-flash, gemini-2.5-pro",
"transcription-model-placeholder-openai": "whisper-1, gpt-4o-transcribe, gpt-4o-mini-transcribe, gpt-4o-transcribe-diarize",
"transcription-prompt-help": "Improves spelling of proper nouns and jargon. OpenAI Whisper treats this as a soft hint (Whisper limit is roughly 224 tokens). Gemini treats it as a literal instruction inside the generation prompt.",
```

- [ ] **G.2: Verify the JSON file is still valid**

```bash
python3 -m json.tool web/src/locales/en.json > /dev/null
```

Expected: exits 0, no output.

- [ ] **G.3: Verify the frontend build still succeeds**

```bash
cd web && pnpm build && cd ..
```

(Use `npm run build` if pnpm is not the project's tool — check `web/package.json` for the canonical command.)

Expected: build succeeds with no TypeScript errors.

- [ ] **G.4: Commit**

```bash
git add web/src/locales/en.json

git commit -m "$(cat <<'EOF'
i18n(en): expand transcription model and prompt help text

- Model placeholders list the full set of supported transcription models
  for OpenAI (whisper-1 plus the gpt-4o-transcribe family) and Gemini.
- Prompt help text notes the cross-provider semantic difference: Whisper
  treats the field as a soft hint, Gemini treats it as a literal
  instruction. Mirrors the proto field comments.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final validation

After Stage G commits, run a full validation pass:

- [ ] **V.1: Full Go test suite**

```bash
go test ./...
```

Expected: exits 0.

- [ ] **V.2: Full Go build**

```bash
go build ./...
```

Expected: exits 0.

- [ ] **V.3: Frontend build**

```bash
cd web && pnpm build && cd ..
```

Expected: exits 0.

- [ ] **V.4: Smoke-test the Transcribe endpoint manually**

If a local Memos instance is convenient, configure one OpenAI provider and one Gemini provider via the AI settings UI, then upload a short audio file via the voice-input feature for each. The end-to-end behavior should be identical to before this refactor (same transcript text). For Gemini specifically: a deliberately bad audio (e.g., silence) should now produce a clearer error message when `FinishReason != FinishStop`.

- [ ] **V.5: Inspect the commit log**

```bash
git log --oneline -8
```

Expected (most-recent-first):

```
<sha> i18n(en): expand transcription model and prompt help text
<sha> docs(proto): clarify TranscriptionConfig model and prompt fields
<sha> refactor(ai): remove legacy Transcriber implementations
<sha> refactor(ai_service): dispatch transcription by provider type
<sha> feat(ai/audiollm): implement Gemini multimodal audio Model
<sha> feat(ai/stt): implement OpenAI-compatible Transcriber
<sha> feat(ai): scaffold stt and audiollm packages
```

Each commit is independently revertable.
