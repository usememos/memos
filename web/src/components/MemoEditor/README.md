# MemoEditor Architecture

## Overview

MemoEditor is a three-layer component. At its core is a single editor — `Editor/`, a CodeMirror 6 "decorated source" editor. It stores the memo as **raw markdown, verbatim** (no parse/serialize round-trip) and styles that source in place with CodeMirror decorations: the markers (`#`, `*`, `` ` ``, list bullets, fences) stay visible but de-emphasized while the styled text leads. There is one editor and one storage format; everything above the editor boundary talks markdown through the `EditorController` contract.

## Architecture

> Moved to [`.archcore/editor/editor-contract.spec.md`](../../../../.archcore/editor/editor-contract.spec.md).

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

> Moved to [`.archcore/editor/editor-contract.spec.md`](../../../../.archcore/editor/editor-contract.spec.md).

### The editor contract

> Moved to [`.archcore/editor/editor-contract.spec.md`](../../../../.archcore/editor/editor-contract.spec.md).

### Formatting command catalog

> Moved to [`.archcore/editor/editor-contract.spec.md`](../../../../.archcore/editor/editor-contract.spec.md).

### Editor extensions

> Moved to [`.archcore/editor/editor-contract.spec.md`](../../../../.archcore/editor/editor-contract.spec.md).

### Tags and mentions

> Moved to [`.archcore/editor/editor-contract.spec.md`](../../../../.archcore/editor/editor-contract.spec.md).

### Services

> Moved to [`.archcore/editor/editor-contract.spec.md`](../../../../.archcore/editor/editor-contract.spec.md).

Pure TypeScript functions containing business logic. No React hooks, easy to test.

### Presentation: inline vs hosted

> Moved to [`.archcore/editor/editor-contract.spec.md`](../../../../.archcore/editor/editor-contract.spec.md).

- **Hosted** (prop supplied) — a host presents the editor full-screen and owns that frame; `contexts/GlobalMemoEditorContext.tsx` is the one today. The editor mounts straight into focus mode and exits by calling back to dismiss the host, so the formatting toolbar's trailing button reads as Close rather than minimize. The ＋ menu's view toggles are absent: focus mode is not the editor's to leave, and it already forces the formatting toolbar on.

### Lifecycle hooks

> Moved to [`.archcore/editor/editor-contract.spec.md`](../../../../.archcore/editor/editor-contract.spec.md).

### Components

> Moved to [`.archcore/editor/editor-contract.spec.md`](../../../../.archcore/editor/editor-contract.spec.md).

## Usage

> Moved to [`.archcore/editor/editor-development.guide.md`](../../../../.archcore/editor/editor-development.guide.md).

## Testing

> Moved to [`.archcore/editor/editor-development.guide.md`](../../../../.archcore/editor/editor-development.guide.md).

Services are pure functions — easy to unit test without React.
