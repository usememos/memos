# MemoEditor Architecture

## Overview

MemoEditor is a three-layer component. At its core is a single editor — `Editor/`, built on [`@usememos/editor`](https://github.com/usememos/editor), a block editor whose storage format is standard Markdown. Markdown goes in and comes out: blocks the user did not edit are saved byte for byte, and edited blocks are written in a normalized style. The memo view (`components/MemoContent`) is the same editor, read-only, so a memo looks the same while editing and after saving. Everything above the editor boundary talks markdown through the `EditorController` contract.

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
├── Editor/                 # The composer, on @usememos/editor
│   ├── index.tsx               # React wrapper around <MarkdownEditor>; hands out the controller
│   ├── extensions.ts           # buildEditorExtensions(): memo syntax, #tag autocomplete, file paste/drop
│   ├── uploadAnchors.ts        # Widget rendering for in-flight upload placeholders
│   ├── controller.ts           # EditorController over the editor
│   └── editor.css              # Composer sizing and upload-anchor styles
├── Toolbar/                # EditorToolbar, InsertMenu, AudienceMenu
├── constants.ts
└── types/                  # EditorController, component props,
                            #   attachment and insert-menu types
```

## Key Concepts

### State Management

A reducer (`state/reducer.ts`) drives an **external store**, not a `useReducer` in the provider, and consumers subscribe to just the slice they read via `useEditorSelector` (`useSyncExternalStore` under the hood). Content changes on every keystroke, so routing it through a single context value would re-render every consumer — toolbar, insert menu, metadata — per keystroke; with per-slice subscriptions only the components whose slice actually changed re-render. All state changes still go through action creators.

`state.content` holds the document as a **markdown string** and is the single source of truth. Because the editor stores markdown verbatim, `state.content` is exactly the editor's document — there is no encoding or normalization step.

### The editor contract

`types/editorController.ts` defines `EditorController` — document access (`getMarkdown`, `setMarkdown`, `insertMarkdown`), selection and focus (`focus`, `hasFocus`, `isEmpty`, `getSelection`, `setSelection`, `selectAll`), the upload-anchor group below, and `toggleTaskList`. Callers outside the editor implementation use this interface exclusively and never reach into the editor's own API.

`Editor/controller.ts` implements `EditorController` over the editor instance. Every method reads the live editor when called, so calls before mount or after destroy do nothing. `insertMarkdown` inserts after the caret's block (or in place of an empty paragraph) without consuming selected text. Selections are the editor's `SelectionJSON` (block index and offset), which survives remounting the same Markdown, so `cacheService` can restore the caret.

`createUploadAnchor`/`updateUploadAnchor`/`resolveUploadAnchor`/`cancelUploadAnchor` drive editor widgets (`editor.addWidget`) that hold a place after a block while an attachment uploads and carry its progress, failure message, and retry/keep affordances. Widgets are never saved and are not part of undo history. `resolveUploadAnchor` inserts the finished markdown after the widget's block; resolving with empty markdown cancels instead, as does `cancelUploadAnchor`.

### Formatting

Formatting is the editor's own: its toolbar appears over selected text (bold, italic, strikethrough, code, link), the slash menu and Markdown shortcuts change block types, and its keys cover the rest. Memos adds no formatting toolbar. The one formatting call memos makes itself is `toggleTaskList()`, for the checklist suggestion chip.

### Editor extensions

`lib/memo-markdown.ts` holds what the composer and the memo view share: the memo Markdown dialect (`breaks: true`, `setext: false`); `memoExtensions()` (math rendered with KaTeX loaded on demand, footnotes, `#tags` and `@mentions`, code highlighted with highlight.js, ```` ```mermaid ```` diagrams, and raw HTML through the sanitizer in `lib/sanitized-html.ts`); the URL policy for links and images (`memoResolveUrl`); the theme in the app's CSS variables; the translated UI labels; and the tag and mention collectors. Whatever the editor renders shows its source at the caret while editing.

`Editor/extensions.ts` adds what only the composer needs: the `#tag` autocomplete (`suggestion()` with `matchToken(scanTags)`, so the popup opens exactly where tags are highlighted; not inside code or links, and not for a bare `#` at the start of a line, which may be a heading) with items from `useTagCounts`, and a `fileHandler()`: pasted files join the attachment list, dropped images are inserted inline where they land and other dropped files are attached.

Keys are the editor's own (see its README): Mod+B/I/E, Mod+Shift+S, Mod+Alt+0–3, Mod+Alt+C, Mod+Shift+7–9, Tab/Shift+Tab, and Mod+Enter / Ctrl+Enter to save. The first Escape selects the caret's block; a second Escape leaves the editor.

### Tags and mentions

Highlighting, autocomplete, `EditorController.getTags()` and the memo view all use the editor's scanners (`scanTags`, `scanMentions`), which skip code, links, images and extension tokens, so what is highlighted is what counts. `extractMentionUsernames` in `lib/memo-markdown.ts` reads mentions the same way to decide which users to resolve.

### Services

Pure TypeScript functions containing business logic. No React hooks, easy to test.

### Suggestions

Hosts of a new top-level memo (Home, the global composer) pass `useMemoSuggestions()`
into the `suggestions` prop; edits and comments omit the bar. `lib/memo-suggestions.ts`
merges typed candidates from providers and keeps the strongest source per id
(selection, then search, then the selected View). `lib/suggestion-expression.ts` is a
small Boolean CEL reader shared by the providers; unsupported syntax never falls back
to scanning free text.

- Tags: explicit tag conditions and selected tags. `insertTag()` is one isolated undo
  step at the caret that keeps selected text and honors the current Markdown context.
- Checklist: task-list conditions in saved Views or filters; a negative
  task-list or incomplete-task condition suppresses it.
- Visibility: exactly one explicit audience across filters and View, otherwise nothing.
  Space visibility also requires actual Space placement.

`EditorSuggestions` hides until the draft has text, drops suggestions already satisfied
(via the Markdown-aware `getTags()` / `hasChecklist()`, so code examples do not count)
or already accepted, and shows at most three across kinds. Acceptance history lives in
the editor store so Undo or reverting a choice does not immediately resuggest it, and it
clears with the draft on reset; nothing is persisted with the memo. `SuggestionsBar` is
payload-agnostic; a new kind extends the `MemoSuggestion` union and its
eligibility/application in `EditorSuggestions`.

### Presentation: inline vs hosted

Every instance is one of two things, and `onFocusModeExit` is the switch:

- **Inline** (prop omitted) — the editor sits in page flow (Home composer, memo edit, comments) and owns its presentation. The ＋ menu offers focus mode, which expands the editor over the page; the exit button in its top row minimizes it back in place.
- **Hosted** (prop supplied) — a host presents the editor full-screen and owns that frame; `contexts/GlobalMemoEditorContext.tsx` is the one today. The editor mounts straight into focus mode and exits by calling back to dismiss the host, so the exit button reads as Close rather than minimize. The ＋ menu's view toggle is absent: focus mode is not the editor's to leave.

The toggle travels as an optional `viewToggles` object (`types/components.ts`) down `EditorToolbar` → `InsertMenu`.

### Destination and visibility

`AudienceMenu` is one dropdown for a memo's visibility and, where allowed, its Space. Visibility options come first; the Space is an optional row below them that never names the empty state: it reads "Add to space" until one is chosen, then shows the Space, and the selected Space in its submenu toggles back off (a check at rest, an ✕ under the pointer or keyboard, always an ✕ on touch). New top-level memos and edits of top-level memos the user can manage offer the row; a host-provided `defaultSpace` fixes a new memo's placement, and comments never offer it because their Space is the parent's. The destination lives in editor metadata: it is sent on creation, and an edit that changes it sends `space` and `visibility` together so the server can validate the move as one transition. Clearing a Space-only audience resets it to Private; adding a Space never changes the audience. Drafts retain destination and visibility alongside content, attachments, and location. Long names are truncated, with their full text retained for accessible labels and hover titles. Moving a memo between Spaces happens here; there is no separate move dialog.

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
