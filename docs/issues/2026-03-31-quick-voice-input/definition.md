## Background & Context

Memos is a self-hosted note-taking product whose main write path is the React memo composer in `web/src/components/MemoEditor`. Memo content is stored as Markdown text, attachments are uploaded through the v1 attachment API, and the server already has dedicated file-serving behavior for media playback. The most recent relevant change in this area was commit `63a17d89`, which refactored audio attachment rendering into reusable playback components. That change improved how audio files are displayed after upload; it did not add a microphone-driven input path inside the compose flow.

## Issue Statement

Memo creation currently starts from typed text plus file upload and metadata pickers, while audio support in the product begins only after an audio file already exists as an attachment. Users who want to capture memo content by speaking must leave the compose flow to record elsewhere, then upload or manually transcribe the result, because the editor has no direct path from microphone input to memo text or an in-progress audio attachment.

## Current State

- `web/src/components/MemoEditor/index.tsx:26-154` assembles the compose flow from `EditorContent`, `EditorMetadata`, and `EditorToolbar`, and persists drafts through `memoService.save`.
- `web/src/components/MemoEditor/Editor/index.tsx:27-214` implements the editor surface as a `<textarea>` with slash commands and tag suggestions. It has no microphone entrypoint, recording lifecycle, or transcript state.
- `web/src/components/MemoEditor/components/EditorToolbar.tsx:10-54` renders the bottom toolbar with `InsertMenu`, visibility, cancel, and save actions. There is no first-class voice action in the primary control row.
- `web/src/components/MemoEditor/Toolbar/InsertMenu.tsx:40-189` exposes upload, link-memo, location, and focus-mode actions, and uses a hidden `<input type="file">` for attachments. It does not expose microphone capture or dictation.
- `web/src/components/MemoEditor/components/EditorContent.tsx:12-54` handles drag-and-drop and paste for binary files only, and `web/src/components/MemoEditor/hooks/useFileUpload.ts:4-33` handles file-picker selection only.
- `web/src/components/MemoEditor/state/types.ts:8-30`, `web/src/components/MemoEditor/state/actions.ts:6-78`, and `web/src/components/MemoEditor/state/reducer.ts:4-130` track memo text, metadata, local files, and loading flags. There is no state for microphone permission, recording mode, partial transcript, cleanup review, or a pending audio blob.
- `web/src/components/MemoEditor/hooks/useAutoSave.ts:4-8` saves only the current `content` string to local storage. There is no draft persistence model for an in-progress voice session.
- `web/src/components/MemoEditor/services/validationService.ts:9-30` allows save when the draft has text, saved attachments, or local files, and `web/src/components/MemoEditor/services/uploadService.ts:8-26` uploads local files to `AttachmentService`. This means the existing save path can already persist an audio blob if one is present as a `LocalFile`.
- `web/src/components/MemoEditor/types/attachment.ts:4-28` classifies editor-side files only as `image`, `video`, or `document`, so an unsaved audio recording would currently fall into the generic document path in the editor draft surface.
- `web/src/utils/attachment.ts:15-38` recognizes `audio/*`, `web/src/components/MemoMetadata/Attachment/AttachmentListView.tsx:98-130` groups persisted attachments into visual/audio/docs sections, and `web/src/components/MemoMetadata/Attachment/AudioAttachmentItem.tsx:48-173` renders the dedicated audio playback card added by the last commit.
- `server/server.go:71-74` and `server/router/fileserver/fileserver.go:120-149,187-214` already treat video/audio attachments as native HTTP media streams once an attachment exists.
- `proto/api/v1/attachment_service.proto:48-90` and `server/router/api/v1/attachment_service.go:64-167` define binary attachment upload and metadata only. There is no transcription request/response shape, language hint, transcript cleanup option, or voice-session metadata in the API.
- `proto/api/v1/memo_service.proto:176-245` defines memo content as a single Markdown string plus optional attachments and relations. There is no separate speech transcript field or audio-note abstraction in the memo resource.
- `proto/api/v1/instance_service.proto:56-90` and `server/router/api/v1/instance_service.go:36-139` expose instance settings for `GENERAL`, `STORAGE`, `MEMO_RELATED`, `TAGS`, and `NOTIFICATION` only. There is no speech-provider or transcription-retention configuration surface.
- No existing implementation found for `getUserMedia`, `MediaRecorder`, browser speech recognition, or server-side transcription anywhere under `web/src`, `server`, `proto`, `plugin`, or `store`.

## Non-Goals

- Redesigning the current persisted audio attachment playback UI introduced in commit `63a17d89`.
- Building a full duplex spoken assistant or chatbot response loop inside Memos.
- Replacing the Markdown textarea editor with a different editor architecture.
- Shipping native desktop or mobile OS integrations such as global system-wide hotkeys.
- Redesigning attachment storage backends or the general file upload pipeline beyond voice-related usage.
- Adding broad AI rewrite/edit commands unrelated to capturing spoken memo text into the current draft.

## Open Questions

- Which client surfaces are in scope for the first rollout? (default: the existing React memo composer in the web app, including touch-friendly mobile-browser behavior)
- Is the first release a conversational voice mode or a dictation workflow? (default: dictation-first voice capture that inserts text into the current memo draft rather than opening a separate assistant session)
- Should Memos retain the raw recording after transcription? (default: no by default; keeping the recording is an explicit user choice that stores it as a normal attachment)
- Where does transcription execute? (default: behind a server-owned API so behavior, provider choice, and privacy copy are instance-controlled rather than browser-vendor specific)
- How much transcript cleanup is in scope? (default: punctuation plus limited filler/self-correction cleanup, with a review step before insertion)
- Does this issue include spoken edit commands such as “rewrite this shorter”? (default: no, only spoken text capture and insertion or replacement)

## Scope

**L** — The current gap spans the memo composer UI, editor state model, local file preview behavior, attachment save path, public API surface, and instance settings. There is no existing microphone or transcription implementation to extend, and a complete voice-input workflow would introduce both a new client interaction model and a new server contract rather than a single local edit.
