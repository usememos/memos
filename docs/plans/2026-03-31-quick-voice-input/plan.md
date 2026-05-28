## Task List

Task Index

T1: Add recorder state and browser capture hook [M] — T2: Add composer recorder UI and draft audio handling [L]

### T1: Add recorder state and browser capture hook [M]

**Objective**: Introduce the frontend-only state and hook needed to record audio in the browser and convert the finished clip into the existing `LocalFile` draft format.
**Size**: M (2-3 files, moderate logic)
**Files**:
- Create: `web/src/components/MemoEditor/hooks/useVoiceRecorder.ts`
- Modify: `web/src/components/MemoEditor/state/types.ts`
- Modify: `web/src/components/MemoEditor/state/actions.ts`
- Modify: `web/src/components/MemoEditor/state/reducer.ts`
- Modify: `web/src/components/MemoEditor/hooks/index.ts`
- Modify: `web/src/components/MemoEditor/services/memoService.ts`
**Implementation**:
1. In `web/src/components/MemoEditor/state/types.ts`, add a `voiceRecorder` state slice for recorder support, permission, status, elapsed seconds, pending error, and the latest temporary recording preview.
2. In `web/src/components/MemoEditor/state/actions.ts`, add actions for support/permission updates, recorder status changes, timer updates, temporary recording storage, and recorder reset.
3. In `web/src/components/MemoEditor/state/reducer.ts`, implement the new voice-recorder actions without changing existing content, metadata, or save behavior.
4. In new `web/src/components/MemoEditor/hooks/useVoiceRecorder.ts`, implement browser capability detection, `getUserMedia`, `MediaRecorder` setup, start/stop lifecycle, blob collection, cleanup, and conversion of the stopped recording into a `File` plus preview URL compatible with `LocalFile`.
5. In `web/src/components/MemoEditor/services/memoService.ts`, update `fromMemo()` so loaded memo state includes the new `voiceRecorder` defaults required by `EditorState`.
6. In `web/src/components/MemoEditor/hooks/index.ts`, export the new hook for editor integration.
**Boundaries**: This task must not add any toolbar/panel UI, attachment rendering updates, or transcription/network behavior.
**Dependencies**: None
**Expected Outcome**: The memo editor has a recorder state model and a reusable browser recording hook that can produce a draft audio file.
**Validation**: `cd web && pnpm lint` — expected output: TypeScript and Biome checks pass.

### T2: Add composer recorder UI and draft audio handling [L]

**Objective**: Add a voice-recorder entry inside the composer tool dropdown and make kept recordings behave like draft audio attachments in the existing save flow.
**Size**: L (multiple files, coordinated UI/state integration)
**Files**:
- Create: `web/src/components/MemoEditor/components/VoiceRecorderPanel.tsx`
- Modify: `web/src/components/MemoEditor/index.tsx`
- Modify: `web/src/components/MemoEditor/components/EditorToolbar.tsx`
- Modify: `web/src/components/MemoEditor/components/index.ts`
- Modify: `web/src/components/MemoEditor/types/components.ts`
- Modify: `web/src/components/MemoEditor/types/attachment.ts`
- Modify: `web/src/components/MemoMetadata/Attachment/AttachmentListEditor.tsx`
- Modify: `web/src/components/MemoEditor/services/validationService.ts`
- Modify: `web/src/locales/en.json`
**Implementation**:
1. In `web/src/components/MemoEditor/Toolbar/InsertMenu.tsx` and `web/src/components/MemoEditor/components/EditorToolbar.tsx`, add a `Voice note` action to the existing compose tool dropdown instead of a separate toolbar button.
2. In new `web/src/components/MemoEditor/components/VoiceRecorderPanel.tsx`, render the recorder states `unsupported`, `idle`, `requesting_permission`, `recording`, `recorded`, and `error`, with explicit `Start`, `Stop`, `Keep`, and `Discard` actions.
3. In `web/src/components/MemoEditor/index.tsx`, render the recorder panel between editor content and the metadata/toolbar group, wire it to the editor context, and on `Keep` append the produced `LocalFile` to `state.localFiles`.
4. In `web/src/components/MemoEditor/types/attachment.ts`, classify local `audio/*` files as audio instead of generic documents.
5. In `web/src/components/MemoMetadata/Attachment/AttachmentListEditor.tsx`, render local draft audio items with playable audio controls while preserving existing remove behavior and existing attachment reordering rules.
6. In `web/src/components/MemoEditor/services/validationService.ts`, block save while a recording is actively running or permission is still being requested, but continue to allow save for kept draft audio files.
7. In `web/src/components/MemoEditor/components/index.ts`, `web/src/components/MemoEditor/types/components.ts`, and `web/src/locales/en.json`, add the exports, prop types, and English labels needed for the recorder UI.
**Boundaries**: This task must not add transcription, backend/API calls, settings UI, or redesign persisted audio playback beyond local draft preview.
**Dependencies**: T1
**Expected Outcome**: A user can choose `Voice note` from the memo composer tool dropdown, record audio in the browser, keep or discard the clip, preview a kept clip as a draft audio attachment, and save it through the existing attachment upload path.
**Validation**: `cd web && pnpm lint` — expected output: TypeScript and Biome checks pass with the new recorder workflow.

## Out-of-Scope Tasks

- Any transcription or speech-to-text behavior.
- Any proto, store, server, or instance-settings changes.
- Any speech provider configuration.
- Assistant-style voice conversations or spoken edit commands.
- Full locale backfill beyond the required English copy for this feature.
