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
│   State Layer (reducer over an external │
│   store; per-slice subscriptions)       │
│   - state/, useEditorContext(),         │
│     useEditorSelector()                 │
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
├── index.tsx               # The shell: EditorProvider + MemoEditorImpl
├── loader.ts               # loadMemoEditor(): the shared lazy-load entry point
├── state/                  # State management (reducer, actions, context)
├── services/               # Business logic (pure functions)
├── components/             # UI components
│   ├── EditorContent.tsx   # Hosts Editor; forwards its EditorController ref
│   ├── EditorMetadata.tsx  # Attachment strip below the document
│   └── ...
├── hooks/                  # React hooks (utilities)
│   ├── useMemoSave.ts      # Save transaction, cache invalidation, and reset
│   └── useFocusMode.ts     # Scroll lock and layout-stable focus presentation
├── Editor/                 # The CodeMirror 6 decorated-source editor
│   ├── index.tsx               # React wrapper: mounts the EditorView, owns the
│   │                           #   controller refs, syncs initialContent in/out
│   ├── extensions.ts           # buildEditorExtensions(): assembles the CM extension set
│   ├── theme.ts                # Syntax-highlight style + editor theme (CSS-var colors)
│   ├── tagMentionDecorations.ts# ViewPlugin that decorates #tag / @mention spans
│   ├── markdownTagRanges.ts    # Markdown syntax-tree adapter for the shared tag scanner
│   ├── tagAutocomplete.ts      # CM autocompletion source for #tag
│   ├── uploadAnchors.ts        # Widget decorations holding a slot per in-flight upload
│   ├── formatting.ts           # FormattingController impl (toggle marks, headings, lists)
│   ├── controller.ts           # EditorController impl over an EditorView
│   └── ...                     # Heading/list/viewport decorations, editor.css
├── formatting/
│   └── commands.ts         # Backend-agnostic catalog of formatting verbs
├── Toolbar/                # EditorToolbar, FormattingToolbar, InsertMenu, VisibilitySelector
├── constants.ts
└── types/                  # EditorController / FormattingController, component props,
                            #   attachment and insert-menu types
```

## Key Concepts

### State Management

A reducer (`state/reducer.ts`) drives an **external store**, not a `useReducer` in the provider, and consumers subscribe to just the slice they read via `useEditorSelector` (`useSyncExternalStore` under the hood). Content changes on every keystroke, so routing it through a single context value would re-render every consumer — toolbar, insert menu, metadata — per keystroke; with per-slice subscriptions only the components whose slice actually changed re-render. All state changes still go through action creators.

`state.content` holds the document as a **markdown string** and is the single source of truth. Because the editor stores markdown verbatim, `state.content` is exactly the editor's document — there is no encoding or normalization step.

### The editor contract

`types/editorController.ts` defines `EditorController` — document access (`getMarkdown`, `setMarkdown`, `insertMarkdown`), cursor and focus (`focus`, `hasFocus`, `isEmpty`, `getCursor`, `setCursor`, `scrollToCursor`, `selectAll`), the upload-anchor group below, plus an optional `formatting` capability. Callers outside the editor implementation use this interface exclusively and never reach into CodeMirror internals.

`Editor/controller.ts` implements `EditorController` over a CodeMirror `EditorView`: `getMarkdown` is just `view.state.doc.toString()`, `setMarkdown` replaces the whole document, and `insertMarkdown` block-pads the insertion so it lands as its own block.

`createUploadAnchor`/`updateUploadAnchor`/`resolveUploadAnchor`/`cancelUploadAnchor` drive `Editor/uploadAnchors.ts`, a `StateField` of widget decorations that hold a place in the document while an attachment uploads and carry its progress, failure message, and retry/keep affordances. `resolveUploadAnchor` replaces the anchor with the finished markdown (block-padded the same way `insertMarkdown` is); resolving with empty markdown cancels instead, as does `cancelUploadAnchor`.

`FormattingController` (same file in `types/`) is the rich-formatting surface the focus-mode `FormattingToolbar` drives: `run(commandId, ctx?)`, `getActiveFormats()`, and `subscribe(listener)`. `Editor/formatting.ts` implements it by editing the markdown source directly — toggling inline marks (`**` and `*`) and single-backtick code delimiters, line prefixes (`-`, `1.`, and `- [ ]`, each followed by a space), and ATX heading prefixes (`#`…) — and by reading active state from the Lezer syntax tree at the caret.

### Formatting command catalog

`formatting/commands.ts` is the single, editor-agnostic catalog of formatting verbs (`EDITOR_COMMANDS`, `EditorCommandId`, `ActiveFormatState`, `isCommandActive`). It is metadata only — labels (i18n keys), icons, and grouping — with no dependency on any concrete editor. The toolbar and the active-state highlighting derive everything from this catalog; `Editor/formatting.ts` supplies how each verb is applied to the live CodeMirror document. To add a verb, add one entry here (and its field on `ActiveFormatState`).

### Editor extensions

`Editor/extensions.ts` exports `buildEditorExtensions()`, which composes the CodeMirror extension set: `@codemirror/lang-markdown` (with GFM), line wrapping, a reconfigurable placeholder, the editor theme, the `#tag`/`@mention` decoration plugin, the `#tag` autocomplete, and an update listener that pushes document changes back to the reducer via `onChange`. It also binds the save shortcut: `Meta-Enter` and `Ctrl-Enter` both call `onSubmit`, bound explicitly rather than through the platform-dependent `Mod-` so either works everywhere, and ordered ahead of `defaultKeymap`'s own `Mod-Enter` (`insertBlankLine`) so saving never also edits the document. Native CodeMirror paste/drop handlers intercept file payloads before its text insertion behavior and pass them to the attachment layer; ordinary markdown text paste/drop remains CodeMirror-owned.

`Editor/theme.ts` defines the decorated-source look: a `HighlightStyle` over the Lezer markdown highlight tags (headings, strong, emphasis, code, links, quotes, markers) and an `EditorView.theme`. Colors come from CSS custom properties so light/dark themes just work. This is the editor's own styling — the read-only memo view styles itself separately via `@/lib/markdownStyles`.

### Tags and mentions

`#tag` autocomplete, decoration, and read-only rendering all use the shared scanner in `@/utils/tag-grammar`. The scanner owns tag syntax and Unicode/emoji recognition; each surface supplies only its Markdown context:

- `Editor/markdownTagRanges.ts` adapts the CodeMirror syntax tree into literal-source ranges, excluding links, code, math, raw HTML syntax, escapes, and entities before calling the shared scanner.
- `Editor/tagMentionDecorations.ts` decorates the tag matches returned by that adapter; mention recognition remains separate.
- `Editor/tagAutocomplete.ts` reuses the same adapter for the tag ending at the cursor and offers known tags from `useTagCounts`.
- `@/utils/remark-plugins/remark-tag` is the read-only renderer's Markdown AST adapter to the same scanner.

### Services

Pure TypeScript functions containing business logic. No React hooks, easy to test.

### Presentation: inline vs hosted

Every instance is one of two things, and `onFocusModeExit` is the switch:

- **Inline** (prop omitted) — the editor sits in page flow (Home composer, memo edit, comments) and owns its presentation. The ＋ menu offers the view toggles: focus mode expands the editor over the page and the formatting toolbar's trailing button minimizes it back in place, while the formatting-toolbar preference governs the normal-mode layout.
- **Hosted** (prop supplied) — a host presents the editor full-screen and owns that frame; `contexts/GlobalMemoEditorContext.tsx` is the one today. The editor mounts straight into focus mode and exits by calling back to dismiss the host, so the formatting toolbar's trailing button reads as Close rather than minimize. The ＋ menu's view toggles are absent: focus mode is not the editor's to leave, and it already forces the formatting toolbar on.

Those toggles travel as a single optional `viewToggles` object (`types/components.ts`) down `EditorToolbar` → `InsertMenu`, so they can only appear or disappear together.

### Lifecycle hooks

Cross-cutting React workflows stay outside the editor shell. `useMemoSave`
coordinates validation, persistence, query invalidation, and post-save reducer
state. `useFocusMode` owns focus mode's DOM lifecycle, including restoring the
previous body scroll style and preserving the editor's place in grid layouts.

### Components

Thin presentation components that dispatch actions and render UI.

## Usage

```typescript
import MemoEditor from "@/components/MemoEditor";

// Create mode: omit `memo`. Pass an existing Memo to edit it instead.
<MemoEditor
  cacheKey="home-composer"
  onConfirm={(name) => console.log('Saved:', name)}
  onCancel={() => console.log('Cancelled')}
/>
```

## Testing

Services are pure functions — easy to unit test without React.

```typescript
const state = createInitialState(); // from state/types.ts
const result = await memoService.save(state, { memoName: 'memos/123' });
```
