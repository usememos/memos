# MemoEditor Architecture

## Overview

MemoEditor is a three-layer component. At its core is a single editor — `Editor/`, a CodeMirror 6 "decorated source" editor. It stores the memo as **raw markdown, verbatim** (no parse/serialize round-trip) and styles that source in place with CodeMirror decorations: the markers (`#`, `*`, `` ` ``, list bullets, fences) stay visible but de-emphasized while the styled text leads. There is one editor and one storage format; everything above the editor boundary talks markdown through the `EditorController` contract.

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
│   - state.content  ← markdown (the      │
│     single source of truth)             │
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
│   ├── EditorContent.tsx   # Hosts Editor; forwards its EditorController ref
│   ├── EditorToolbar.tsx   # Toolbar
│   └── ...
├── hooks/                  # React hooks (utilities)
├── Editor/           # The CodeMirror 6 decorated-source editor
│   ├── index.tsx               # React wrapper: mounts the EditorView, owns the
│   │                           #   controller refs, syncs initialContent in/out
│   ├── extensions.ts           # buildEditorExtensions(): assembles the CM extension set
│   ├── theme.ts                # Syntax-highlight style + editor theme (CSS-var colors)
│   ├── tagMentionDecorations.ts# ViewPlugin that decorates #tag / @mention spans
│   ├── tagAutocomplete.ts      # CM autocompletion source for #tag
│   ├── formatting.ts           # FormattingController impl (toggle marks, headings, lists)
│   └── controller.ts           # EditorController impl over an EditorView
├── formatting/
│   └── commands.ts         # Backend-agnostic catalog of formatting verbs
├── Toolbar/                # Toolbar sub-components (InsertMenu, VisibilitySelector)
├── constants.ts
└── types/
    └── editorController.ts # EditorController / FormattingController interfaces
```

## Key Concepts

### State Management

Uses `useReducer` + Context for predictable state transitions. All state changes go through action creators.

`state.content` holds the document as a **markdown string** and is the single source of truth. Because the editor stores markdown verbatim, `state.content` is exactly the editor's document — there is no encoding or normalization step.

### The editor contract

`types/editorController.ts` defines `EditorController` — `focus`, `getMarkdown`, `setMarkdown`, `insertMarkdown`, `selectAll`, `scrollToCursor`, plus an optional `formatting` capability. Callers outside the editor implementation use this interface exclusively and never reach into CodeMirror internals.

`Editor/controller.ts` implements `EditorController` over a CodeMirror `EditorView`: `getMarkdown` is just `view.state.doc.toString()`, `setMarkdown` replaces the whole document, and `insertMarkdown` block-pads the insertion so it lands as its own block.

`FormattingController` (same file in `types/`) is the rich-formatting surface the focus-mode `FormattingToolbar` drives: `run(commandId, ctx?)`, `getActiveFormats()`, `getSelectedText()`, and `subscribe(listener)`. `Editor/formatting.ts` implements it by editing the markdown source directly — toggling inline marks (`**`/`*`/`` ` ``), line prefixes (`- `, `1. `, `- [ ] `), and ATX heading prefixes (`#`…) — and by reading active state from the Lezer syntax tree at the caret.

### Formatting command catalog

`formatting/commands.ts` is the single, editor-agnostic catalog of formatting verbs (`EDITOR_COMMANDS`, `EditorCommandId`, `ActiveFormatState`, `isCommandActive`). It is metadata only — labels (i18n keys), icons, and grouping — with no dependency on any concrete editor. The toolbar and the active-state highlighting derive everything from this catalog; `Editor/formatting.ts` supplies how each verb is applied to the live CodeMirror document. To add a verb, add one entry here (and its field on `ActiveFormatState`).

### Editor extensions

`Editor/extensions.ts` exports `buildEditorExtensions()`, which composes the CodeMirror extension set: `@codemirror/lang-markdown` (with GFM), line wrapping, a placeholder, the editor theme, the `#tag`/`@mention` decoration plugin, the `#tag` autocomplete, and an update listener that pushes document changes back to the reducer via `onChange`.

`Editor/theme.ts` defines the decorated-source look: a `HighlightStyle` over the Lezer markdown highlight tags (headings, strong, emphasis, code, links, quotes, markers) and an `EditorView.theme`. Colors come from CSS custom properties so light/dark themes just work. This is the editor's own styling — the read-only memo view styles itself separately via `@/lib/markdownStyles`.

### Tags and mentions

`#tag` autocomplete and `#tag`/`@mention` decoration both reuse the shared grammar so the editor can't drift from the rest of the app:

- `Editor/tagMentionDecorations.ts` is a `ViewPlugin` that scans the visible ranges and adds `cm-memo-tag` / `cm-memo-mention` marks, matching against `TAG_RUN` (`@/utils/tag-grammar`) and `MENTION_RUN` (`@/utils/mention-grammar`).
- `Editor/tagAutocomplete.ts` is a CodeMirror autocompletion source for `#tag`, matching the in-progress token with `TAG_CHAR_CLASS` (`@/utils/tag-grammar`) and offering known tags (from `useTagCounts`).

### Services

Pure TypeScript functions containing business logic. No React hooks, easy to test.

### Components

Thin presentation components that dispatch actions and render UI.

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
