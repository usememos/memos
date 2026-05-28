## References

- [OpenAI Help: ChatGPT Release Notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes%3F.ejs)
- [Anthropic Support: Using voice mode on Claude mobile apps](https://support.anthropic.com/en/articles/11101966-using-voice-mode-on-claude-mobile-apps)
- [Typeless](https://www.typeless.com/)
- [Typeless FAQ](https://www.typeless.com/help/faqs)
- [DeltaCircuit/react-media-recorder README](https://github.com/DeltaCircuit/react-media-recorder/blob/master/README.md)

## Industry Baseline

ChatGPT, Claude, and Typeless all treat voice capture as a first-class entrypoint near the main compose surface rather than as a secondary attachment action. The common pattern is immediate access to the microphone, visible recording state, and explicit stop/discard control.

Those products also keep the capture loop short. The user starts recording, sees a clear recording state, and either keeps or cancels the result. Even when the product supports richer voice features, the initial interaction cost stays low.

The `react-media-recorder` reference reflects the common browser implementation pattern behind that interaction: explicit recorder states, start/stop commands, generated blob URLs, and preview playback of the recorded media. That maps well to the current Memos editor because the editor already knows how to persist local files through the attachment upload path.

## Research Summary

The current Memos composer already has the downstream path needed for recorded audio files: local draft files can be attached in the editor, `uploadService` can persist them through `AttachmentService`, and persisted audio attachments already have dedicated playback UI. What is missing is the upstream capture step inside the composer.

Given the revised scope, the right fit is not dictation or voice chat. The immediate problem is only that users cannot create an audio file from the memo composer itself. That means the smallest useful design is a browser voice recorder that produces a normal draft attachment.

Because the scope is now frontend-only, the design should not introduce new server contracts, new instance settings, or any transcription workflow. The recorded clip should flow through the existing `LocalFile -> uploadService -> attachment` path exactly like other draft files.

## Design Goals

- A user can start recording from the memo composer in one explicit action without opening the attachment menu.
- Recording state is visible and explicit: idle, requesting permission, recording, recorded, unsupported, or error.
- A completed recording can be kept as a draft audio file or discarded before memo save.
- Kept recordings reuse the existing local-file and attachment-save flow with no backend changes.
- The draft attachment surface renders recorded audio as playable audio, not as a generic document row.
- Save is blocked while recording is actively in progress, but succeeds once a recording has been stopped and kept.

## Non-Goals

- Transcribing audio to text.
- Adding any proto, store, server, or instance-settings changes.
- Building a spoken assistant or voice-chat mode.
- Redesigning persisted audio playback beyond the minimum draft preview needed for local recordings.
- Adding background recording, global hotkeys, or native device integrations.

## Proposed Design

Add a `Voice note` entry to `web/src/components/MemoEditor/Toolbar/InsertMenu.tsx` rather than keeping a separate always-visible mic button in `web/src/components/MemoEditor/components/EditorToolbar.tsx`. This keeps the recorder close to the existing file and metadata insertion actions, reduces toolbar clutter, and still gives the user a direct path to create an audio attachment from the composer.

Introduce a `VoiceRecorderPanel` inside the memo editor layout, rendered between the editor body and the bottom metadata/toolbar area in `web/src/components/MemoEditor/index.tsx`. The panel is responsible for showing recorder state and actions, but it does not alter memo content. Its job is only to create or discard a draft audio file.

Add a dedicated `voiceRecorder` slice to `web/src/components/MemoEditor/state/types.ts` and `web/src/components/MemoEditor/state/reducer.ts`. The slice should hold support state, permission state, recorder status, elapsed time, pending error, and the most recent recorded draft clip before the user decides to keep or discard it. Keeping this state separate from `content`, `metadata`, and `localFiles` prevents recorder lifecycle state from leaking into unrelated editor behaviors.

Implement the browser media lifecycle in a dedicated hook such as `useVoiceRecorder`, following the `MediaRecorder` state pattern shown in `react-media-recorder`. The hook owns capability detection, `getUserMedia` requests, recorder start/stop, elapsed-time updates, blob assembly, and cleanup of tracks and blob URLs. The editor UI consumes only the hook output and dispatches reducer actions from it.

When the user stops a recording, convert the captured blob into a `File` and then into the existing `LocalFile` shape already used by file upload, paste, and drag-and-drop flows. The user can then either keep that `LocalFile`, which appends it to `state.localFiles`, or discard it, which revokes the blob URL and clears the recorder state. This keeps the design aligned with the existing upload path and avoids introducing a parallel attachment model.

Extend `web/src/components/MemoEditor/types/attachment.ts` so local `audio/*` files are classified as audio rather than falling back to `document`. Then update `web/src/components/MemoMetadata/Attachment/AttachmentListEditor.tsx` so draft audio files render with playable audio controls and normal remove behavior. This reuses the recent product investment in better audio presentation without requiring persisted attachments before preview is possible.

Update `web/src/components/MemoEditor/services/validationService.ts` so save remains allowed for normal local files and kept audio drafts, but not while `voiceRecorder.status` is actively `recording` or `requesting_permission`. That avoids saving a memo in the middle of a live recording session while preserving the existing rule that a memo may be saved with attachments and no text.

Do not introduce transcription, transcript review, speech-provider configuration, or server upload-before-save behavior in this design. Those alternatives were intentionally rejected because they expand the problem from “create an audio file quickly” into a larger speech-input subsystem. The current narrowed issue only requires fast recording and clean integration with the existing attachment flow.
