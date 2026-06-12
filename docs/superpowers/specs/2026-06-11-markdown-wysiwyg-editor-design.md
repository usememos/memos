# Markdown WYSIWYG Editor — Design

**Date:** 2026-06-11
**Status:** Approved pending user review

## Goal

Replace the plain `<textarea>` memo editor with a modern WYSIWYG editor that renders
markdown syntax live as the user types (Linear / Claude.ai composer style) while keeping
markdown — not HTML — as the only storage and API format. A toggle lets users drop back
to the raw textarea editor at any time.

## Background

The current editor (`web/src/components/MemoEditor/Editor/index.tsx`) is a textarea with
hand-rolled features layered on top: tag suggestions (`#`), slash commands (`/`),
Ctrl+B/I markdown shortcuts, list auto-continuation, URL-paste-to-link, IME composition
plumbing, auto-grow height, and a toolbar that inserts raw markdown strings through an
imperative, character-offset-based `EditorRefActions` API.

Live markdown editing is among the most-requested memos features
(usememos/memos#2216, #3495, #766, #4259).

### Prior art (researched 2026-06)

- **Linear** builds its editor directly on **ProseMirror** (+ y-prosemirror for collab).
- **ChatGPT's composer** is raw **ProseMirror**.
- **Claude.ai's composer** is **Tiptap** (headless framework on ProseMirror).

All three references are ProseMirror-family WYSIWYG editors with markdown input rules.

### Library options considered

| Option | Verdict |
|---|---|
| **Tiptap v3 + `@tiptap/markdown`** | **Chosen.** Claude.ai's stack. Best ecosystem; StarterKit covers the core set with input rules; Suggestion utility replaces hand-rolled tag/slash popups; official bidirectional markdown (early release — gated by a spike). First-class React bindings; best-in-class IME handling via ProseMirror. ~100 KB gzipped. |
| Milkdown | Markdown-first ProseMirror + remark; strongest fidelity by design, but thin UX building blocks, small community, low bus factor. |
| Raw ProseMirror + prosemirror-markdown | Linear's literal approach; maximum control, most engineering effort for the least product difference. |
| Lexical | Non-ProseMirror engine; markdown is a conversion target, historically weaker IME. |
| CodeMirror 6 live-preview (Obsidian style) | Perfect byte fidelity but a different UX than the named references; largely DIY. |

## Decisions (user-confirmed)

1. **Raw mode stays**: a per-editor toggle switches between WYSIWYG and the current
   textarea editor. (Revised from an earlier "full replacement" decision.)
2. **Fidelity contract**: lossless for supported syntax — semantic round-trip for
   everything the editor models; style normalization (e.g. `*` → `-` bullets) is
   acceptable. Unknown/exotic syntax is preserved verbatim, never dropped.
3. **v1 scope — Linear-style core set** rendered live: bold/italic/strike/inline-code,
   headings, ordered/unordered/task lists, links, blockquotes, code blocks, and memos
   `#tags`. Tables, `$…$`/`$$…$$` math, and inline HTML remain literal text in the
   editor (they still render richly in the memo view after save). Mermaid lives in
   ` ```mermaid ` fences, so it is just a code block while editing.

## Architecture

### Editor abstraction

`EditorContent` hosts one of two implementations behind a shared **`EditorController`**
interface:

- `focus()`, `getMarkdown()`, `setMarkdown()`, `insertMarkdown()`, `isEmpty()`
- Formatting **intents**: `toggleBold()`, `toggleItalic()`, `toggleTaskList()`, etc.

The **Tiptap editor** implements intents as ProseMirror commands. The **textarea editor**
implements them exactly as today (wrap selection in `**`). The toolbar dispatches intents
and never knows which editor is mounted. The textarea's existing string-surgery API
(`EditorRefActions`) becomes internal to the textarea implementation rather than the
public contract.

### Mode toggle

- A small icon button in the editor toolbar switches modes mid-edit.
- Switching is a markdown string handoff: WYSIWYG → raw serializes (the same path as
  save, so no new fidelity risk); raw → WYSIWYG parses.
- The preference persists in localStorage (per device). No backend/proto changes; can
  graduate to a server-side user setting later.

### Tiptap editor composition

Built on `@tiptap/react` `useEditor`. Extensions:

- **StarterKit** (configured): headings, bold/italic/strike/code, lists, blockquote,
  code block — all with live input rules (`**bold**` converts as you type).
- **TaskList / TaskItem**, **Link** (includes URL-paste-over-selection → link),
  **Placeholder** (i18n'd), **`@tiptap/markdown`**.
- **`Tag`** (custom): inline node for `#tag`, rendered as a styled token, serialized
  back to `#tag` verbatim. `#` triggers a Suggestion-plugin popup backed by the
  existing tag store.
- **`SlashCommand`** (custom): Suggestion-plugin popup on `/`, replacing
  `SlashCommands.tsx` in WYSIWYG mode.
- **`PreservedBlock`** (custom): the fidelity workhorse — unmodeled constructs
  (tables, math, inline HTML, unrecognized syntax) are captured at parse time into
  nodes carrying their raw source, displayed as literal text (subtle mono styling),
  and re-emitted byte-for-byte on serialize.

Hand-rolled textarea features that become native or config in WYSIWYG mode:
Ctrl+B/I keymaps (StarterKit), list auto-continuation (ProseMirror lists),
auto-grow height (contenteditable), IME composition (ProseMirror — better CJK
behavior than the textarea plumbing).

### Data flow

Unchanged at the boundaries. Memo markdown → `setMarkdown()` on load. On update,
serialized markdown (debounced) flows into the existing state reducer as
`state.content`, so auto-save, the localStorage draft cache (still a plain markdown
string), tag extraction, and the save path are untouched. The backend only ever sees
markdown. File paste/drag wires Tiptap `handlePaste`/`handleDrop` into the existing
`uploadService`.

## Fidelity contract

1. **Supported constructs** round-trip semantically; list-marker style may normalize;
   content never changes meaning.
2. **Unmodeled constructs** round-trip byte-for-byte via `PreservedBlock`.
3. **A round-trip corpus test enforces this permanently** (see Testing). It is written
   first, as a spike, and is the go/no-go gate on `@tiptap/markdown` (early release).
   If the gate fails and custom Marked tokenizers cannot fix it, the fallback is
   swapping only the parse/serialize layer to remark (already a memos dependency)
   while keeping the Tiptap editor — editor and serialization are deliberately
   decoupled for this reason.

## Error handling

- **Load guard (tripwire):** on opening an existing memo, parse → re-serialize →
  compare semantically. If the round-trip would lose content, log it and show a
  notice — "this memo contains syntax the editor can't safely edit" — with a
  one-click switch to raw mode for that memo. Expected never to fire.
- **Draft safety:** the localStorage draft cache stays a markdown string on the same
  debounce as today; drafts are interchangeable between both editor modes.
- **Save path:** reuses already-serialized `state.content`; save never triggers a
  fresh parse, so it gains no new failure mode.

## Testing

- **Round-trip corpus test (the spike, written first):** fixture markdown files
  (GFM, tables, math, mermaid, inline HTML, nested lists, CJK, emoji) → parse →
  serialize → assert semantic equality for supported syntax, byte equality for
  preserved blocks. Runs in the existing vitest/jsdom setup.
- **Extension unit tests:** `Tag` (parse/serialize/suggestion trigger),
  `PreservedBlock` (verbatim round-trip), link-paste.
- **Component tests** (@testing-library): toolbar intents produce expected markdown
  in both modes; slash/tag popups open and insert correctly; mode toggle hands
  content across without loss.
- **Manual QA:** CJK IME composition, mobile Safari/Chrome soft keyboards, focus
  mode, paste-image upload.

## Rollout

Feature branch, PR series:

1. **Spike:** corpus test + `@tiptap/markdown` verdict (throwaway if the gate fails).
2. **Core editor:** Tiptap behind `EditorController`, StarterKit set, markdown in/out,
   wired into the state layer.
3. **Memos features:** `Tag` + suggestions, `SlashCommand`, `PreservedBlock`,
   file paste/drop, toolbar intent conversion.
4. **Toggle + refactor:** mode toggle UI and persistence; textarea editor refactored
   to implement `EditorController` (nothing deleted — it powers raw mode).

Dependency cost: ~100 KB gzipped (`@tiptap/core`, `@tiptap/react`, extensions,
`@tiptap/markdown` + MarkedJS). WYSIWYG is the default mode for all users.

## Out of scope (v1)

- Interactive table editing, live KaTeX/mermaid rendering while editing.
- Collaborative editing (Yjs).
- Server-side persistence of the mode preference.
- Mobile apps (web/PWA only — native apps are separate codebases).
