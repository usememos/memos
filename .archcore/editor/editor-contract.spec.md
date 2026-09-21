---
title: "Memo editor contract"
status: draft
tags:
  - "editor"
---

## Purpose & Scope
This spec defines the memo editor boundary in `@web/src/components/MemoEditor/`: its three layers, the markdown state, the `EditorController` and `FormattingController` contracts, the formatting catalog, the CodeMirror extension set, tag handling, and inline versus hosted presentation. Host components depend on it (Home composer, memo edit, comments, `@web/src/contexts/GlobalMemoEditorContext.tsx`), as do the editor's own toolbar and menus. Out of scope: read-only memo rendering and the tag grammar itself.

## Surface
- Layers: presentation (`components/`, `Toolbar/`) → `EditorController` → state (`state/`: `useEditorContext`, `useEditorSelector` in `@web/src/components/MemoEditor/state/context.tsx`) → services (`services/`).
- Editor: CodeMirror 6 "decorated source" editor in `@web/src/components/MemoEditor/Editor/`; markers such as `#`, `*`, `` ` ``, bullets, and fences stay visible but de-emphasized.
- Contracts: `EditorController`, `FormattingController` in `@web/src/components/MemoEditor/types/editorController.ts`; implementations in `Editor/controller.ts` and `Editor/formatting.ts`.
- Upload anchors: `createUploadAnchor`, `updateUploadAnchor`, `resolveUploadAnchor`, `cancelUploadAnchor`, backed by `@web/src/components/MemoEditor/Editor/uploadAnchors.ts`.
- Formatting catalog: `EDITOR_COMMANDS`, `EditorCommandId`, `ActiveFormatState`, `isCommandActive` in `@web/src/components/MemoEditor/formatting/commands.ts`.
- Extensions: `buildEditorExtensions()` in `@web/src/components/MemoEditor/Editor/extensions.ts` — `@codemirror/lang-markdown` with GFM, line wrapping, a reconfigurable placeholder, the theme, `#tag`/`@mention` decorations, `#tag` autocomplete, and an `onChange` update listener.
- Formatting keys: `Mod-B`/`Mod-I` bold/italic, `Mod-Shift-S` strikethrough, `Mod-E` inline code, `Mod-Alt-C` code block, `Mod-Alt-0` paragraph, `Mod-Alt-1`–`3` headings, `Mod-Shift-7`–`9` ordered, bullet, and task lists.
- Theme: `@web/src/components/MemoEditor/Editor/theme.ts` (`HighlightStyle` over Lezer markdown tags plus `EditorView.theme`).
- Tags: shared scanner `@web/src/utils/tag-grammar.ts`; adapters `Editor/markdownTagRanges.ts`, `Editor/tagMentionDecorations.ts`, `Editor/tagAutocomplete.ts`, and `@web/src/utils/remark-plugins/remark-tag.ts`.
- Presentation props: `onFocusModeExit` and `EditorViewToggles` (`viewToggles`) in `@web/src/components/MemoEditor/types/components.ts`.
- Lifecycle hooks: `@web/src/components/MemoEditor/hooks/useMemoSave.ts`, `@web/src/components/MemoEditor/hooks/useFocusMode.ts`.

## Normative Behavior
1. The editor MUST store the memo as raw markdown verbatim, with no parse or serialize round-trip.
2. Every component above the editor boundary MUST exchange markdown through the `EditorController` contract.
3. The reducer in `state/reducer.ts` MUST drive an external store, not a `useReducer` in the provider.
4. Each consumer MUST subscribe only to the slice it reads through `useEditorSelector`.
5. Each state change MUST go through an action creator.
6. `state.content` MUST hold the document as a markdown string and be the single source of truth.
7. `state.content` MUST equal the editor document exactly, with no encoding or normalization step.
8. Callers outside the editor implementation MUST use `EditorController` exclusively.
9. Callers outside the editor implementation MUST NOT reach into CodeMirror internals.
10. `getMarkdown` MUST return `view.state.doc.toString()`.
11. WHEN `setMarkdown` is called, the controller MUST replace the whole document.
12. WHEN `insertMarkdown` is called, the controller MUST block-pad the insertion so it lands as its own block.
13. WHILE an attachment uploads, its upload anchor MUST hold a place in the document and show the upload progress.
14. WHEN `resolveUploadAnchor` receives markdown, the controller MUST replace the anchor with it, block-padded like `insertMarkdown`.
15. `FormattingController` MUST expose `run(commandId, ctx?)`, `getActiveFormats()`, and `subscribe(listener)` to the focus-mode `FormattingToolbar`.
16. `Editor/formatting.ts` MUST apply inline marks (`**`, `*`) and single-backtick code by editing the markdown source directly.
17. `Editor/formatting.ts` MUST apply line prefixes `- `, `1. `, `- [ ] ` and ATX heading prefixes by editing the markdown source.
18. `Editor/formatting.ts` MUST read active formats from the Lezer syntax tree at the caret.
19. The formatting catalog MUST hold metadata only (i18n label keys, icons, grouping), with no dependency on a concrete editor.
20. The toolbar and the active-state highlighting MUST derive their commands from the formatting catalog.
21. WHEN a formatting verb is added, the contributor MUST add one catalog entry and its `ActiveFormatState` field.
22. WHEN the document changes, the update listener MUST push the markdown to the reducer through `onChange`.
23. WHEN the user presses `Meta-Enter` or `Ctrl-Enter`, the editor MUST call `onSubmit`.
24. The submit keys MUST be bound explicitly, not through `Mod-`, so both work on every platform.
25. The submit keys MUST precede `defaultKeymap`'s `Mod-Enter` (`insertBlankLine`) so saving never also edits the document.
26. The app formatting keymap MUST precede CodeMirror's `defaultKeymap`.
27. The editor MUST keep CodeMirror's Markdown keymap enabled for structural `Enter` and `Backspace`.
28. WHEN files are pasted, the editor MUST add them to the attachment list without writing into the text.
29. WHEN files are dropped, the editor MUST insert images inline at the drop point and attach the other files.
30. WHEN pasted or dropped content is plain markdown text, the editor MUST leave its handling to CodeMirror.
31. The editor theme MUST take its colors from CSS custom properties, so light and dark themes apply without extra code.
32. Tag autocomplete, tag decoration, and read-only tag rendering MUST use the shared scanner in `@/utils/tag-grammar`.
33. `markdownTagRanges.ts` MUST exclude links, code, math, raw HTML syntax, escapes, and entities before calling the scanner.
34. `tagMentionDecorations.ts` MUST decorate the tag matches returned by that adapter and keep mention recognition separate.
35. `tagAutocomplete.ts` MUST scan raw input at the cursor and offer known tags from `useTagCounts`, including inside code, links, and escapes.
36. WHEN the user types a bare `#`, autocomplete MUST offer all tags, except at an opening heading marker.
37. At an opening heading marker, manual completion MUST still offer tags.
38. Autocomplete MUST match nested paths by prefix, path segment, or substring, including an unfinished child after `/`.
39. Code in `services/` MUST contain no React hooks.
40. WHILE `onFocusModeExit` is omitted, the editor MUST sit in page flow and own its presentation (inline).
41. WHILE inline, the ＋ menu MUST offer the view toggles: focus mode, and the formatting-toolbar preference for the normal layout.
42. WHILE inline in focus mode, the formatting toolbar's trailing button MUST minimize the editor back in place.
43. WHILE `onFocusModeExit` is supplied (hosted), the editor MUST mount straight into focus mode and force the formatting toolbar on.
44. WHILE hosted, the trailing button MUST read Close and exit by calling `onFocusModeExit` to dismiss the host.
45. WHILE hosted, the ＋ menu MUST NOT show the view toggles.
46. The view toggles MUST travel as one optional `viewToggles` object from `EditorToolbar` to `InsertMenu`, so they appear or disappear together.
47. `useMemoSave` MUST coordinate validation, persistence, query invalidation, and post-save reducer state outside the editor shell.
48. `useFocusMode` MUST own focus mode's DOM lifecycle, restore the previous body scroll style, and keep the editor's place in grid layouts.
49. Presentation components MUST stay thin: they dispatch actions and render UI.

## Constraints & Invariants
- Invariant: one editor and one storage format (markdown).
- Constraint: content changes on every keystroke; one context value would re-render toolbar, insert menu, and metadata per keystroke, so subscriptions are per slice.
- Invariant: the editor theme styles only the editor; the read-only memo view uses `@/lib/markdownStyles`.
- Invariant: a paste carries no placement gesture, so pasted files never enter the text.

## Failure Behavior
1. IF an upload fails, THEN its anchor MUST keep its place and show the failure message with retry and keep actions.
2. IF `resolveUploadAnchor` receives empty markdown, THEN the controller MUST cancel the anchor, as `cancelUploadAnchor` does.

## Conformance
An implementation conforms when it meets behaviors 1–49, holds the invariants, and follows the failure rules.
Given an empty inline composer,
When the user drops an image at a text position,
Then the image is placed inline at that position, not in the attachment list.
