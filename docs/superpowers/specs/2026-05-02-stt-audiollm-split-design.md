# STT and Audio-LLM Split — Design Spec

**Date:** 2026-05-02
**Status:** Draft, pending user review

## 1. Goal

Refactor `internal/ai/` to split **speech-to-text (STT)** and **audio-multimodal-LLM (Audio-LLM)** into two separate Go interfaces, aligning with mainstream OSS conventions (Vercel AI SDK, LiteLLM, the Go AI ecosystem). Update the public API handler to dispatch to the right interface based on provider type. Make two small comment improvements to `proto/store/instance_setting.proto` and the generated bindings; **no proto field changes**.

## 2. Non-Goals

The following are intentionally **out of scope** for this design:

- **`enabled` boolean field on `TranscriptionConfig`** (improvement #1 from the brainstorming) — keep using `provider_id == ""` as the disabled signal.
- **Direction C (audio → structured note pipeline)** — auto-summarization / tag extraction. Independent future feature.
- **Multi-provider STT with default-model selector** (Dify-style) — Memos has a single transcription config; that stays.
- **Per-model credential overrides**, **load balancing**, **capability YAML schemas** — Dify-style enterprise complexity.
- **Streaming transcription, retry policy, OpenAI Translations endpoint** — YAGNI.
- **`gpt-4o-audio-preview` user-facing support** — the `audiollm/openai` package will be implementable after this refactor, but UI support is a follow-up.
- **TTS** (text-to-speech) — different concern, not affected.

## 3. Background

The current `internal/ai/` has one `Transcriber` interface with two implementations: `openAITranscriber` (calls `/audio/transcriptions`, a real STT endpoint) and `geminiTranscriber` (calls `generateContent`, a multimodal-LLM endpoint dressed up to act like STT). This conflation has caused real symptoms:

- `TranscribeResponse.Language` and `Duration` are silently empty for Gemini (Gemini multimodal doesn't return them).
- The `Prompt` field has different semantics across providers — Whisper treats it as a soft hint that may be ignored; Gemini treats it as a literal instruction.
- Gemini's multimodal failure modes (safety filter, token-truncation, refusals) are flattened to a single "did not include text" error.
- Gemini-specific code (WebM transcoding, `maxGeminiInlineAudioSize`, `genai` SDK) lives in the same package as the OpenAI Whisper integration.

The brainstorming session (this conversation, 2026-05-02) ran two rounds of OSS research to validate the corrective direction.

## 4. Research Findings Summary

Detailed findings in conversation history; abridged here for design accountability.

### 4.1 SDK-Layer Research

| Source | Key Decision |
|---|---|
| **Vercel AI SDK** (`vercel/ai`) | `TranscriptionModelV3` is implemented **only** by providers with a dedicated STT endpoint (OpenAI Whisper/gpt-4o-transcribe, Deepgram, ElevenLabs, AssemblyAI). **Google provider deliberately does not implement it** — Gemini audio rides through `generateText` with `FilePart`. Two completely separate code paths. No "source" discriminator. Provider id is `vendor.modality` (`openai.transcription`); model is a free string. |
| **LiteLLM** (`BerriAI/litellm`) | `litellm.transcription()` only routes to providers with `/audio/transcriptions`-style endpoints. **Gemini is absent** from the transcription router (`litellm/llms/gemini/` has no `audio_transcription/` subdirectory). Multimodal audio rides through `litellm.completion()` with `{"type":"input_audio"}` content parts. Response is `text + usage`, no provider discriminator. |
| **Go AI SDKs** (`cloudwego/eino`, `tmc/langchaingo`, `sashabaranov/go-openai`) | One package per provider; provider identity = import path; **no provider enum**. `Model` is opaque string. OpenAI-compatible endpoints handled via `BaseURL` config field, never via separate package. go-openai's `audio.go` is structurally separate from `chat.go`. |

**Convergent finding:** All three ecosystems split STT and multimodal-audio into separate interfaces. None expose a "this came from a multimodal LLM" discriminator. None encode wire-format into the provider type enum.

### 4.2 Application-Layer Research

| Source | STT-Storage Design |
|---|---|
| **Open WebUI** | STT is a **flat singleton config block** (`audio.stt.*` namespace), completely separate from chat providers (`openai.*` namespace). `STT_ENGINE` enum dispatches; per-engine credentials side-by-side in one config. |
| **LobeChat** | STT is a **separate global user setting** (`UserTTSConfig`). But credentials silently piggyback on the `openai` chat provider's `keyVaults` — author has marked the helper `@deprecated`. |
| **Dify** | `ProviderEntity.supported_model_types` declares capabilities; STT is the `SPEECH2TEXT` enum value. STT info lives in a **separate "system model" config row** (`tenant_default_models(model_type='speech2text', provider_name, model_name)`) that **references** an existing provider. |

**Convergent finding:** Zero apps add STT-specific fields onto the AI provider entity. All three keep providers capability-agnostic and put STT config in a separate place.

### 4.3 Proto Schema Assessment

The current `proto/store/instance_setting.proto` `InstanceAISetting` + `TranscriptionConfig` is **already aligned with the mainstream pattern**:

- ✅ `AIProviderConfig` carries no STT-specific field (capability-agnostic)
- ✅ `TranscriptionConfig` is a separate pointer (`provider_id` references a provider)
- ✅ `AIProviderType` is vendor-level (`OPENAI`, `GEMINI`) — no wire-format suffix
- ✅ `model` is a free string
- ✅ Comments already document Whisper vs Gemini prompt semantics (though could be clearer)

The proto schema requires **no field changes**. Only two comment improvements (§7 below).

## 5. Current State (Files Touched)

```
internal/ai/
  ai.go                # ProviderType, ProviderConfig, errors
  client.go            # NewTranscriber factory, transcriberOptions, normalizeEndpoint, requireAPIKey
  transcription.go     # Transcriber interface, TranscribeRequest, TranscribeResponse
  openai.go            # openAITranscriber → /audio/transcriptions
  openai_test.go
  gemini.go            # geminiTranscriber → generateContent (multimodal)
  gemini_test.go
  models.go            # DefaultOpenAITranscriptionModel, DefaultGeminiTranscriptionModel
  resolver.go          # FindProvider
  errors.go            # ErrProviderNotFound, ErrCapabilityUnsupported
  audio/
    webm.go            # IsWebMContentType, WebMOpusToWAV (used by Gemini path)
    webm_test.go

server/router/api/v1/
  ai_service.go        # Transcribe handler (lines 42–123)

proto/store/
  instance_setting.proto    # InstanceAISetting, AIProviderConfig, AIProviderType, TranscriptionConfig

web/src/components/Settings/
  AISection.tsx        # Provider list UI, TranscriptionForm
```

The handler at `server/router/api/v1/ai_service.go:42` is the **single integration point** between proto config and the `internal/ai/` SDK. It already discards Language/Duration (returns `{Text}` only), so the response narrowing is already in place.

## 6. Target Design

### 6.1 Package Structure

```
internal/ai/
  ai.go                # ProviderType (unchanged: OPENAI, GEMINI), ProviderConfig (unchanged)
  resolver.go          # FindProvider (unchanged)
  errors.go            # add ErrSTTNotSupported, ErrAudioLLMNotSupported
  audio/
    webm.go            # unchanged — moves with audiollm/gemini consumer
    webm_test.go

  stt/
    stt.go             # Transcriber interface, Request, Response, Segment
    factory.go         # NewTranscriber(cfg ai.ProviderConfig, opts...) (Transcriber, error)
    options.go         # TranscriberOption, WithHTTPClient
    openai/
      openai.go        # openAITranscriber → POST /audio/transcriptions
      openai_test.go

  audiollm/
    audiollm.go        # Model interface, Request, Response, FinishReason
    factory.go         # NewModel(cfg ai.ProviderConfig, opts...) (Model, error)
    options.go         # ModelOption, WithHTTPClient
    gemini/
      gemini.go        # geminiModel → POST :generateContent (multimodal audio)
      gemini_test.go
    # openai/ — NOT created in this refactor; reserved for future gpt-4o-audio support
```

**Rationale (Go-ecosystem convention, per §4.1):** one package per provider; provider identity is import path; capability is implied by which umbrella package (`stt` vs `audiollm`) you import from. The runtime dispatch (factory) is the only place that translates `ProviderConfig.Type` enum → concrete implementation.

### 6.2 Interfaces

#### `internal/ai/stt/stt.go`

```go
package stt

import (
    "context"
    "io"
)

// Transcriber transcribes audio into text using a provider's dedicated STT endpoint
// (e.g. OpenAI /audio/transcriptions). Implementations are deterministic STT —
// they are NOT for multimodal LLMs that happen to accept audio input. For
// multimodal audio understanding, see internal/ai/audiollm.
type Transcriber interface {
    Transcribe(ctx context.Context, req Request) (*Response, error)
}

type Request struct {
    Audio       io.Reader
    Size        int64
    Filename    string
    ContentType string  // IANA media type, e.g. "audio/wav"
    Model       string  // provider-specific model id (e.g. "whisper-1", "gpt-4o-transcribe")
    Prompt      string  // soft spelling/vocabulary hint (Whisper "prompt" parameter)
    Language    string  // ISO 639-1, optional
}

type Response struct {
    Text     string
    Language string    // empty if provider did not return it (best-effort)
    Segments []Segment // empty unless provider returned timestamps
}

type Segment struct {
    Text    string
    Start   float64
    End     float64
    Speaker string // empty unless using a diarization-capable model (e.g. gpt-4o-transcribe-diarize)
}
```

#### `internal/ai/audiollm/audiollm.go`

```go
package audiollm

import (
    "context"
    "io"
)

// Model invokes a multimodal LLM with audio input. Implementations call
// chat-completions or generate-content style APIs that happen to accept audio.
// They are NOT deterministic STT — outputs may be refused, truncated, or
// rephrased per the LLM's behavior. For pure transcription, prefer
// internal/ai/stt where available.
type Model interface {
    GenerateFromAudio(ctx context.Context, req Request) (*Response, error)
}

type Request struct {
    Audio        io.Reader
    Size         int64
    ContentType  string
    Model        string
    Instructions string   // literal instruction the model is expected to follow
    Temperature  *float32 // optional; nil leaves provider default
}

type Response struct {
    Text         string
    FinishReason FinishReason
}

type FinishReason string

const (
    FinishStop     FinishReason = "stop"     // model finished normally
    FinishLength   FinishReason = "length"   // truncated by max-tokens
    FinishSafety   FinishReason = "safety"   // safety filter blocked output
    FinishOther    FinishReason = "other"    // anything else (incl. unknown)
)
```

#### Factory dispatch

```go
// internal/ai/stt/factory.go
package stt

import (
    "github.com/pkg/errors"
    "github.com/usememos/memos/internal/ai"
    "github.com/usememos/memos/internal/ai/stt/openai"
)

func NewTranscriber(cfg ai.ProviderConfig, opts ...TranscriberOption) (Transcriber, error) {
    switch cfg.Type {
    case ai.ProviderOpenAI:
        return openai.New(cfg, applyOptions(opts...))
    case ai.ProviderGemini:
        return nil, errors.Wrapf(ai.ErrSTTNotSupported,
            "Gemini does not provide a dedicated STT endpoint; use audiollm.NewModel instead")
    default:
        return nil, errors.Wrapf(ai.ErrCapabilityUnsupported, "provider type %q", cfg.Type)
    }
}
```

```go
// internal/ai/audiollm/factory.go
package audiollm

import (
    "github.com/pkg/errors"
    "github.com/usememos/memos/internal/ai"
    "github.com/usememos/memos/internal/ai/audiollm/gemini"
)

func NewModel(cfg ai.ProviderConfig, opts ...ModelOption) (Model, error) {
    switch cfg.Type {
    case ai.ProviderGemini:
        return gemini.New(cfg, applyOptions(opts...))
    case ai.ProviderOpenAI:
        // NOTE: gpt-4o-audio-preview support belongs here but is out of scope;
        // see §2 (Non-Goals).
        return nil, errors.Wrapf(ai.ErrAudioLLMNotSupported,
            "OpenAI multimodal audio (gpt-4o-audio) is not yet implemented in this codebase")
    default:
        return nil, errors.Wrapf(ai.ErrCapabilityUnsupported, "provider type %q", cfg.Type)
    }
}
```

### 6.3 Backend Handler Dispatch

The handler at `server/router/api/v1/ai_service.go:Transcribe` dispatches based on `provider.Type`:

```go
func (s *APIV1Service) Transcribe(ctx context.Context, request *v1pb.TranscribeRequest) (*v1pb.TranscribeResponse, error) {
    // ... existing config loading, provider resolution, audio reading ...

    switch provider.Type {
    case ai.ProviderOpenAI:
        text, err := s.transcribeViaSTT(ctx, provider, transcriptionCfg, audio, contentType)
        if err != nil {
            return nil, status.Errorf(codes.Internal, "failed to transcribe: %v", err)
        }
        return &v1pb.TranscribeResponse{Text: text}, nil

    case ai.ProviderGemini:
        text, err := s.transcribeViaAudioLLM(ctx, provider, transcriptionCfg, audio, contentType)
        if err != nil {
            return nil, status.Errorf(codes.Internal, "failed to transcribe: %v", err)
        }
        return &v1pb.TranscribeResponse{Text: text}, nil

    default:
        return nil, status.Errorf(codes.FailedPrecondition,
            "provider type %q is not supported for transcription", provider.Type)
    }
}

func (s *APIV1Service) transcribeViaSTT(ctx context.Context, provider ai.ProviderConfig,
                                          cfg *storepb.TranscriptionConfig,
                                          audio io.Reader, contentType string) (string, error) {
    t, err := stt.NewTranscriber(provider)
    if err != nil { return "", err }
    resp, err := t.Transcribe(ctx, stt.Request{
        Audio:       audio,
        Filename:    "audio",
        ContentType: contentType,
        Model:       resolveModel(provider, cfg.Model),
        Prompt:      cfg.Prompt,    // Whisper: soft hint, may be ignored
        Language:    cfg.Language,
    })
    if err != nil { return "", err }
    return resp.Text, nil
}

func (s *APIV1Service) transcribeViaAudioLLM(ctx context.Context, provider ai.ProviderConfig,
                                                cfg *storepb.TranscriptionConfig,
                                                audio io.Reader, contentType string) (string, error) {
    m, err := audiollm.NewModel(provider)
    if err != nil { return "", err }
    resp, err := m.GenerateFromAudio(ctx, audiollm.Request{
        Audio:        audio,
        ContentType:  contentType,
        Model:        resolveModel(provider, cfg.Model),
        Instructions: buildTranscriptionInstructions(cfg.Prompt, cfg.Language),
    })
    if err != nil { return "", err }
    if resp.FinishReason != audiollm.FinishStop {
        return "", errors.Errorf("transcription incomplete (finish reason: %s)", resp.FinishReason)
    }
    return resp.Text, nil
}
```

`buildTranscriptionInstructions` lives next to the handler and centralizes the literal instruction sent to multimodal LLMs:

```go
func buildTranscriptionInstructions(prompt, language string) string {
    parts := []string{
        "Transcribe the audio accurately. Return only the transcript text. " +
        "Do not summarize, explain, or add content that is not spoken.",
    }
    if language != "" {
        parts = append(parts, fmt.Sprintf("The input language is %s.", language))
    }
    if prompt != "" {
        parts = append(parts, "Context and spelling hints:\n"+prompt)
    }
    return strings.Join(parts, "\n\n")
}
```

`resolveModel` returns `cfg.Model` if non-empty, else the per-provider default from `ai/models.go` (unchanged from today).

### 6.4 Implementation Notes Per Package

#### `internal/ai/stt/openai/openai.go`

- Identical wire behavior to current `internal/ai/openai.go::openAITranscriber.Transcribe`.
- Uses `github.com/openai/openai-go/v3` SDK (already a dep).
- Defaults `endpoint` to `https://api.openai.com/v1`. Trims trailing slash. Validates URL.
- Honors `cfg.Endpoint` to support OpenAI-compatible providers (Groq Whisper, faster-whisper self-hosted, Azure Whisper deployments). The user simply adds another `AIProviderConfig` row with `Type=OPENAI` and a different `Endpoint`.
- Supports any model the underlying endpoint accepts: `whisper-1`, `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`, `gpt-4o-transcribe-diarize`, etc. The model string is opaque.
- Returns `Response.Language` and `Response.Segments` populated when the API returns them; otherwise empty.

#### `internal/ai/audiollm/gemini/gemini.go`

- Identical wire behavior to current `internal/ai/gemini.go::geminiTranscriber.Transcribe`, EXCEPT:
  - Reads `Instructions` from the caller (not hardcoded inside the package).
  - Maps `genai.FinishReason` to `audiollm.FinishReason` (`STOP→FinishStop`, `MAX_TOKENS→FinishLength`, `SAFETY→FinishSafety`, anything else → `FinishOther`).
  - Returns `Response{Text, FinishReason}` instead of swallowing the finish reason into a generic error.
- Continues to use `internal/ai/audio.WebMOpusToWAV` for WebM transcoding (Gemini doesn't accept WebM).
- Continues to enforce `maxGeminiInlineAudioSize` (14 MiB) — File API support is out of scope.
- Uses `google.golang.org/genai` SDK (already a dep).

#### `internal/ai/errors.go`

Add:
```go
var ErrSTTNotSupported = errors.New("provider does not support speech-to-text capability")
var ErrAudioLLMNotSupported = errors.New("provider does not support multimodal audio capability")
```
Keep existing `ErrProviderNotFound` and `ErrCapabilityUnsupported`.

### 6.5 Proto Schema Changes

**Two comment-only updates. No field additions, no field renames, no breaking changes.**

#### Improvement #2 — `TranscriptionConfig.model` comment

Replace lines 179–181 of `proto/store/instance_setting.proto`:

```proto
  // model is the provider-specific model identifier.
  // Empty string falls back to the engine default
  // (whisper-1 for OPENAI providers, gemini-2.5-flash for GEMINI providers).
  string model = 2;
```

with:

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

**Rationale:** OpenAI's `/audio/transcriptions` endpoint now supports the `gpt-4o-transcribe` family in addition to `whisper-1`. The current comment is misleading — it implies Whisper is the only OpenAI option.

#### Improvement #3 — `TranscriptionConfig.prompt` comment

Replace lines 188–191:

```proto
  // prompt is a default spelling/vocabulary hint passed to the provider.
  // Used as the OpenAI Whisper "prompt" parameter and folded into the Gemini
  // generation prompt as a "Context and spelling hints" block.
  string prompt = 4;
```

with:

```proto
  // prompt is a default spelling/vocabulary hint passed to the provider.
  // Used as the OpenAI Whisper "prompt" parameter (a soft hint that the model
  // may ignore) and folded into the Gemini generation prompt as a "Context and
  // spelling hints" block (which the LLM will treat more literally).
  string prompt = 4;
```

**Rationale:** Same field, two semantically different behaviors. Surfacing this in the schema documentation (which propagates to generated Go and TypeScript via JSDoc) makes the cross-provider variability explicit for any caller reading the bindings cold.

After editing the proto, regenerate via `cd proto && buf format -w && buf generate`. The two regenerated files are:
- `proto/gen/store/instance_setting.pb.go`
- `web/src/types/proto/store/instance_setting_pb.ts`

#### Why NOT add an `enabled` field (improvement #1)

Out of scope per §2. Doing it would add a new field that the frontend, backend, and migration logic all need to handle, for the sole benefit of letting users "disable but keep the config." The current `provider_id == ""` semantics work; the cost of the change exceeds the benefit at this moment.

### 6.6 Frontend Impact

Minimal. `web/src/components/Settings/AISection.tsx` already:

- Switches the model placeholder per provider (`placeholderForProvider` at line 371, using `setting.ai.transcription-model-placeholder-gemini` / `-openai`).
- Disables the form when `providerId == ""`.
- Validates that the referenced provider exists.

Recommended adjustments (in scope):

1. **Update i18n model placeholder strings** in `web/src/locales/en.json` to reflect the new model examples:
   - `setting.ai.transcription-model-placeholder-openai`: include `gpt-4o-transcribe` family alongside `whisper-1`.
   - `setting.ai.transcription-model-placeholder-gemini`: confirm `gemini-2.5-flash` is the listed example.
2. **Update the prompt help text** (`setting.ai.transcription-prompt-help`) to note the cross-provider semantic difference, mirroring the new proto comment in user-facing language.

No structural component changes. No new fields. No state-shape changes.

### 6.7 What Stays Identical

- Database storage (`InstanceSetting` rows, `AISetting` blob) — proto field tags unchanged.
- API surface (`TranscribeRequest`, `TranscribeResponse` messages) — unchanged.
- gRPC/Connect endpoint paths — unchanged.
- Frontend state shape (`LocalTranscription`) — unchanged.
- All existing tests semantically unchanged (will be ported to new package paths).

## 7. Migration Path

The refactor is internal to the Go server. End-to-end behavior is preserved. Migration is staged so each stage is independently buildable, testable, and revertable.

| Stage | What | Compiles? | Tests pass? |
|---|---|---|---|
| A | Add `internal/ai/stt/` and `internal/ai/audiollm/` with new interfaces and (empty) factories. Add new errors. | ✅ | ✅ (no callers yet) |
| B | Implement `internal/ai/stt/openai/` — port behavior from current `openai.go::openAITranscriber`. Port tests to `stt/openai/openai_test.go`. | ✅ | ✅ |
| C | Implement `internal/ai/audiollm/gemini/` — port behavior from current `gemini.go::geminiTranscriber`, but: lift instructions out into the caller, return `FinishReason` instead of swallowing it. Port tests. | ✅ | ✅ |
| D | Refactor `server/router/api/v1/ai_service.go::Transcribe` to dispatch via the new factories. Add `transcribeViaSTT` and `transcribeViaAudioLLM`. Add `buildTranscriptionInstructions`. | ✅ | ✅ |
| E | Delete old files: `internal/ai/transcription.go`, `client.go`, `openai.go`, `openai_test.go`, `gemini.go`, `gemini_test.go`. | ✅ | ✅ |
| F | Update proto comments (#2 and #3), run `buf format -w && buf generate`. | ✅ | ✅ |
| G | Update `web/src/locales/en.json` strings for model placeholders and prompt help. | ✅ | ✅ |

Each stage is one commit. Reverting any single stage leaves the system in a working state.

## 8. Anti-Patterns Avoided (and Why)

| Anti-pattern | Where it would have come from | Why we're avoiding it |
|---|---|---|
| `ProviderType` enum with wire-format suffix (`OPENAI_TRANSCRIPTIONS`, `OPENAI_CHAT_AUDIO`) | Earlier brainstorming draft | Vercel/LiteLLM/Go ecosystem all use vendor-level identity; capability is implied by which interface you call. |
| `Response.Source` enum (`NativeSTT`, `MultimodalLLM`) | Earlier brainstorming draft | None of the three SDKs surveyed has this. It re-introduces the "pretend STT" smell at a different layer. |
| Adapter wrapping `audiollm.Model` as `stt.Transcriber` | Earlier brainstorming draft | Adapter would re-create the conflation we're trying to remove. Application-layer dispatch is honest. |
| Adding `transcription_*` fields to `AIProviderConfig` | Naive instinct | Three of three OSS apps surveyed (Open WebUI, LobeChat, Dify) do **not** do this. Pollutes the provider entity; repeats with every new capability. |
| Silently reusing chat provider credentials for STT (LobeChat's deprecated pattern) | LobeChat-style shortcut | LobeChat's own author marked the helper `@deprecated`. Memos's existing `provider_id` reference is more flexible (user can configure a different OpenAI-compatible endpoint, e.g. Groq, just for STT). |
| Per-model credential overrides, capability YAML, load balancing | Dify | Enterprise complexity that doesn't fit Memos's scope. |
| Auto-fallback from STT failure to multimodal-LLM transcription | Plausible "smart" idea | LiteLLM doesn't do this; failure modes and cost differ enough that fallback would surprise users. Explicit dispatch by provider type is what LiteLLM ships. |

## 9. Open Decisions

All resolved during brainstorming. None remain open. For the record:

1. **Direction A (split STT/Audio-LLM into separate interfaces) over Direction B (capability-flag system) over Direction C (audio-to-structured-note pipeline).** Resolved: A. Rationale: most honest abstraction, matches mainstream SDKs, leaves the door open to C as a future addition without rework.
2. **Provider type naming: vendor-level (`openai`/`gemini`) over wire-format-encoded.** Resolved: vendor-level. Rationale: matches Vercel/LiteLLM/Go convention; new OpenAI transcription model snapshots require zero schema or code changes.
3. **`TranscriptionConfig.Duration` field decision.** Not present in current proto; not added. Audio duration belongs to resource metadata (computed from the file at upload time), not to the transcription response.
4. **Multimodal failure-mode surface.** Resolved: expose `FinishReason` from `audiollm.Model` to the application layer; the Transcribe handler converts non-`Stop` reasons into informative errors.

## 10. Implementation Plan Pointer

Once this spec is approved, the implementation plan will be created at `docs/superpowers/plans/2026-05-02-stt-audiollm-split.md` covering Stages A–G from §7 above as discrete, bite-sized tasks with TDD steps and per-stage commits.
