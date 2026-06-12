# MemoEditor Architecture

## Overview

MemoEditor uses a three-layer architecture for better separation of concerns and testability. It ships two editor implementations — a WYSIWYG rich-text editor (Tiptap/ProseMirror, the default) and a plain-text textarea — behind a single `EditorController` contract, so all layers above the editor boundary are mode-agnostic.

## Architecture

```
┌─────────────────────────────────────────┐
│   Presentation Layer (Components)       │
│   - EditorToolbar, EditorContent, etc.  │
└─────────────────┬───────────────────────┘
                  │ EditorController
┌─────────────────▼───────────────────────┐
│   State Layer (Reducer + Context)       │
│   - state/, useEditorContext()          │
│   - state.content  ← markdown (source  │
│     of truth for both editor modes)     │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│   Service Layer (Business Logic)        │
│   - services/ (pure functions)          │
└─────────────────────────────────────────┘
```

## Directory Structure

```
MemoEditor/
├── state/                  # State management (reducer, actions, context)
├── services/               # Business logic (pure functions)
├── components/             # UI components
│   ├── EditorContent.tsx   # Hosts the active editor; exposes mode-routing controller
│   ├── EditorToolbar.tsx   # Toolbar including the mode toggle button
│   └── ...
├── hooks/                  # React hooks (utilities)
│   ├── useMemoInit.ts      # Initializes editor content; load guard for WYSIWYG
│   └── ...
├── Editor/                 # Textarea (raw mode) implementation
│   ├── controllerAdapter.ts  # Adapts EditorRefActions → EditorController
│   ├── TagSuggestions.tsx    # # popup for raw mode
│   ├── SlashCommands.tsx     # / popup for raw mode
│   └── ...
├── TiptapEditor/           # Tiptap WYSIWYG implementation
│   ├── index.tsx             # Editor component; implements EditorController
│   ├── extensions.ts         # Canonical schema-relevant extension set (shared with codec)
│   ├── markdownCodec.ts      # Headless parse/serialize helpers (singleton editor)
│   ├── PreservedBlock.ts     # Byte-for-byte preservation of tables, math, raw HTML
│   ├── Tag.ts                # Memos #tag mark
│   ├── TagSuggestion.ts      # # popup for WYSIWYG mode
│   ├── SlashCommand.ts       # / popup for WYSIWYG mode
│   └── suggestionMenu.tsx    # Shared suggestion popup renderer (used by both above)
├── Toolbar/                # Toolbar sub-components (InsertMenu, VisibilitySelector)
├── editorMode.ts           # EditorMode type + localStorage persistence helpers
├── constants.ts
└── types/
    ├── editorController.ts # EditorController interface (the cross-mode contract)
    └── ...
```

## Key Concepts

### State Management

Uses `useReducer` + Context for predictable state transitions. All state changes go through action creators.

`state.content` holds the document as a **markdown string** and is the single source of truth for both editor modes. Each editor serializes its current content into the reducer on every change via `onContentChange`; neither editor reads content back from the other.

### Dual-mode editor

`types/editorController.ts` defines the `EditorController` interface — `focus`, `getMarkdown`, `setMarkdown`, `insertMarkdown`, formatting toggles, etc. — that callers outside an editor implementation must use exclusively.

- **WYSIWYG mode** (`TiptapEditor/`): Tiptap/ProseMirror rich-text editor. The default mode. Implements `EditorController` directly via `useImperativeHandle` in `TiptapEditor/index.tsx`.
- **Raw mode** (`Editor/`): plain textarea. `Editor/controllerAdapter.ts` adapts the textarea's imperative string-surgery API (`EditorRefActions`) to the same `EditorController` contract.

`components/EditorContent.tsx` hosts whichever implementation `state.ui.editorMode` selects and exposes a single mode-routing `EditorController` facade to the rest of the component tree via `forwardRef`.

### Mode toggle

The toolbar button in `EditorToolbar.tsx` dispatches `SET_EDITOR_MODE` and calls `setPreferredEditorMode` (from `editorMode.ts`) to persist the preference per device in `localStorage["memos-editor-mode"]`. WYSIWYG is the default when no preference is stored.

Mode switching is a markdown handoff: because both editors write into `state.content` on every keystroke, the incoming editor simply initializes from it — no content is ever pushed between editors directly.

### Markdown fidelity layer (TiptapEditor)

`TiptapEditor/extensions.ts` exports `buildExtensions()`, the canonical schema-relevant extension set. It is shared by the live editor and the headless `markdownCodec.ts` (parse/serialize/round-trip helpers over a singleton Tiptap instance) so parse and serialize behavior is identical in both contexts.

`PreservedBlock.ts` handles syntax the WYSIWYG editor does not model richly: tables, `$$math$$`, and raw HTML are captured at parse time with their raw markdown source, shown as editable monospace literal text, and re-emitted byte-for-byte on serialize.

`Tag.ts` models memos `#tags` as a `code: true` text mark, letting tags round-trip byte-identically even inside bold or heading spans.

### Suggestions

Both modes provide `#` tag and `/` slash-command suggestion popups, but they are implemented separately:

- WYSIWYG mode: `TiptapEditor/TagSuggestion.ts` and `TiptapEditor/SlashCommand.ts`, both using the shared `TiptapEditor/suggestionMenu.tsx` renderer.
- Raw mode: `Editor/TagSuggestions.tsx` and `Editor/SlashCommands.tsx`.

### Load guard

`hooks/useMemoInit.ts` runs a round-trip check on every existing memo when the editor opens. If the preferred mode is WYSIWYG and `isLosslessRoundTrip` (from `markdownCodec.ts`) returns false for the memo's content, the editor falls back to raw mode for that session only (preference is not changed) and shows a toast. This is a safety net; the corpus tests are designed to make it never fire in practice.

### Services

Pure TypeScript functions containing business logic. No React hooks, easy to test.

### Components

Thin presentation components that dispatch actions and render UI.

## Markdown fidelity contract

The round-trip corpus tests in `web/tests/markdown-roundtrip.test.ts`, backed by fixtures under `web/tests/fixtures/markdown-corpus/`, enforce two guarantees:

- **Supported syntax** (`supported/`): a parse → serialize → parse cycle produces an identical document tree (semantic equality; marker style may normalize).
- **Preserved syntax** (`preserved/`): tables, math, and raw HTML round-trip byte-for-byte.

## Usage

```typescript
import MemoEditor from "@/components/MemoEditor";

<MemoEditor
  memoName="memos/123"
  onConfirm={(name) => console.log('Saved:', name)}
  onCancel={() => console.log('Cancelled')}
/>
```

## Testing

Services are pure functions — easy to unit test without React.

```typescript
const state = mockEditorState();
const result = await memoService.save(state, { memoName: 'memos/123' });
```
