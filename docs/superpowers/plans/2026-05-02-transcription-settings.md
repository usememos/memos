# Transcription (STT) Settings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the implicit "first AI provider with an API key wins" transcription flow with an explicit, instance-level `TranscriptionConfig` that names a provider, model, default language, and prompt hint — enabling Whisper / Groq / self-hosted Whisper-compatible endpoints, restoring multi-provider flexibility, and exposing the Whisper API's `prompt` field for proper-noun spelling hints.

**Architecture:** Schema-additive. Add `TranscriptionConfig` (provider_id, model, language, prompt) to both `proto/store/instance_setting.proto` and `proto/api/v1/instance_service.proto` under `InstanceAISetting` / `InstanceSetting.AISetting`. Server-side `Transcribe` resolves provider/model/language/prompt from the persisted config when not overridden in the request, falling through to the existing `DefaultTranscriptionModel` for the model. `UpdateInstanceSetting` validates `transcription.provider_id` references an existing provider and that the persisted config's strings respect length caps. Frontend splits the existing `AISection` into two groups — "AI Integrations" (existing providers list, renamed in copy) and "Transcription" (new four-field form: Provider / Model / Language / Prompt) — and the home `MemoEditor` reads `aiSetting.transcription` instead of scanning `providers`.

**Tech Stack:** Backend Go 1.26, Connect RPC + protobuf via `buf` (remote plugins), `github.com/pkg/errors`, gRPC `status.Errorf`. Frontend React 18 + TypeScript 6, `@bufbuild/protobuf` v2, Connect-ES, Tailwind v4, Radix UI primitives via `@/components/ui/*`. Tests: Go `testing` + `testify/require`; frontend manual verification (no component tests in `Settings/`).

**Spec:** `docs/superpowers/specs/2026-05-02-transcription-settings-design.md`

**Branch note:** This work is intended for a fresh worktree off `main` (e.g. `feat/transcription-settings`). The spec was committed on `feat/calendar-date-prefill` because that branch was active at brainstorm time; before starting Task 1, create a new worktree:

```bash
git worktree add -b feat/transcription-settings ../memos-transcription main
cd ../memos-transcription
git cherry-pick <spec-commit-sha>   # bring the spec doc onto the new branch
```

---

## File map

**Created**

- (none — all changes are edits or generated)

**Modified — protobuf source (changes regenerate Go + TS + OpenAPI via `buf generate`)**

- `proto/store/instance_setting.proto` — add `TranscriptionConfig` message and `transcription` field on `InstanceAISetting`.
- `proto/api/v1/instance_service.proto` — add parallel `TranscriptionConfig` message and `transcription` field inside the nested `AISetting` message.

**Modified — backend Go**

- `server/router/api/v1/instance_service.go` — extend `convertInstanceAISettingFromStore` / `convertInstanceAISettingToStore` to round-trip `transcription`; extend `prepareInstanceAISettingForUpdate` to validate `transcription.provider_id` exists in `providers[]` (when set) and length-cap `model` / `language` / `prompt`; preserve unchanged transcription fields when an `UpdateInstanceSetting` request omits them.
- `server/router/api/v1/ai_service.go` — read `InstanceAISetting.transcription` at the start of `Transcribe`; resolve provider_id / model / language / prompt via "request override → persisted setting → engine default"; return `FailedPrecondition` when no provider can be resolved; remove the now-redundant `provider_id` REQUIRED gate (becomes optional in the proto).
- `proto/api/v1/ai_service.proto` — relax `TranscribeRequest.provider_id` from REQUIRED to OPTIONAL.

**Modified — backend tests**

- `server/router/api/v1/test/ai_service_test.go` — add cases: persisted `transcription.provider_id` resolves when request omits it; persisted `transcription.model` overrides default; per-call `Config.prompt` wins over persisted prompt; `FailedPrecondition` when neither request nor setting names a provider.
- `server/router/api/v1/test/instance_service_test.go` — add cases for the new validation: unknown `transcription.provider_id` rejected; oversized `model` / `language` / `prompt` rejected; existing transcription preserved when the field is omitted on update.

**Modified — frontend**

- `web/src/components/Settings/AISection.tsx` — restructure into two `SettingGroup` blocks: "AI Integrations" (existing provider table) and "Transcription" (new). Add `TranscriptionForm` component co-located in the same file or split if it grows past ~120 LOC. Wire local state, change tracking via `lodash-es/isEqual`, save to the same `InstanceSetting_Key.AI` setting.
- `web/src/components/MemoEditor/index.tsx` — replace the `transcriptionProvider` lookup with a `canTranscribe` boolean derived from `aiSetting.transcription.providerId` plus the referenced provider's existence and `apiKeySet`.
- `web/src/components/MemoEditor/services/transcriptionService.ts` — drop the `provider` parameter; call `transcribe()` with no `providerId` (server resolves from the setting).
- `web/src/locales/en.json` — add new strings for the Transcription form. Other locale files are left for the maintainer's translation pass (consistent with how `byok-*` strings were originally added).

---

## Task 1: Add `TranscriptionConfig` to the store proto

**Files:**
- Modify: `proto/store/instance_setting.proto`

The store-level `TranscriptionConfig` is the persistent shape written to disk. Field numbers are fresh (1–4); the new field on `InstanceAISetting` reuses the next slot (2).

- [ ] **Step 1: Edit `proto/store/instance_setting.proto`**

In the file, locate `message InstanceAISetting { ... }` (around lines 149–152) and replace it with the version below. Then append the new `TranscriptionConfig` message immediately after the existing `AIProviderConfig` block (after the `AIProviderType` enum at the bottom of the file).

```proto
message InstanceAISetting {
  // providers is the list of AI provider configurations available instance-wide.
  repeated AIProviderConfig providers = 1;

  // transcription is the speech-to-text feature configuration.
  // When unset or transcription.provider_id is empty, transcription is disabled.
  TranscriptionConfig transcription = 2;
}
```

After the existing `enum AIProviderType { ... }` block, append:

```proto
// TranscriptionConfig configures the speech-to-text feature.
message TranscriptionConfig {
  // provider_id references an entry in InstanceAISetting.providers[].id.
  // Empty string means transcription is disabled.
  string provider_id = 1;

  // model is the provider-specific model identifier.
  // Empty string falls back to the engine default
  // (whisper-1 for OPENAI providers, gemini-2.5-flash for GEMINI providers).
  string model = 2;

  // language is the default ISO 639-1 language hint sent to the provider.
  // Empty string lets the provider auto-detect.
  string language = 3;

  // prompt is a default spelling/vocabulary hint passed to the provider.
  // Used as the OpenAI Whisper "prompt" parameter and folded into the Gemini
  // generation prompt as a "Context and spelling hints" block.
  string prompt = 4;
}
```

- [ ] **Step 2: Regenerate Go + TypeScript bindings**

Run from the `proto/` directory:

```bash
cd proto && buf format -w && buf generate
```

Expected: command exits 0; files under `proto/gen/store/instance_setting.pb.go` and `web/src/types/proto/store/instance_setting_pb.ts` updated to include `TranscriptionConfig` and the new `Transcription` field.

- [ ] **Step 3: Verify Go compiles**

Run from repo root:

```bash
go build ./...
```

Expected: PASS. (Backend code does not yet reference the new field, so this just confirms the generation is well-formed.)

- [ ] **Step 4: Commit**

```bash
git add proto/store/instance_setting.proto proto/gen/store/ web/src/types/proto/store/
git commit -m "feat(proto/store): add TranscriptionConfig to InstanceAISetting

Adds provider_id / model / language / prompt fields for the new
explicit transcription configuration. Schema-additive (field 2 on
InstanceAISetting); existing instances default to provider_id=\"\"
which means transcription is disabled until the operator selects
a provider in settings."
```

---

## Task 2: Mirror `TranscriptionConfig` into the API proto

**Files:**
- Modify: `proto/api/v1/instance_service.proto`

The API-level message mirrors the store version. They live in different proto packages (`memos.api.v1` vs `memos.store`), matching the existing parallel-message pattern (`User`, `Memo`, `AIProviderConfig`, etc.).

- [ ] **Step 1: Edit `proto/api/v1/instance_service.proto`**

Locate the nested `message AISetting { ... }` block (around lines 226–230) and replace it with:

```proto
  // AI provider configuration settings.
  message AISetting {
    // providers is the list of AI provider configurations available instance-wide.
    repeated AIProviderConfig providers = 1;

    // transcription is the speech-to-text feature configuration.
    // When unset or transcription.provider_id is empty, transcription is disabled.
    TranscriptionConfig transcription = 2;
  }
```

Immediately after the existing `enum AIProviderType { ... }` block (currently the last child of `InstanceSetting`, around lines 247–251), append the new nested message — keep the indentation: it lives inside `message InstanceSetting { ... }`:

```proto
  // TranscriptionConfig configures the speech-to-text feature.
  message TranscriptionConfig {
    // provider_id references an entry in AISetting.providers[].id.
    // Empty string means transcription is disabled.
    string provider_id = 1;

    // model is the provider-specific model identifier.
    // Empty string falls back to the engine default
    // (whisper-1 for OPENAI providers, gemini-2.5-flash for GEMINI providers).
    string model = 2;

    // language is the default ISO 639-1 language hint sent to the provider.
    // Empty string lets the provider auto-detect.
    string language = 3;

    // prompt is a default spelling/vocabulary hint passed to the provider.
    string prompt = 4;
  }
```

- [ ] **Step 2: Regenerate**

```bash
cd proto && buf format -w && buf generate
```

Expected: PASS. Updates `proto/gen/api/v1/instance_service.pb.go`, `proto/gen/openapi.yaml`, and `web/src/types/proto/api/v1/instance_service_pb.ts`.

- [ ] **Step 3: Verify Go still compiles**

```bash
go build ./...
```

Expected: PASS. Existing `convertInstanceAISetting*` functions still compile because the new field defaults to nil/zero on round-trip.

- [ ] **Step 4: Commit**

```bash
git add proto/api/v1/instance_service.proto proto/gen/ web/src/types/proto/api/
git commit -m "feat(proto/api): add TranscriptionConfig to AISetting

Mirrors the store-level TranscriptionConfig. Both messages live in
their own packages (memos.api.v1 vs memos.store) following the
existing parallel-message pattern used for AIProviderConfig."
```

---

## Task 3: Round-trip `transcription` through `convertInstanceAISetting{From,To}Store`

**Files:**
- Modify: `server/router/api/v1/instance_service.go:505-551`

The existing converters drop unknown fields silently because they only copy named fields. Without explicit handling, `transcription` would be lost on every round-trip. This task is purely plumbing — no validation yet.

- [ ] **Step 1: Edit `convertInstanceAISettingFromStore`**

Replace the function body (currently lines 505–528) so the returned `aiSetting` carries the new field:

```go
func convertInstanceAISettingFromStore(setting *storepb.InstanceAISetting) *v1pb.InstanceSetting_AISetting {
	if setting == nil {
		return nil
	}

	aiSetting := &v1pb.InstanceSetting_AISetting{
		Providers:     make([]*v1pb.InstanceSetting_AIProviderConfig, 0, len(setting.Providers)),
		Transcription: convertTranscriptionConfigFromStore(setting.GetTranscription()),
	}
	for _, provider := range setting.Providers {
		if provider == nil {
			continue
		}
		apiKey := provider.GetApiKey()
		aiSetting.Providers = append(aiSetting.Providers, &v1pb.InstanceSetting_AIProviderConfig{
			Id:         provider.GetId(),
			Title:      provider.GetTitle(),
			Type:       v1pb.InstanceSetting_AIProviderType(provider.GetType()),
			Endpoint:   provider.GetEndpoint(),
			ApiKeySet:  apiKey != "",
			ApiKeyHint: maskAPIKey(apiKey),
		})
	}
	return aiSetting
}
```

- [ ] **Step 2: Edit `convertInstanceAISettingToStore`**

Replace the function body (currently lines 530–551):

```go
func convertInstanceAISettingToStore(setting *v1pb.InstanceSetting_AISetting) *storepb.InstanceAISetting {
	if setting == nil {
		return nil
	}

	aiSetting := &storepb.InstanceAISetting{
		Providers:     make([]*storepb.AIProviderConfig, 0, len(setting.Providers)),
		Transcription: convertTranscriptionConfigToStore(setting.GetTranscription()),
	}
	for _, provider := range setting.Providers {
		if provider == nil {
			continue
		}
		aiSetting.Providers = append(aiSetting.Providers, &storepb.AIProviderConfig{
			Id:       provider.GetId(),
			Title:    provider.GetTitle(),
			Type:     storepb.AIProviderType(provider.GetType()),
			Endpoint: provider.GetEndpoint(),
			ApiKey:   provider.GetApiKey(),
		})
	}
	return aiSetting
}
```

- [ ] **Step 3: Add the two new converter helpers**

Append immediately after `convertInstanceAISettingToStore`:

```go
func convertTranscriptionConfigFromStore(setting *storepb.TranscriptionConfig) *v1pb.InstanceSetting_TranscriptionConfig {
	if setting == nil {
		return nil
	}
	return &v1pb.InstanceSetting_TranscriptionConfig{
		ProviderId: setting.GetProviderId(),
		Model:      setting.GetModel(),
		Language:   setting.GetLanguage(),
		Prompt:     setting.GetPrompt(),
	}
}

func convertTranscriptionConfigToStore(setting *v1pb.InstanceSetting_TranscriptionConfig) *storepb.TranscriptionConfig {
	if setting == nil {
		return nil
	}
	return &storepb.TranscriptionConfig{
		ProviderId: setting.GetProviderId(),
		Model:      setting.GetModel(),
		Language:   setting.GetLanguage(),
		Prompt:     setting.GetPrompt(),
	}
}
```

- [ ] **Step 4: Build**

```bash
go build ./...
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/router/api/v1/instance_service.go
git commit -m "feat(api/instance): round-trip transcription through AI setting converters"
```

---

## Task 4: Validate `transcription` in `prepareInstanceAISettingForUpdate`

**Files:**
- Modify: `server/router/api/v1/instance_service.go:564-623`

The spec lists four validation rules: `provider_id` must reference an existing entry in `providers[]` (when set); length caps on `model` (256), `language` (32), `prompt` (4096). Plus the "preserve previous on omit" rule that mirrors how API keys are preserved when a request omits them.

- [ ] **Step 1: Write the failing test for unknown provider_id**

Open `server/router/api/v1/test/instance_service_test.go` and append a new sub-test inside the existing top-level `TestUpdateInstanceSetting`-equivalent function (the same one that currently contains "UpdateInstanceSetting - AI provider keys are write-only and preserved on empty" near line 670). Find the closing brace of that sub-test and insert before it:

```go
	t.Run("UpdateInstanceSetting - transcription provider_id must reference an existing provider", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		adminCtx := ts.CreateUserContext(ctx, hostUser.ID)

		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &v1pb.UpdateInstanceSettingRequest{
			Setting: &v1pb.InstanceSetting{
				Name: "instance/settings/AI",
				Value: &v1pb.InstanceSetting_AiSetting{
					AiSetting: &v1pb.InstanceSetting_AISetting{
						Providers: []*v1pb.InstanceSetting_AIProviderConfig{
							{
								Id:     "openai-main",
								Title:  "OpenAI",
								Type:   v1pb.InstanceSetting_OPENAI,
								ApiKey: "sk-test",
							},
						},
						Transcription: &v1pb.InstanceSetting_TranscriptionConfig{
							ProviderId: "does-not-exist",
						},
					},
				},
			},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "transcription provider_id")
	})

	t.Run("UpdateInstanceSetting - transcription strings are length-capped", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		adminCtx := ts.CreateUserContext(ctx, hostUser.ID)

		base := &v1pb.InstanceSetting{
			Name: "instance/settings/AI",
			Value: &v1pb.InstanceSetting_AiSetting{
				AiSetting: &v1pb.InstanceSetting_AISetting{
					Providers: []*v1pb.InstanceSetting_AIProviderConfig{
						{
							Id:     "openai-main",
							Title:  "OpenAI",
							Type:   v1pb.InstanceSetting_OPENAI,
							ApiKey: "sk-test",
						},
					},
				},
			},
		}

		oversizedModel := strings.Repeat("a", 257)
		base.GetAiSetting().Transcription = &v1pb.InstanceSetting_TranscriptionConfig{
			ProviderId: "openai-main",
			Model:      oversizedModel,
		}
		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &v1pb.UpdateInstanceSettingRequest{Setting: base})
		require.Error(t, err)
		require.Contains(t, err.Error(), "transcription model")

		oversizedLanguage := strings.Repeat("a", 33)
		base.GetAiSetting().Transcription = &v1pb.InstanceSetting_TranscriptionConfig{
			ProviderId: "openai-main",
			Language:   oversizedLanguage,
		}
		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &v1pb.UpdateInstanceSettingRequest{Setting: base})
		require.Error(t, err)
		require.Contains(t, err.Error(), "transcription language")

		oversizedPrompt := strings.Repeat("a", 4097)
		base.GetAiSetting().Transcription = &v1pb.InstanceSetting_TranscriptionConfig{
			ProviderId: "openai-main",
			Prompt:     oversizedPrompt,
		}
		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &v1pb.UpdateInstanceSettingRequest{Setting: base})
		require.Error(t, err)
		require.Contains(t, err.Error(), "transcription prompt")
	})

	t.Run("UpdateInstanceSetting - transcription is preserved when omitted on update", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		adminCtx := ts.CreateUserContext(ctx, hostUser.ID)

		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &v1pb.UpdateInstanceSettingRequest{
			Setting: &v1pb.InstanceSetting{
				Name: "instance/settings/AI",
				Value: &v1pb.InstanceSetting_AiSetting{
					AiSetting: &v1pb.InstanceSetting_AISetting{
						Providers: []*v1pb.InstanceSetting_AIProviderConfig{
							{
								Id:     "openai-main",
								Title:  "OpenAI",
								Type:   v1pb.InstanceSetting_OPENAI,
								ApiKey: "sk-test",
							},
						},
						Transcription: &v1pb.InstanceSetting_TranscriptionConfig{
							ProviderId: "openai-main",
							Model:      "whisper-1",
							Language:   "en",
							Prompt:     "names: Alice",
						},
					},
				},
			},
		})
		require.NoError(t, err)

		_, err = ts.Service.UpdateInstanceSetting(adminCtx, &v1pb.UpdateInstanceSettingRequest{
			Setting: &v1pb.InstanceSetting{
				Name: "instance/settings/AI",
				Value: &v1pb.InstanceSetting_AiSetting{
					AiSetting: &v1pb.InstanceSetting_AISetting{
						Providers: []*v1pb.InstanceSetting_AIProviderConfig{
							{
								Id:     "openai-main",
								Title:  "OpenAI",
								Type:   v1pb.InstanceSetting_OPENAI,
								ApiKey: "",
							},
						},
					},
				},
			},
		})
		require.NoError(t, err)

		stored, err := ts.Store.GetInstanceAISetting(ctx)
		require.NoError(t, err)
		require.NotNil(t, stored.GetTranscription())
		require.Equal(t, "openai-main", stored.GetTranscription().GetProviderId())
		require.Equal(t, "whisper-1", stored.GetTranscription().GetModel())
		require.Equal(t, "en", stored.GetTranscription().GetLanguage())
		require.Equal(t, "names: Alice", stored.GetTranscription().GetPrompt())
	})
```

Confirm `strings` is already imported in this test file. If not, add `"strings"` to its import block.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
go test -run TestUpdateInstanceSetting -v ./server/router/api/v1/test/... 2>&1 | tail -40
```

Expected: the three new sub-tests FAIL because `prepareInstanceAISettingForUpdate` does not yet validate or preserve `transcription`.

- [ ] **Step 3: Add validation + preservation to `prepareInstanceAISettingForUpdate`**

Open `server/router/api/v1/instance_service.go`. Add these constants near the top of the file (or next to existing instance setting constants — search for any existing length cap constants and place these alongside):

```go
const (
	maxTranscriptionConfigModelLength    = 256
	maxTranscriptionConfigLanguageLength = 32
	maxTranscriptionConfigPromptLength   = 4096
)
```

Then, at the very end of the existing `prepareInstanceAISettingForUpdate` function (immediately before its closing `return nil`), insert:

```go
	if err := preparePersistedTranscriptionConfig(setting, existing); err != nil {
		return err
	}
```

And add this new function next to `prepareInstanceAISettingForUpdate`:

```go
func preparePersistedTranscriptionConfig(setting *storepb.InstanceAISetting, existing *storepb.InstanceAISetting) error {
	// Preserve the previously stored transcription config when the request omits it,
	// matching the same "absence == keep" semantics used for API keys.
	if setting.Transcription == nil {
		if existing != nil {
			setting.Transcription = existing.GetTranscription()
		}
		return nil
	}

	cfg := setting.Transcription
	cfg.ProviderId = strings.TrimSpace(cfg.ProviderId)
	cfg.Model = strings.TrimSpace(cfg.Model)
	cfg.Language = strings.TrimSpace(cfg.Language)
	cfg.Prompt = strings.TrimSpace(cfg.Prompt)

	if cfg.ProviderId != "" {
		referenced := false
		for _, provider := range setting.Providers {
			if provider != nil && provider.Id == cfg.ProviderId {
				referenced = true
				break
			}
		}
		if !referenced {
			return errors.Errorf("transcription provider_id %q does not reference any configured provider", cfg.ProviderId)
		}
	}

	if len(cfg.Model) > maxTranscriptionConfigModelLength {
		return errors.Errorf("transcription model is too long; maximum length is %d characters", maxTranscriptionConfigModelLength)
	}
	if len(cfg.Language) > maxTranscriptionConfigLanguageLength {
		return errors.Errorf("transcription language is too long; maximum length is %d characters", maxTranscriptionConfigLanguageLength)
	}
	if len(cfg.Prompt) > maxTranscriptionConfigPromptLength {
		return errors.Errorf("transcription prompt is too long; maximum length is %d characters", maxTranscriptionConfigPromptLength)
	}
	return nil
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
go test -run TestUpdateInstanceSetting -v ./server/router/api/v1/test/... 2>&1 | tail -40
```

Expected: PASS for all three new sub-tests plus all existing sub-tests.

- [ ] **Step 5: Commit**

```bash
git add server/router/api/v1/instance_service.go server/router/api/v1/test/instance_service_test.go
git commit -m "feat(api/instance): validate and preserve transcription config

Validates transcription.provider_id references an existing provider
and length-caps model (256), language (32), and prompt (4096). When
an update omits transcription, the previously stored config is
preserved — same semantics as the existing API-key preservation."
```

---

## Task 5: Make `TranscribeRequest.provider_id` optional

**Files:**
- Modify: `proto/api/v1/ai_service.proto:24`

The persisted setting becomes the source of truth; the request field is now an override for advanced callers.

- [ ] **Step 1: Edit `proto/api/v1/ai_service.proto`**

Change line 24 from:

```proto
  // Required. The instance AI provider ID to use.
  string provider_id = 1 [(google.api.field_behavior) = REQUIRED];
```

to:

```proto
  // Optional. The instance AI provider ID to use. When empty, the server
  // resolves the provider from InstanceAISetting.transcription.provider_id.
  string provider_id = 1 [(google.api.field_behavior) = OPTIONAL];
```

- [ ] **Step 2: Regenerate**

```bash
cd proto && buf format -w && buf generate
```

Expected: PASS.

- [ ] **Step 3: Build**

```bash
go build ./...
```

Expected: PASS. (The Connect/gRPC stub regenerates with the same Go field shape; field_behavior is metadata only.)

- [ ] **Step 4: Commit**

```bash
git add proto/api/v1/ai_service.proto proto/gen/
git commit -m "feat(proto/api): make TranscribeRequest.provider_id optional

When omitted, the server resolves the provider from the persisted
InstanceAISetting.transcription configuration."
```

---

## Task 6: Resolve transcription config in the `Transcribe` RPC

**Files:**
- Modify: `server/router/api/v1/ai_service.go`

The current implementation requires `provider_id` and uses `DefaultTranscriptionModel` for the model. The new flow: per-call request → persisted `transcription` → engine default. Per-call `Config.prompt` and `Config.language` already exist; they should now fall through to the persisted defaults when empty.

- [ ] **Step 1: Write a failing test — persisted provider resolves when request omits provider_id**

Open `server/router/api/v1/test/ai_service_test.go` and append, inside the existing `TestTranscribe` function (before the closing brace of the function — currently line 280), a new sub-test:

```go
	t.Run("resolves provider from persisted transcription setting when request omits provider_id", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "alice-fallthrough")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		openAIServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.NoError(t, r.ParseMultipartForm(10<<20))
			require.Equal(t, "whisper-1", r.FormValue("model"))
			require.Equal(t, "fr", r.FormValue("language"))
			require.Equal(t, "names: Alice", r.FormValue("prompt"))
			w.Header().Set("Content-Type", "application/json")
			require.NoError(t, json.NewEncoder(w).Encode(map[string]string{"text": "ok"}))
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

		resp, err := ts.Service.Transcribe(userCtx, &v1pb.TranscribeRequest{
			Config: &v1pb.TranscriptionConfig{},
			Audio: &v1pb.TranscriptionAudio{
				Source:      &v1pb.TranscriptionAudio_Content{Content: []byte("RIFF")},
				Filename:    "voice.wav",
				ContentType: "audio/wav",
			},
		})
		require.NoError(t, err)
		require.Equal(t, "ok", resp.Text)
	})

	t.Run("per-call config overrides persisted prompt and language", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "alice-override")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		openAIServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.NoError(t, r.ParseMultipartForm(10<<20))
			require.Equal(t, "de", r.FormValue("language"))
			require.Equal(t, "override prompt", r.FormValue("prompt"))
			w.Header().Set("Content-Type", "application/json")
			require.NoError(t, json.NewEncoder(w).Encode(map[string]string{"text": "ok"}))
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
						Language:   "fr",
						Prompt:     "names: Alice",
					},
				},
			},
		})
		require.NoError(t, err)

		_, err = ts.Service.Transcribe(userCtx, &v1pb.TranscribeRequest{
			Config: &v1pb.TranscriptionConfig{
				Language: "de",
				Prompt:   "override prompt",
			},
			Audio: &v1pb.TranscriptionAudio{
				Source:      &v1pb.TranscriptionAudio_Content{Content: []byte("RIFF")},
				Filename:    "voice.wav",
				ContentType: "audio/wav",
			},
		})
		require.NoError(t, err)
	})

	t.Run("returns FailedPrecondition when no provider configured", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "alice-empty")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		_, err = ts.Service.Transcribe(userCtx, &v1pb.TranscribeRequest{
			Config: &v1pb.TranscriptionConfig{},
			Audio: &v1pb.TranscriptionAudio{
				Source:      &v1pb.TranscriptionAudio_Content{Content: []byte("RIFF")},
				Filename:    "voice.wav",
				ContentType: "audio/wav",
			},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "transcription is not configured")
	})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
go test -run TestTranscribe -v ./server/router/api/v1/test/... 2>&1 | tail -60
```

Expected: the three new sub-tests FAIL — "resolves provider from persisted setting" fails because the current code requires `request.ProviderId`; "per-call config overrides" fails because the current code does not read the persisted prompt/language at all (so the persisted-only case isn't tested but the override path doesn't merge); "returns FailedPrecondition" fails because the current error is `InvalidArgument: provider_id is required`.

- [ ] **Step 3: Refactor `Transcribe` to resolve from the persisted setting**

In `server/router/api/v1/ai_service.go`, replace the block from the start of the `Transcribe` method that validates `provider_id` and resolves the provider — currently lines 54–101 — with the version below. Keep the audio validation block (lines 68–91) intact: it stays AFTER the provider resolution because audio errors should still surface as `InvalidArgument` regardless of transcription config.

Specifically, replace lines 54–101 with:

```go
	if request.Config == nil {
		return nil, status.Errorf(codes.InvalidArgument, "config is required")
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

	aiSetting, err := s.Store.GetInstanceAISetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get AI setting: %v", err)
	}
	persisted := aiSetting.GetTranscription()

	providerID := strings.TrimSpace(request.GetProviderId())
	if providerID == "" {
		providerID = persisted.GetProviderId()
	}
	if providerID == "" {
		return nil, status.Errorf(codes.FailedPrecondition, "transcription is not configured")
	}

	provider, err := s.resolveAIProvider(aiSetting, providerID)
	if err != nil {
		return nil, err
	}

	model := strings.TrimSpace(request.GetConfig().GetModel())
	if model == "" {
		model = persisted.GetModel()
	}
	if model == "" {
		defaultModel, err := ai.DefaultTranscriptionModel(provider.Type)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "%v", err)
		}
		model = defaultModel
	}

	prompt := strings.TrimSpace(request.GetConfig().GetPrompt())
	if prompt == "" {
		prompt = persisted.GetPrompt()
	}
	if len(prompt) > maxTranscriptionPromptLength {
		return nil, status.Errorf(codes.InvalidArgument, "prompt is too long; maximum length is %d characters", maxTranscriptionPromptLength)
	}

	language := strings.TrimSpace(request.GetConfig().GetLanguage())
	if language == "" {
		language = persisted.GetLanguage()
	}
	if len(language) > maxTranscriptionLanguageLength {
		return nil, status.Errorf(codes.InvalidArgument, "language is too long; maximum length is %d characters", maxTranscriptionLanguageLength)
	}
```

Note: `request.GetConfig().GetModel()` requires that the API-level `TranscriptionConfig` actually have a `model` field. The current proto only has `prompt` and `language`. We don't add a model override field at this step — the `GetModel()` accessor will not exist. Remove the model-override line entirely so the precedence is **persisted setting → engine default**, with no per-call override:

Replace the model resolution block above with this simpler version (which is the actual code to commit):

```go
	model := persisted.GetModel()
	if model == "" {
		defaultModel, err := ai.DefaultTranscriptionModel(provider.Type)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "%v", err)
		}
		model = defaultModel
	}
```

Also delete the existing helper `resolveAIProviderForTranscription` (currently lines 119–142) and replace it with this slimmer one that takes a pre-fetched setting:

```go
func (s *APIV1Service) resolveAIProvider(setting *storepb.InstanceAISetting, providerID string) (ai.ProviderConfig, error) {
	providers := make([]ai.ProviderConfig, 0, len(setting.GetProviders()))
	for _, provider := range setting.GetProviders() {
		if provider == nil {
			continue
		}
		providers = append(providers, convertAIProviderConfigFromStore(provider))
	}

	provider, err := ai.FindProvider(providers, providerID)
	if err != nil {
		return ai.ProviderConfig{}, status.Errorf(codes.NotFound, "AI provider not found")
	}
	return *provider, nil
}
```

The remainder of `Transcribe` (the call to `ai.NewTranscriber`, the `transcriber.Transcribe(...)` call, the response construction) is unchanged — `prompt`, `language`, `model`, `provider` are all already in scope.

- [ ] **Step 4: Run the tests**

```bash
go test -run TestTranscribe -v ./server/router/api/v1/test/... 2>&1 | tail -60
```

Expected: PASS for all old sub-tests plus the three new ones.

- [ ] **Step 5: Run the full backend suite**

```bash
go test -race ./server/... ./internal/...
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/router/api/v1/ai_service.go server/router/api/v1/test/ai_service_test.go
git commit -m "feat(api/ai): resolve transcription from persisted setting

Transcribe now resolves provider, model, language, and prompt with
this precedence: per-call request → persisted transcription config
→ engine default. provider_id may be omitted from the request when
the operator has selected a provider in settings. Returns
FailedPrecondition when no provider can be resolved."
```

---

## Task 7: Frontend — restructure `AISection` into Integrations + Transcription

**Files:**
- Modify: `web/src/components/Settings/AISection.tsx`
- Modify: `web/src/locales/en.json`

The existing provider list stays as-is in a renamed group. A new `TranscriptionForm` group is added below it. Both groups share a single Save action that writes the entire `AISetting` (this matches the existing pattern — the protobuf save is already whole-message).

- [ ] **Step 1: Add new locale keys**

Open `web/src/locales/en.json`. Locate the `"ai": { ... }` block (starting around line 411). Inside that block, add the following keys (alphabetically sorted to match the file's convention; most fall between `keep-api-key` and `label`):

```json
      "integrations-description": "Provider keys are supplied by the instance owner and used by server-side AI features.",
      "integrations-title": "AI integrations",
      "transcription-description": "Speech-to-text settings used when recording audio in the memo composer.",
      "transcription-empty-providers": "Add an AI integration first to enable transcription.",
      "transcription-language-help": "ISO 639-1 short code (e.g. en, de, zh). Leave empty to auto-detect.",
      "transcription-language-placeholder": "auto-detect",
      "transcription-language": "Default language",
      "transcription-model-help": "Free text. Use the provider's model identifier — e.g. whisper-1, gpt-4o-transcribe, whisper-large-v3-turbo.",
      "transcription-model-placeholder-gemini": "gemini-2.5-flash",
      "transcription-model-placeholder-openai": "whisper-1",
      "transcription-model": "Model",
      "transcription-no-provider": "None — transcription disabled",
      "transcription-prompt-help": "Improves spelling of proper nouns and jargon. Whisper limit is roughly 224 tokens.",
      "transcription-prompt-placeholder": "Names: Alice, Bob. Glossary: kubernetes, OAuth.",
      "transcription-prompt": "Prompt hints",
      "transcription-provider": "Provider",
      "transcription-title": "Transcription",
      "transcription-warning-gemini-webm": "Gemini does not accept browser-recorded audio/webm. For in-editor recording, use an OpenAI-compatible provider.",
      "transcription-warning-no-key": "The selected provider has no API key set. Edit the integration above to add one.",
```

Also leave the existing `"providers": "Providers"` key — `AISection.tsx` no longer uses it, but other locale files reference it; we won't churn translations for an unused string.

- [ ] **Step 2: Restructure `AISection.tsx`**

Open `web/src/components/Settings/AISection.tsx`. The strategy: keep the existing provider table inside a new `SettingGroup` titled with `setting.ai.integrations-title`, and add a sibling `SettingGroup` for transcription. Reuse `useState`/`isEqual` change tracking, but for both providers and transcription combined.

Replace the file contents with the structure below. (This is a full rewrite of the file; the dialog component is unchanged from the existing implementation and is included verbatim at the bottom.)

```tsx
import { create } from "@bufbuild/protobuf";
import { isEqual } from "lodash-es";
import { MoreVerticalIcon, PlusIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useInstance } from "@/contexts/InstanceContext";
import {
  InstanceSetting_AIProviderConfig,
  InstanceSetting_AIProviderConfigSchema,
  InstanceSetting_AIProviderType,
  InstanceSetting_AISettingSchema,
  InstanceSetting_Key,
  InstanceSetting_TranscriptionConfig,
  InstanceSetting_TranscriptionConfigSchema,
  InstanceSettingSchema,
} from "@/types/proto/api/v1/instance_service_pb";
import { useTranslate } from "@/utils/i18n";
import SettingGroup from "./SettingGroup";
import { SettingPanel } from "./SettingList";
import SettingSection from "./SettingSection";
import SettingTable from "./SettingTable";
import useInstanceSettingUpdater, { buildInstanceSettingName } from "./useInstanceSettingUpdater";

type LocalAIProvider = {
  id: string;
  title: string;
  type: InstanceSetting_AIProviderType;
  endpoint: string;
  apiKey: string;
  apiKeySet: boolean;
  apiKeyHint: string;
};

type LocalTranscription = {
  providerId: string;
  model: string;
  language: string;
  prompt: string;
};

const providerTypeOptions = [InstanceSetting_AIProviderType.OPENAI, InstanceSetting_AIProviderType.GEMINI];

const byokNotes = ["setting.ai.byok-key-note", "setting.ai.byok-storage-note", "setting.ai.byok-model-note"] as const;

const createProviderID = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const getProviderTypeLabel = (type: InstanceSetting_AIProviderType) => {
  return InstanceSetting_AIProviderType[type] ?? "UNKNOWN";
};

const toLocalProvider = (provider: InstanceSetting_AIProviderConfig): LocalAIProvider => ({
  id: provider.id,
  title: provider.title,
  type: provider.type,
  endpoint: provider.endpoint,
  apiKey: "",
  apiKeySet: provider.apiKeySet,
  apiKeyHint: provider.apiKeyHint,
});

const toLocalTranscription = (config: InstanceSetting_TranscriptionConfig | undefined): LocalTranscription => ({
  providerId: config?.providerId ?? "",
  model: config?.model ?? "",
  language: config?.language ?? "",
  prompt: config?.prompt ?? "",
});

const newProvider = (): LocalAIProvider => ({
  id: createProviderID(),
  title: "",
  type: InstanceSetting_AIProviderType.OPENAI,
  endpoint: "",
  apiKey: "",
  apiKeySet: false,
  apiKeyHint: "",
});

const toProviderConfig = (provider: LocalAIProvider) =>
  create(InstanceSetting_AIProviderConfigSchema, {
    id: provider.id,
    title: provider.title.trim(),
    type: provider.type,
    endpoint: provider.endpoint.trim(),
    apiKey: provider.apiKey,
  });

const toTranscriptionConfig = (transcription: LocalTranscription) =>
  create(InstanceSetting_TranscriptionConfigSchema, {
    providerId: transcription.providerId,
    model: transcription.model.trim(),
    language: transcription.language.trim(),
    prompt: transcription.prompt,
  });

const AISection = () => {
  const t = useTranslate();
  const saveInstanceSetting = useInstanceSettingUpdater();
  const { aiSetting: originalSetting } = useInstance();
  const [providers, setProviders] = useState<LocalAIProvider[]>(() => originalSetting.providers.map(toLocalProvider));
  const [transcription, setTranscription] = useState<LocalTranscription>(() => toLocalTranscription(originalSetting.transcription));
  const [editingProvider, setEditingProvider] = useState<LocalAIProvider | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<LocalAIProvider | undefined>();

  useEffect(() => {
    setProviders(originalSetting.providers.map(toLocalProvider));
    setTranscription(toLocalTranscription(originalSetting.transcription));
  }, [originalSetting.providers, originalSetting.transcription]);

  const originalProviders = useMemo(() => originalSetting.providers.map(toLocalProvider), [originalSetting.providers]);
  const originalTranscription = useMemo(() => toLocalTranscription(originalSetting.transcription), [originalSetting.transcription]);
  const hasChanges = !isEqual(providers, originalProviders) || !isEqual(transcription, originalTranscription);

  const transcriptionProviderRef = useMemo(
    () => providers.find((provider) => provider.id === transcription.providerId),
    [providers, transcription.providerId],
  );

  const handleCreateProvider = () => {
    setEditingProvider(newProvider());
  };

  const handleEditProvider = (provider: LocalAIProvider) => {
    setEditingProvider({ ...provider, apiKey: "" });
  };

  const handleSaveProvider = (provider: LocalAIProvider) => {
    const title = provider.title.trim();
    const endpoint = provider.endpoint.trim();

    if (!title) {
      toast.error(t("setting.ai.provider-title-required"));
      return;
    }
    if (!provider.apiKeySet && !provider.apiKey.trim()) {
      toast.error(t("setting.ai.api-key-required"));
      return;
    }

    const normalizedProvider = { ...provider, title, endpoint };
    setProviders((prev) => {
      const exists = prev.some((item) => item.id === normalizedProvider.id);
      if (!exists) {
        return [...prev, normalizedProvider];
      }
      return prev.map((item) => (item.id === normalizedProvider.id ? normalizedProvider : item));
    });
    setEditingProvider(undefined);
  };

  const handleDeleteProvider = () => {
    if (!deleteTarget) return;
    setProviders((prev) => prev.filter((provider) => provider.id !== deleteTarget.id));
    if (transcription.providerId === deleteTarget.id) {
      setTranscription((prev) => ({ ...prev, providerId: "" }));
    }
    setDeleteTarget(undefined);
  };

  const handleSaveSetting = async () => {
    if (transcription.providerId && !transcriptionProviderRef) {
      toast.error(t("setting.ai.transcription-empty-providers"));
      return;
    }
    await saveInstanceSetting({
      key: InstanceSetting_Key.AI,
      setting: create(InstanceSettingSchema, {
        name: buildInstanceSettingName(InstanceSetting_Key.AI),
        value: {
          case: "aiSetting",
          value: create(InstanceSetting_AISettingSchema, {
            providers: providers.map(toProviderConfig),
            transcription: toTranscriptionConfig(transcription),
          }),
        },
      }),
      errorContext: "Update AI setting",
    });
  };

  return (
    <SettingSection
      title={t("setting.ai.label")}
      actions={
        <Button onClick={handleCreateProvider}>
          <PlusIcon className="w-4 h-4 mr-2" />
          {t("setting.ai.add-provider")}
        </Button>
      }
    >
      <SettingPanel className="bg-muted/30 px-4 py-3">
        <div className="flex max-w-3xl flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium text-foreground">
              {t("setting.ai.byok-label")}
            </span>
            <h4 className="text-sm font-semibold text-foreground">{t("setting.ai.byok-title")}</h4>
          </div>
          <p className="text-sm text-muted-foreground">{t("setting.ai.byok-description")}</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {byokNotes.map((note) => (
              <li key={note} className="flex gap-2">
                <span className="mt-2 size-1 rounded-full bg-muted-foreground/60" aria-hidden />
                <span>{t(note)}</span>
              </li>
            ))}
          </ul>
        </div>
      </SettingPanel>

      <SettingGroup title={t("setting.ai.integrations-title")} description={t("setting.ai.integrations-description")}>
        <SettingTable
          columns={[
            {
              key: "title",
              header: t("common.name"),
              render: (_, provider: LocalAIProvider) => (
                <div className="flex flex-col gap-0.5">
                  <span className="text-foreground">{provider.title}</span>
                  <span className="font-mono text-xs text-muted-foreground">{provider.id}</span>
                </div>
              ),
            },
            {
              key: "type",
              header: t("setting.ai.provider-type"),
              render: (_, provider: LocalAIProvider) => <span>{getProviderTypeLabel(provider.type)}</span>,
            },
            {
              key: "endpoint",
              header: t("setting.ai.endpoint"),
              render: (_, provider: LocalAIProvider) => (
                <span className="font-mono text-xs">{provider.endpoint || t("setting.ai.default-endpoint")}</span>
              ),
            },
            {
              key: "apiKeySet",
              header: t("setting.ai.api-key"),
              render: (_, provider: LocalAIProvider) => (
                <span className="font-mono text-xs">{provider.apiKeySet ? provider.apiKeyHint || t("setting.ai.configured") : "-"}</span>
              ),
            },
            {
              key: "actions",
              header: "",
              className: "text-right",
              render: (_, provider: LocalAIProvider) => (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreVerticalIcon className="w-4 h-auto" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={2}>
                    <DropdownMenuItem onClick={() => handleEditProvider(provider)}>{t("common.edit")}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDeleteTarget(provider)} className="text-destructive focus:text-destructive">
                      {t("common.delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ),
            },
          ]}
          data={providers}
          emptyMessage={t("setting.ai.no-providers")}
          getRowKey={(provider) => provider.id}
        />
      </SettingGroup>

      <SettingGroup
        title={t("setting.ai.transcription-title")}
        description={t("setting.ai.transcription-description")}
        showSeparator
      >
        <TranscriptionForm
          providers={providers}
          transcription={transcription}
          onChange={setTranscription}
          referencedProvider={transcriptionProviderRef}
        />
      </SettingGroup>

      <div className="w-full flex justify-end">
        <Button disabled={!hasChanges} onClick={handleSaveSetting}>
          {t("common.save")}
        </Button>
      </div>

      <AIProviderDialog
        provider={editingProvider}
        onOpenChange={(open) => !open && setEditingProvider(undefined)}
        onSave={handleSaveProvider}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={deleteTarget ? t("setting.ai.delete-provider", { title: deleteTarget.title }) : ""}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={handleDeleteProvider}
        confirmVariant="destructive"
      />
    </SettingSection>
  );
};

interface TranscriptionFormProps {
  providers: LocalAIProvider[];
  transcription: LocalTranscription;
  referencedProvider: LocalAIProvider | undefined;
  onChange: (next: LocalTranscription) => void;
}

const TranscriptionForm = ({ providers, transcription, referencedProvider, onChange }: TranscriptionFormProps) => {
  const t = useTranslate();
  const noProviders = providers.length === 0;

  const update = (partial: Partial<LocalTranscription>) => {
    onChange({ ...transcription, ...partial });
  };

  const placeholderForProvider = (provider: LocalAIProvider | undefined) => {
    if (!provider) return "";
    return provider.type === InstanceSetting_AIProviderType.GEMINI
      ? t("setting.ai.transcription-model-placeholder-gemini")
      : t("setting.ai.transcription-model-placeholder-openai");
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl">
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label>{t("setting.ai.transcription-provider")}</Label>
        <Select
          value={transcription.providerId || "__none__"}
          onValueChange={(value) => update({ providerId: value === "__none__" ? "" : value })}
          disabled={noProviders}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">{t("setting.ai.transcription-no-provider")}</SelectItem>
            {providers.map((provider) => (
              <SelectItem key={provider.id} value={provider.id}>
                {provider.title || provider.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {noProviders && <p className="text-xs text-muted-foreground">{t("setting.ai.transcription-empty-providers")}</p>}
        {referencedProvider && !referencedProvider.apiKeySet && (
          <p className="text-xs text-destructive">{t("setting.ai.transcription-warning-no-key")}</p>
        )}
        {referencedProvider?.type === InstanceSetting_AIProviderType.GEMINI && (
          <p className="text-xs text-muted-foreground">{t("setting.ai.transcription-warning-gemini-webm")}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label>{t("setting.ai.transcription-model")}</Label>
        <Input
          value={transcription.model}
          onChange={(e) => update({ model: e.target.value })}
          placeholder={placeholderForProvider(referencedProvider)}
          disabled={!transcription.providerId}
        />
        <p className="text-xs text-muted-foreground">{t("setting.ai.transcription-model-help")}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{t("setting.ai.transcription-language")}</Label>
        <Input
          value={transcription.language}
          onChange={(e) => update({ language: e.target.value })}
          placeholder={t("setting.ai.transcription-language-placeholder")}
          disabled={!transcription.providerId}
        />
        <p className="text-xs text-muted-foreground">{t("setting.ai.transcription-language-help")}</p>
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label>{t("setting.ai.transcription-prompt")}</Label>
        <Textarea
          value={transcription.prompt}
          onChange={(e) => update({ prompt: e.target.value })}
          placeholder={t("setting.ai.transcription-prompt-placeholder")}
          rows={3}
          disabled={!transcription.providerId}
        />
        <p className="text-xs text-muted-foreground">{t("setting.ai.transcription-prompt-help")}</p>
      </div>
    </div>
  );
};

interface AIProviderDialogProps {
  provider?: LocalAIProvider;
  onOpenChange: (open: boolean) => void;
  onSave: (provider: LocalAIProvider) => void;
}

const AIProviderDialog = ({ provider, onOpenChange, onSave }: AIProviderDialogProps) => {
  const t = useTranslate();
  const [draft, setDraft] = useState<LocalAIProvider>(() => provider ?? newProvider());

  useEffect(() => {
    const next = provider ?? newProvider();
    setDraft(next);
  }, [provider]);

  const updateDraft = (partial: Partial<LocalAIProvider>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  };

  const handleSave = () => {
    onSave(draft);
  };

  return (
    <Dialog open={!!provider} onOpenChange={onOpenChange}>
      <DialogContent size="2xl">
        <DialogHeader>
          <DialogTitle>{provider?.apiKeySet ? t("setting.ai.edit-provider") : t("setting.ai.add-provider")}</DialogTitle>
          <DialogDescription>{t("setting.ai.dialog-description")}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>{t("setting.ai.provider-title")}</Label>
            <Input value={draft.title} onChange={(e) => updateDraft({ title: e.target.value })} placeholder="OpenAI" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t("setting.ai.provider-type")}</Label>
            <Select
              value={String(draft.type)}
              onValueChange={(value) => updateDraft({ type: Number(value) as InstanceSetting_AIProviderType })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providerTypeOptions.map((type) => (
                  <SelectItem key={type} value={String(type)}>
                    {getProviderTypeLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>{t("setting.ai.endpoint")}</Label>
            <Input
              value={draft.endpoint}
              onChange={(e) => updateDraft({ endpoint: e.target.value })}
              placeholder={getDefaultEndpointPlaceholder(draft.type)}
            />
            <p className="text-xs text-muted-foreground">{t("setting.ai.endpoint-hint")}</p>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>{t("setting.ai.api-key")}</Label>
            <Input
              type="password"
              value={draft.apiKey}
              onChange={(e) => updateDraft({ apiKey: e.target.value })}
              placeholder={draft.apiKeySet ? t("setting.ai.keep-api-key") : ""}
            />
            {draft.apiKeySet && (
              <p className="text-xs text-muted-foreground">{t("setting.ai.current-key", { key: draft.apiKeyHint || "-" })}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave}>{t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const getDefaultEndpointPlaceholder = (type: InstanceSetting_AIProviderType) => {
  switch (type) {
    case InstanceSetting_AIProviderType.OPENAI:
      return "https://api.openai.com/v1";
    case InstanceSetting_AIProviderType.GEMINI:
      return "https://generativelanguage.googleapis.com/v1beta";
    default:
      return "";
  }
};

export default AISection;
```

Note: this references `Textarea` from `@/components/ui/textarea`. Verify that component exists by running:

```bash
ls web/src/components/ui/textarea.tsx
```

If the file is missing, the project doesn't have a Textarea primitive yet — fall back to the native `<textarea>` element with the same classes used by the project's `Input` for visual consistency. Keep the same props (`value`, `onChange`, `placeholder`, `rows`, `disabled`).

- [ ] **Step 3: Type-check + lint**

```bash
cd web && pnpm lint 2>&1 | tail -40
```

Expected: PASS. Common failures: missing import, mismatch between schema name (`InstanceSetting_TranscriptionConfigSchema`) and what `buf generate` produced — verify the exact name in `web/src/types/proto/api/v1/instance_service_pb.ts` (it may be `InstanceSetting_TranscriptionConfig` paired with `InstanceSetting_TranscriptionConfigSchema`, matching the AISetting pattern).

- [ ] **Step 4: Manual smoke test**

Start backend and frontend:

```bash
go run ./cmd/memos --port 8081 &
cd web && pnpm dev
```

Open `http://localhost:3001/`, sign in as the host user, navigate to Settings → AI:

- Verify the **AI integrations** group shows the existing provider table (or empty state).
- Verify the **Transcription** group renders with the four fields disabled when no provider is selected.
- Add a provider with type OPENAI and a key. The transcription section now lets you select it. Pick the provider; the model placeholder shows `whisper-1`. Type `whisper-1` in the model field, leave language empty, leave prompt empty, save.
- Refresh the page. The transcription section retains the saved provider and model.
- Change the provider title → save. The transcription section still references the same provider by id (title in dropdown updates).
- Delete the provider → the transcription section's `providerId` is cleared (model field becomes disabled).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/Settings/AISection.tsx web/src/locales/en.json
git commit -m "feat(settings): add Transcription configuration section

Splits the AI settings page into 'AI integrations' (existing
provider list) and 'Transcription' (new). The transcription form
chooses a provider, model, default language, and prompt hint. Save
writes the entire AI setting in one request."
```

---

## Task 8: Wire `MemoEditor` to the persisted transcription config

**Files:**
- Modify: `web/src/components/MemoEditor/index.tsx:31-67,130-159`
- Modify: `web/src/components/MemoEditor/services/transcriptionService.ts`

The editor previously scanned `aiSetting.providers` for the first one with an API key. It now reads `aiSetting.transcription.providerId`, validates the reference, and calls the service without a provider argument.

- [ ] **Step 1: Edit `transcriptionService.ts`**

Replace the entire contents of `web/src/components/MemoEditor/services/transcriptionService.ts` with:

```ts
import { create } from "@bufbuild/protobuf";
import { aiServiceClient } from "@/connect";
import { TranscribeRequestSchema, TranscriptionAudioSchema, TranscriptionConfigSchema } from "@/types/proto/api/v1/ai_service_pb";

export const transcriptionService = {
  async transcribeFile(file: File): Promise<string> {
    const content = new Uint8Array(await file.arrayBuffer());
    const response = await aiServiceClient.transcribe(
      create(TranscribeRequestSchema, {
        config: create(TranscriptionConfigSchema, {}),
        audio: create(TranscriptionAudioSchema, {
          source: {
            case: "content",
            value: content,
          },
          filename: file.name,
          contentType: file.type,
        }),
      }),
    );

    return response.text;
  },
};
```

Note: `providerId` is intentionally omitted — the server resolves it from `InstanceAISetting.transcription.providerId`.

- [ ] **Step 2: Edit `MemoEditor/index.tsx`**

Open the file. Two regions change:

**Region A** — replace lines 31–67 (the `TRANSCRIPTION_PROVIDER_TYPES` constant, the `transcriptionProvider` lookup, and the unused `InstanceSetting_AIProviderType` import path) with:

```tsx
// (delete the TRANSCRIPTION_PROVIDER_TYPES constant entirely — no longer needed)
```

And inside `MemoEditorImpl`, replace:

```tsx
  const transcriptionProvider = useMemo(
    () => aiSetting.providers.find((provider) => provider.apiKeySet && TRANSCRIPTION_PROVIDER_TYPES.includes(provider.type)),
    [aiSetting.providers],
  );
```

with:

```tsx
  const canTranscribe = useMemo(() => {
    const providerId = aiSetting.transcription?.providerId ?? "";
    if (!providerId) return false;
    const provider = aiSetting.providers.find((p) => p.id === providerId);
    return Boolean(provider?.apiKeySet);
  }, [aiSetting.providers, aiSetting.transcription?.providerId]);
```

Then update the import line at the top of the file. Currently:

```tsx
import { InstanceSetting_AIProviderType, InstanceSetting_Key } from "@/types/proto/api/v1/instance_service_pb";
```

Becomes (drop the `InstanceSetting_AIProviderType` import — it's no longer referenced in this file):

```tsx
import { InstanceSetting_Key } from "@/types/proto/api/v1/instance_service_pb";
```

**Region B** — replace lines 130–159 (the `handleTranscribeRecordedAudio` callback and any guards) so it consults `canTranscribe` and calls the service without a provider arg:

```tsx
  const handleTranscribeRecordedAudio = useCallback(
    async (localFile: LocalFile) => {
      if (!canTranscribe) {
        dispatch(actions.addLocalFile(localFile));
        setIsTranscribingAudio(false);
        setIsAudioRecorderOpen(false);
        return;
      }

      try {
        const text = (await transcriptionService.transcribeFile(localFile.file)).trim();
        if (!text) {
          dispatch(actions.addLocalFile(localFile));
          toast.error(t("editor.audio-recorder.transcribe-empty"));
          return;
        }

        insertTranscribedText(text);
        toast.success(t("editor.audio-recorder.transcribe-success"));
      } catch (error) {
        console.error(error);
        toast.error(errorService.getErrorMessage(error) || t("editor.audio-recorder.transcribe-error"));
        dispatch(actions.addLocalFile(localFile));
      } finally {
        setIsTranscribingAudio(false);
        setIsAudioRecorderOpen(false);
      }
    },
    [actions, canTranscribe, dispatch, insertTranscribedText, t],
  );
```

Then update `handleTranscribeAudioRecording` (currently around line 225) so its guard uses `canTranscribe`:

```tsx
  const handleTranscribeAudioRecording = () => {
    if (!canTranscribe || isTranscribingAudio) {
      return;
    }

    setIsTranscribingAudio(true);
    const didStop = audioRecorder.stopRecording("transcribe");
    if (!didStop) {
      setIsTranscribingAudio(false);
    }
  };
```

Finally, search the file for any remaining references to `transcriptionProvider` and replace them with `canTranscribe`. Also update the prop passed to `<AudioRecorderPanel canTranscribe={...}>` if it currently uses `transcriptionProvider` — replace with `canTranscribe`.

- [ ] **Step 3: Type-check**

```bash
cd web && pnpm lint 2>&1 | tail -20
```

Expected: PASS.

- [ ] **Step 4: Manual smoke test**

With the dev server running:

1. **No transcription configured**: Settings → AI shows providers but no transcription selection. In the home editor, open the audio recorder. The Transcribe button (waveform icon) should be hidden — only Cancel and Stop visible.
2. **Transcription configured with valid provider**: Select a provider in Transcription, set model to `whisper-1`, save. Open the recorder; the Transcribe button is now visible. Record a short clip in English, click Transcribe — text appears in the editor.
3. **Provider deleted after transcription was configured**: Configure transcription, save, then delete the referenced provider in AI Integrations and save. Reload the editor; the Transcribe button is hidden.
4. **API key cleared from referenced provider**: Edit a referenced provider so it has no API key (this requires backend support — currently impossible since save requires apiKey to be set; verify by writing setting directly via API or skip this case).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/MemoEditor/index.tsx web/src/components/MemoEditor/services/transcriptionService.ts
git commit -m "feat(memo-editor): use persisted transcription config

The editor's transcribe button now reflects InstanceAISetting.
transcription.providerId rather than an implicit \"first provider
with apiKey\" pick. The transcribeFile service no longer takes a
provider argument — the server resolves it from settings."
```

---

## Task 9: Strip the now-unused REQUIRED gate on `provider_id` in the server

**Files:**
- Modify: `server/router/api/v1/ai_service.go` (clean-up only)

Task 6 already deleted the `provider_id is required` `InvalidArgument` branch. This task confirms there's no orphaned helper or constant left behind.

- [ ] **Step 1: Search for orphans**

```bash
grep -n "resolveAIProviderForTranscription\|provider_id is required" server/router/api/v1/ai_service.go
```

Expected: no matches (Task 6 should have removed both). If anything matches, delete it.

- [ ] **Step 2: Run linter**

```bash
golangci-lint run ./server/router/api/v1/...
```

Expected: PASS.

- [ ] **Step 3: Run the full backend suite once more**

```bash
go test -race ./server/... ./internal/...
```

Expected: PASS.

- [ ] **Step 4: Commit (only if Step 1 found anything to clean up)**

If Step 1 returned matches and you removed code, commit:

```bash
git add server/router/api/v1/ai_service.go
git commit -m "chore(api/ai): remove orphaned helpers from old transcribe flow"
```

Otherwise, skip the commit — the task is a no-op verification.

---

## Task 10: End-to-end verification

**Files:** none — verification only.

- [ ] **Step 1: Full backend test suite**

```bash
go test -race ./...
```

Expected: PASS.

- [ ] **Step 2: Frontend lint + build**

```bash
cd web && pnpm lint && pnpm build
```

Expected: PASS for both.

- [ ] **Step 3: Manual end-to-end flow (single-instance smoke test)**

With backend on `:8081` and frontend on `:3001`:

1. Sign in as host user. Settings → AI.
2. Add a provider: type OPENAI, title "OpenAI", endpoint blank (defaults to `https://api.openai.com/v1`), api-key `sk-...` (real or fake).
3. In Transcription, select the provider, set model to `whisper-1`, leave language and prompt empty. Save. Toast confirms.
4. Refresh — transcription section retains the values.
5. Add a second provider: type OPENAI, title "Groq", endpoint `https://api.groq.com/openai/v1`, api-key `gsk_...`. Switch transcription's provider dropdown to Groq, set model to `whisper-large-v3-turbo`, save.
6. Open the home editor. Open audio recorder. Transcribe button visible. (Don't actually call the network unless your test key works.)
7. Switch transcription's provider to "None — transcription disabled". Save. Reopen the recorder — Transcribe button hidden.
8. Set provider back to "OpenAI". Add a Gemini provider; switch transcription to Gemini. Verify the inline warning "Gemini does not accept browser-recorded audio/webm" appears under the provider dropdown.

- [ ] **Step 4: Final commit (if anything was tweaked during verification)**

If verification surfaced any minor fix (e.g., a string typo in the locale), commit it now:

```bash
git add -A
git commit -m "chore(settings): polish transcription section copy"
```

---

## Self-review checklist (run before opening the PR)

1. **Spec coverage:**
   - Schema additive `TranscriptionConfig` (store + api): Tasks 1, 2 ✓
   - Backend: read setting at `Transcribe` start, fall-through resolution, `FailedPrecondition` when unconfigured: Task 6 ✓
   - Validation: `provider_id` references existing provider; length caps on model/language/prompt: Task 4 ✓
   - `TranscribeRequest.provider_id` becomes optional: Task 5 ✓
   - Frontend: AI Integrations + Transcription split, Provider/Model/Language/Prompt fields, provider dropdown disabled when empty, "Add an AI integration first" hint, Gemini webm warning, no-key warning: Task 7 ✓
   - Frontend: editor reads `aiSetting.transcription.providerId`, service drops provider arg: Task 8 ✓
   - Backwards compat (no migration): covered — existing instances default to empty `provider_id` and fall into "transcription disabled" branch ✓
   - Gemini webm: inline warning chosen, implemented as the `transcription-warning-gemini-webm` string in Task 7 ✓

2. **Placeholder scan:** No "TBD", "TODO", or "implement later" markers in this plan. Each step contains exact file paths, exact code, exact commands, expected output.

3. **Type / name consistency:**
   - Store proto: `InstanceAISetting.transcription` → `TranscriptionConfig` (Task 1).
   - Generated Go type: `storepb.TranscriptionConfig` (referenced in Tasks 3, 4, 6).
   - API proto: `InstanceSetting.AISetting.transcription` → `InstanceSetting.TranscriptionConfig` (Task 2). Generated Go type: `v1pb.InstanceSetting_TranscriptionConfig` (Tasks 3, 4). Generated TS type: `InstanceSetting_TranscriptionConfig` and `InstanceSetting_TranscriptionConfigSchema` (Task 7).
   - All uses match.

4. **Things to watch during execution:**
   - `buf generate` produces TS type names that differ slightly across generators. If `InstanceSetting_TranscriptionConfigSchema` doesn't exist after Task 2's regeneration, check the actual export name in `web/src/types/proto/api/v1/instance_service_pb.ts` and adjust Task 7's imports accordingly.
   - The `Textarea` UI primitive existence is verified mid-Task 7. If absent, fall back to `<textarea>` with project styling.
   - `prepareInstanceAISettingForUpdate` runs only when the AI setting key is being updated; the `existing` lookup uses `s.Store.GetInstanceAISetting(ctx)` which already returns the current state with transcription populated (after Task 1).
