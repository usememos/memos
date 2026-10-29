# MemoEditor

## Overview

`MemoEditor` is the one way a memo is shown, edited or composed. It is memo-aware: it takes a memo's resource name, or a seed for a new memo or comment, and a mode. In view mode it reads the memo from whatever query already holds it and shows it read-only. In edit mode it owns a draft store and renders the editing session over it. The parent owns the mode and hears back through `onConfirm` and `onCancel`.

Both modes show the memo through the same binding of [`@usememos/editor`](https://github.com/usememos/editor), a block editor whose storage format is standard Markdown, so a memo looks the same while editing and after saving. Blocks the user did not edit are saved byte for byte; edited blocks are written in a normalized style.

```tsx
<MemoEditor name="memos/abc" />                                     // view; the owner can tick tasks
<MemoEditor mode="edit" name="memos/abc" onConfirm onCancel />      // edit in place
<MemoEditor draft={{ parent: "memos/abc" }} onConfirm onCancel />   // new comment
<MemoEditor draft={{ scope: "home", space, createTime }} />         // new memo
```

## Layers

```
MemoEditor                 memo level: name | draft seed, mode, data, draft store, mutations
├── MemoContentView        the read-only surface: navigation, anchors, link cards, search highlight
│   └── MemoMarkdown       the editor binding: dialect, theme, labels, URL policy, memo syntax, decorations
└── EditSession            the editing surface: chrome, uploads, audio, suggestions, save
    └── Editor             MemoMarkdown editable, with the composer's extensions, behind EditorController
```

- **`MemoMarkdown.tsx`** binds the editor to memos once: the memo Markdown dialect, the theme in the app's CSS variables, translated labels, the image and link URL policy, the memo syntax extensions (math, footnotes, tags, mentions, highlighted code, Mermaid diagrams drawn by Pele), raw HTML through the editor's `sanitizeHtml` option (`memoSanitizeHtml`: DOMPurify with memos' allowlist in `lib/html-sanitize-schema.ts`, trusted iframe hosts, and link and image defaults; loaded on first use) and the stylesheet. `useMemoDecorations` is the one flow for tag colors and resolved mentions, with one redecorate effect. Everything a surface adds sits around this component; nothing in memos styles the editor's own classes. The tag and mention classes memos hands the editor apply in source mode too, so the parts that draw a pill take the `rich:` variant (index.css), which is everything outside the editor's `.mbe-source-mode` root; source mode shows a tag as text in its color.
- **`view/`** is the read-only surface over `MemoMarkdown`: tags and mentions navigate, in-memo anchors scroll, a paragraph that is one bare link becomes a preview card through the editor's block view (`linkCards.ts`), the page's search matches are painted, and heading ids match the outline. Tag and mention clicks arrive through the editor's `onClick` callbacks, so nothing in memos matches the editor's class names or mutates its DOM. Previews that have Markdown but no memo query (the link-memo search, the share image) use `MemoContentView` directly.
- **`edit/`** is the editing surface: `EditSession` renders the chrome (timestamp, attachments, suggestions, toolbar, focus mode, audio recording) over the draft store `MemoEditor` provides, persists the draft while open, and saves through the memo mutations. `Editor.tsx` is the composer's editor: `MemoMarkdown` editable with the composer's own extensions (`#tag` and `:emoji` autocomplete, file paste and drop), behind the `EditorController` contract in `controller.ts`.

Code blocks use lazy-loaded `@pierre/highlights` tokens as editor decorations, without an HTML conversion. GitHub Light and GitHub Dark Dimmed colors follow the document's color scheme; ordinary text and structural punctuation keep the editor's text color. Unsupported languages, unavailable WebAssembly, or browsers without `light-dark()` colors leave the code as plain text. Highlighting never changes the saved Markdown.

## Data

- **Reads are by name.** `useMemoByName` (`hooks/useMemoQueries.ts`) returns the freshest copy of the memo any query holds (a list, a comment page, the calendar month, a detail, a shared memo) and fetches the detail only when nothing holds it. A card in a list therefore costs no request beyond the list's, follows the list's refetches, and never refetches on its own.
- **Writes are mutations.** A ticked task, a save and a new memo go through `useUpdateMemo` and `useCreateMemo`, which patch and refresh every query holding the memo, so the saved text shows wherever the memo is on the page as soon as the server answers.
- **The draft is UI state keyed by identity.** `edit/draftKey.ts` derives the key from what is edited: `edit:<name>`, `comment:<parent>`, `new:<scope>[:<space>]`. `initialEditorState` computes the store's first state once, from the memo or the persisted draft over the host's defaults; `useAutoSave` persists it while the session is open; an edit of an existing memo persists no draft. A new identity is a new session (`key`).

## The editing session

### State

A reducer (`edit/state/reducer.ts`) drives an external store; consumers subscribe to one slice via `useEditorSelector`, so typing re-renders only what reads `content`. `state.content` is the document as Markdown and the single source of truth. UI flags (focus mode, loading, pending inline images), metadata (visibility, Space, attachments, relations, location), timestamps, local files awaiting upload and accepted suggestions live beside it.

### The editor contract

`edit/types/editorController.ts` defines `EditorController`: document access (`getMarkdown`, `setMarkdown`, `insertMarkdown`), selection and focus, the upload-anchor group, `getTags`, `hasChecklist`, `insertTag` and `toggleTaskList`. The chrome uses this interface and never reaches into the editor's own API. `edit/controller.ts` implements it over the live editor; calls before mount or after destroy do nothing.

### Formatting and source mode

Formatting is the editor's own: its toolbar appears over selected text, the slash menu and Markdown shortcuts change block types, and its keys cover the rest. The editor's `mode` option shows the whole memo as Markdown text, with its syntax highlighted, and edits it as text; `useSourceMode` remembers the choice per device. To people it is "Markdown mode", the ＋ menu's item with the code glyph (Lucide `CodeXml`), checked while on; in code it keeps the editor's name, source mode. A small, noninteractive `Markdown` label sits inside the composer's top-right corner while source mode is on. Switching changes no text and emits no change. In source mode the toolbar, slash menu, block handle and link card do not show; the `#tag` and `:emoji` popups open as in rich mode, the formatting keys edit the Markdown, and the checklist chip toggles the task marker on the caret's line through the same `toggleTaskList` command. The controller reads tags and checklists from the text parsed as a memo. The source text is in the body font (the editor's `sourceFont` token is left at its default) so a switch keeps the text's rhythm; nothing in memos targets the editor's source classes.

### Saving

`useMemoSave` validates the draft, uploads local files, and hands the save to `memoService.save` with the operations it runs: the server's current copy (fetched into the detail cache to diff against), `useUpdateMemo` and `useCreateMemo`. Hosts that close after saving (edit, comment) hold a brief "Saved" confirmation before the session resets; the in-place composer resets at once. Uploads that landed before a failed save stay on the draft as attachments so a retry does not upload them again.

### Suggestions

Hosts of a new top-level memo pass `useMemoSuggestions()` into `suggestions`; edits and comments show none. `EditorSuggestions` hides until the draft has text, drops suggestions already satisfied or accepted, and shows at most three. Acceptance history lives in the store so Undo does not immediately resuggest, and clears with the draft.

### Presentation: in a card, inline, hosted

- **In a card** (`frameless`): the card is the frame, so the session has no background, border or padding of its own outside focus mode. `MemoView` flips its body into the session by name and keeps its header, frame and reactions mounted.
- **Inline** (Home, panels): the session brings its own frame. The ＋ menu offers focus mode, which expands it over the page; the exit button minimizes it back.
- **Hosted** (`onFocusModeExit`): a host presents the session full-screen and owns that frame (`contexts/GlobalMemoEditorContext.tsx`). It mounts straight into focus mode and exits by calling back to dismiss the host.

Focus mode is a sheet narrower than the page (`max-w-3xl`): its header, text and footer share one left edge, and the text is set larger (`MEMO_FOCUS_EDITOR_THEME`). Its header row shows only the memo's time on the left, as `TimestampPopover`: the time control once the memo has one (an edit, or a new memo dated from the calendar), otherwise "Now" in the viewer's language. The button that leaves the frame is on the right.

The session's code is a chunk of its own, loaded when a memo is first edited or composed, and renders without suspending once loaded. A host that knows an editor is coming calls `preloadMemoEditing()`: the router loads it with the Home page for a signed-in user, so the composer renders with the page, and the comment section loads it while the pointer is on its button. Until it is loaded a new draft shows a still of the empty composer, the same frame, placeholder line and toolbar height, so nothing moves when the session takes its place.

### Destination and visibility

`AudienceMenu` is one dropdown for a memo's visibility and, where allowed, its Space. New top-level memos and edits of top-level memos the user can manage offer the Space row; a draft seed's `space` fixes a new memo's placement; comments never offer it because their Space is their parent's. An edit that changes the Space sends `space` and `visibility` together so the server validates the move as one transition.

## Directory structure

```
MemoEditor/
├── index.ts                # MemoEditor, preloadMemoEditing, prop types
├── MemoEditor.tsx          # The memo-level component: modes, data, draft store, lazy session
├── MemoMarkdown.tsx        # The editor binding
├── useMemoDecorations.ts   # Tag colors and resolved mentions, one redecorate
├── view/                   # Read-only surface: MemoContentView, linkCards, headings, navigation, search highlight
└── edit/                   # Editing surface
    ├── EditSession.tsx         # The chrome over the draft store
    ├── Editor.tsx              # MemoMarkdown editable + composer extensions + controller
    ├── controller.ts, extensions.ts, uploadAnchors.ts, editor.css
    ├── draftKey.ts             # Identity → draft key, legacy migration
    ├── initialState.ts         # The store's first state, from the memo or the draft
    ├── state/, services/, hooks/, components/, Toolbar/, types/, utils/
    └── constants.ts
```

## Testing

- `tests/memo-record.test.tsx`: reads by name, freshness, optimistic patches, the comment mutations.
- `tests/memo-editor-view.test.tsx`: view mode by name, task ticking through the mutation.
- `tests/memo-content-view.test.tsx`, `tests/editor.test.tsx`: the surfaces over the binding.
- `tests/use-memo-init.test.tsx`, `tests/draft-key.test.ts`, `tests/use-auto-save.test.tsx`: drafts and keys.
- `tests/use-memo-save.test.tsx`, `tests/memo-editor-*.test.ts*`: the session and its save path. Tests that mount the session call `await preloadMemoEditing()` first so it renders without suspending.
