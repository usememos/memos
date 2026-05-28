# Transcription (STT) settings — design

**Date:** 2026-05-02
**Scope:** Backend + frontend. Schema-additive (no migration required).

## Problem

Memos has one AI feature today: audio transcription (speech-to-text). The current design has three concrete problems:

1. **Model is hard-coded per provider type.** `internal/ai/models.go` pins OpenAI to `gpt-4o-transcribe` and Gemini to `gemini-2.5-flash`. Users who want `whisper-1` (cheaper, often more accurate for non-English) or third-party Whisper-compatible endpoints (Groq's `whisper-large-v3-turbo`, self-hosted whisper.cpp / Speaches via OpenAI-compatible URL) cannot configure them at all.
2. **No explicit transcription configuration.** `InstanceAISetting.providers` is a generic credentials list. The frontend (`MemoEditor/index.tsx:65`) implicitly picks "the first provider with an API key whose type is in TRANSCRIPTION_PROVIDER_TYPES." Users cannot:
   - Choose which provider runs transcription when they have multiple.
   - Set a default language (Whisper API supports it but it is never sent).
   - Set a `prompt` hint to bias spelling of proper nouns / jargon (a documented Whisper feature, surfaced by every other STT product).
3. **Gemini fails for browser-recorded audio.** `internal/ai/gemini.go:23` does not list `audio/webm` in `geminiSupportedContentTypes`, but `MediaRecorder` in browsers defaults to `audio/webm`. So selecting a Gemini provider for in-editor recording produces a content-type error every time.

## Goal

Let the operator configure transcription explicitly: which provider, which model, default language, and a spelling-hint prompt. Make the OpenAI provider work as a universal "OpenAI-compatible" engine so Groq / self-hosted Whisper / Speaches are reachable through endpoint override.

## Non-goals

- Adding STT engines beyond OpenAI and Gemini (Azure, Deepgram, AWS Transcribe — out of scope; the schema admits them later via `AIProviderType` enum).
- Other AI features (summarization, embeddings, tag suggestion). The schema is shaped so they fit later, but none are designed here.
- Per-call provider override at recording time. Research across all surveyed products (OpenWebUI, LibreChat, Whisper Memos, Superwhisper, etc.) confirms STT engine is a global preference, not an action-time choice. We follow the same pattern.
- Server-side audio transcoding (e.g., webm → wav for Gemini). See "Gemini webm" below for the chosen mitigation.
- Multi-user or per-user override of admin defaults. Memos' STT setting is instance-scoped, like every other instance setting.

## Naming

Field and message names follow cross-platform STT conventions, not Memos-internal shorthand:

| Concept | Chosen name | Rationale |
|---|---|---|
| Config message | `TranscriptionConfig` | AssemblyAI uses this exact identifier; matches OpenAI's `CreateTranscription*` verb family and Memos' existing `Transcribe` RPC. The `STT` acronym is not used as a type name in any major STT API. |
| Provider reference | `provider_id` (string) | Plain protobuf convention for a string-ID reference (`field_id`, `user_id` style). `engine` was rejected as an OpenWebUI-only term; typed message refs are not needed since providers are addressed by string ID. |
| Model | `model` | Unanimous across OpenAI, Google v2, Deepgram, OpenWebUI, LibreChat. Not `model_id`. |
| Default language | `language` | Bare `language` is the modern convention (OpenAI, Whisper family, Deepgram, Wyoming). `language_code` is the older Google/AWS form; we accept ISO 639-1 short codes the same way OpenAI does. |
| Spelling hint | `prompt` | OpenAI's public API field name and AssemblyAI's. Whisper's internal name is `initial_prompt`, but `prompt` is what users of `audio.transcriptions.create` recognize. |

A note on the message name collision: `proto/api/v1/ai_service.proto` already declares a `TranscriptionConfig` for **per-call** prompt/language overrides. The new store-level `TranscriptionConfig` lives in package `memos.store`, so the two compile cleanly. Memos already uses parallel `api.v1.X` / `store.X` message pairs (e.g. `User`, `Memo`); this matches that pattern.

## Architecture

### Schema (additive)

`proto/store/instance_setting.proto`:

```proto
message InstanceAISetting {
  repeated AIProviderConfig providers = 1;   // unchanged — credential pool
  TranscriptionConfig transcription = 2;     // NEW — feature config
}

message TranscriptionConfig {
  // References an entry in providers[].id. Empty string = transcription disabled.
  string provider_id = 1;
  // Free text. Empty string = engine default (whisper-1 for OPENAI, gemini-2.5-flash for GEMINI).
  string model = 2;
  // ISO 639-1 short code. Empty string = auto-detect.
  string language = 3;
  // Up to ~200 tokens. Used as the OpenAI Whisper `prompt` parameter and as
  // a "Context and spelling hints:" block in the Gemini prompt.
  string prompt = 4;
}
```

`proto/api/v1/ai_service.proto`:

- `TranscribeRequest.provider_id` becomes optional. When omitted, the server resolves the provider from `InstanceAISetting.transcription.provider_id`.
- `TranscribeRequest.config` (per-call `TranscriptionConfig` with `prompt` / `language`) is kept for advanced overrides but its fields, when empty, fall back to the persisted defaults from `InstanceAISetting.transcription`.

### Backend changes

1. **`internal/ai/models.go`** — `DefaultTranscriptionModel` already exists; reuse it as the fallback when `TranscriptionConfig.model` is empty. No new code, just used from a new call site.
2. **`server/router/api/v1/ai_service.go`**:
   - Read `InstanceAISetting.transcription` at the start of `Transcribe`.
   - Resolve `provider_id` from request → fall back to `transcription.provider_id`. If both empty, return `FailedPrecondition` with a clear "transcription not configured" message.
   - Resolve `model` similarly: request override → `transcription.model` → engine default via `DefaultTranscriptionModel`.
   - Merge `language` and `prompt`: per-call overrides win; otherwise fall through to persisted defaults.
3. **`internal/ai/gemini.go`** — out of scope to fix the webm content-type list here. See mitigation below.

### Frontend changes

`web/src/components/Settings/AISection.tsx` is restructured into two settings groups inside the existing `SettingSection`:

1. **AI Integrations** (renamed from "Providers" — current behavior): list of credential entries (id, title, type, endpoint, api key). No functional changes; the rename communicates that this section is just credentials.
2. **Transcription** (new): three-segment form
   - **Provider** — Select dropdown listing entries from group 1 by `title`. First option is "None — transcription disabled". Disabled with a hint "Add an AI integration first ↑" when group 1 is empty.
   - **Model** — text input. Placeholder updates dynamically based on the selected provider's type (`whisper-1` for OPENAI, `gemini-2.5-flash` for GEMINI). Help text below: "Free text. Use the provider's model identifier — e.g., whisper-1, gpt-4o-transcribe, whisper-large-v3-turbo."
   - **Default language** — text input, ISO 639-1 placeholder, empty = auto.
   - **Prompt hints** — textarea, ~200 token soft limit, help text "Improves spelling of proper nouns and jargon. Whisper limit is ~224 tokens."

`web/src/components/MemoEditor/index.tsx:65` changes:

- Replace the "first provider with apiKey in TRANSCRIPTION_PROVIDER_TYPES" lookup with this enable rule: transcribe button shows iff `aiSetting.transcription.providerId` is non-empty AND the referenced provider exists in `aiSetting.providers` AND that provider has `apiKeySet === true`.
- The editor no longer needs to know the provider object itself for the call — see service change below.

`web/src/components/MemoEditor/services/transcriptionService.ts` is simplified: it stops accepting a `provider` argument and simply omits `provider_id` from the request. The server resolves the provider, model, language, and prompt from `InstanceAISetting.transcription`. (No override path is exposed at the editor layer; advanced callers can still pass `provider_id` directly via the proto if needed in the future.)

### How "OpenAI-compatible" backends work

To use Groq, Speaches, or self-hosted whisper.cpp:

1. In **AI Integrations**, add a provider with type `OPENAI`, set `endpoint` to e.g. `https://api.groq.com/openai/v1` or `http://speaches:8000/v1`, set the API key, give it a recognizable title ("Groq", "Self-hosted Whisper").
2. In **Transcription**, select that provider and set `model` to the backend's model identifier (`whisper-large-v3-turbo`, `Systran/faster-distil-whisper-large-v3`, etc.).

This is the universal escape hatch confirmed across OpenWebUI, LibreChat, and Whisper Obsidian plugin: don't enumerate every backend — let the OpenAI engine be a transport, not a brand.

## Gemini webm mitigation

The Gemini `audio/webm` failure is a real user-blocking bug but separate from the settings redesign. Three options were considered:

- **(a) Server-side transcode** with ffmpeg. Adds a heavy runtime dep; rejected as YAGNI.
- **(b) Switch MediaRecorder format** when STT engine is Gemini. Browser support for `audio/mp4` and `audio/wav` in `MediaRecorder` is patchy across Firefox / Safari / Chrome; rejected as fragile.
- **(c) Inline hint + accept the limitation.** Selected. The Transcription section shows a small warning under the model field when the chosen provider type is `GEMINI`: "Gemini does not accept browser-recorded `audio/webm`. For in-editor recording, use an OpenAI-compatible provider."

Server-side transcoding can be revisited later as a self-contained change if Gemini demand grows.

## Validation

Server validation (`server/router/api/v1/ai_service.go`):

- `transcription.provider_id`, when set, must reference an existing entry in `providers[]`. On `UpdateInstanceSetting` for the AI key, reject with `InvalidArgument` if it doesn't.
- `transcription.model` length cap: 256 chars (covers `Systran/faster-distil-whisper-large-v3`-style names with margin).
- `transcription.language` length cap: 32 chars (existing constant `maxTranscriptionLanguageLength`).
- `transcription.prompt` length cap: 4096 chars (existing constant `maxTranscriptionPromptLength`).

Frontend validation in `AISection.tsx`:

- "Save" disabled if `transcription.providerId` is set but the referenced provider was just deleted from the integrations list (in the same unsaved edit).
- Inline warning shown (but Save still allowed) if the referenced provider exists but has `apiKeySet === false` — surfacing the broken state so the operator can fix it without blocking unrelated edits to other settings.

## Backwards compatibility

The schema change is purely additive. Existing instances with `providers` configured but no `transcription` field default to `provider_id = ""`, which means transcription is disabled until the operator visits the new Transcription section and selects a provider.

This is a small UX regression for instances that were relying on the implicit "first provider wins" behavior — they now must make a one-click selection. Acceptable trade-off because:

- It makes the choice explicit (the implicit pick was the source of confusion when users had multiple providers).
- A one-time migration that auto-fills `transcription.provider_id` with the first STT-capable provider is feasible but adds complexity for a one-line user action. Skip the migration; document the change in the release notes.

## Testing

- `internal/ai/transcription_test.go` (existing) covers the transcribe RPC. Add cases for: empty `provider_id` falls back to setting; empty `model` falls back to `DefaultTranscriptionModel`; per-call overrides win over settings.
- `server/router/api/v1/test/ai_service_test.go` (existing) covers the API service. Add cases for the validation rules above (unknown provider_id, oversized model/language/prompt).
- Frontend: manual verification via the dev server (`pnpm dev` in `web/`) — load Settings, add a provider, configure transcription, verify the home editor's record button enables/disables based on `provider_id`. No new component tests required (existing AISection has none).

## Out of scope, explicitly

- Multiple transcription configurations / per-tag or per-user routing.
- Per-call provider override exposed in the editor UI.
- Test-transcription button in settings (worth doing later; deferred to keep this scope tight).
- Glossary / vocabulary list as a separate field — folded into `prompt` for now (Joplin/Superwhisper split this; we can add later if users ask).
- TTS settings. Memos has none today and none planned.
