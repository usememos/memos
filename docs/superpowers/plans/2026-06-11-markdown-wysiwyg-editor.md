# Markdown WYSIWYG Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain `<textarea>` memo editor with a Tiptap-based WYSIWYG editor that renders markdown live while keeping markdown as the only storage format, with a per-device toggle back to the raw textarea editor.

**Architecture:** Both editors sit behind a shared `EditorController` interface hosted by `EditorContent`. The Tiptap editor uses the official `@tiptap/markdown` extension (Tiptap 3.26) for bidirectional markdown; custom `Tag`, `PreservedBlock`/`PreservedInline`, `TagSuggestion`, and `SlashCommand` extensions cover memos-specific features and fidelity. Unmodeled syntax (tables, math, raw HTML) is preserved byte-for-byte. A round-trip corpus test is written first as the go/no-go spike gate.

**Tech Stack:** React 19, Tiptap 3.26 (`@tiptap/core`, `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-list`, `@tiptap/extensions`, `@tiptap/suggestion`, `@tiptap/markdown` + marked 17), vitest + jsdom + @testing-library/react, Tailwind 4.

---

## Context for the implementer (read first)

- All web code lives in `web/`. Run commands from `/Users/steven/Projects/usememos/memos/web` unless stated otherwise. Package manager is **pnpm**.
- Tests live in `web/tests/*.test.{ts,tsx}` (NOT colocated with src), run by `pnpm test` (vitest, jsdom, setup file `web/tests/setup.ts`). Path alias `@/` → `web/src/`.
- Lint/typecheck: `pnpm lint` (runs `tsc --noEmit` + biome). Auto-fix style: `pnpm lint:fix`.
- The current textarea editor is `web/src/components/MemoEditor/Editor/index.tsx`, exposing an imperative `EditorRefActions` API. It stays — it powers raw mode. **Do not delete it or its sub-features** (`TagSuggestions.tsx`, `SlashCommands.tsx`, `useSuggestions.ts`, `useListCompletion.ts`, `shortcuts.ts`, `commands.ts`).
- Editor state flows through a reducer context (`web/src/components/MemoEditor/state/`). `state.content` is the markdown string; auto-save drafts (`useAutoSave`), validation, and save (`memoService.save`) all read it. The backend only ever sees markdown.
- Verified API facts (Tiptap 3.26.0, inspected from published sources — do not re-derive):
  - `@tiptap/markdown` exports `Markdown` (an Extension). It adds `editor.getMarkdown(): string`, `editor.markdown.parse(md): JSONContent`, and a `contentType: "markdown"` option to `new Editor()`, `setContent`, `insertContent`, `insertContentAt`.
  - Extensions declare markdown behavior via top-level config fields (typed in `@tiptap/core`): `markdownTokenName` (marked token type to handle), `parseMarkdown: (token, helpers) => JSONContent | JSONContent[] | null`, `renderMarkdown: (node, helpers, context) => string`, and `markdownTokenizer: { name, level: "inline" | "block", start, tokenize }` (a marked tokenizer extension; **custom tokenizers run before marked's built-ins**).
  - `parseMarkdown` helpers include `createNode(type, attrs?, content?)`, `createTextNode(text, marks?)`, `parseInline(tokens)`, `parseChildren(tokens)`.
  - The `Document` extension joins top-level blocks with `\n\n`; block renderers return their content **without** trailing separators (e.g. CodeBlock returns ` ```lang\n…\n``` `).
  - Nodes/marks with `code: true` skip the serializer's markdown escaping and HTML-entity encoding for their inner text — this is what makes verbatim preservation work.
  - Inline `html` tokens are handled internally by the markdown manager **before** the handler registry (recognized tags like `<em>` get converted to marks — a fidelity violation for us), so inline HTML preservation must use a custom inline *tokenizer* that captures tags before marked's built-in html tokenizer. Block-level `html` tokens DO consult the registry first, so a plain `parseMarkdown` handler works for them.
  - StarterKit v3 already includes: Bold, Italic, Strike, Code, CodeBlock, Heading, BulletList/OrderedList/ListItem/ListKeymap, Blockquote, Link (with `linkOnPaste: true` default — URL-paste-over-selection → link), Underline, HardBreak, HorizontalRule, Dropcursor, Gapcursor, UndoRedo, TrailingNode. All ship with markdown input rules and parse/render specs.
  - `TaskList`/`TaskItem` are exported from `@tiptap/extension-list`. `Placeholder` is exported from `@tiptap/extensions`. `Suggestion` is the default and a named export of `@tiptap/suggestion`.
- **Deliberate deviation from the spec:** the spec says serialized markdown flows to the reducer "debounced". We serialize on every `update` event instead — serialization is cheap at memo scale, and synchronous `state.content` keeps the save path, draft cache, and mode-toggle handoff race-free. Revisit only if profiling shows cost.
- Conventional commits, matching repo style: `feat(web): …`, `fix(web): …`, `test(web): …`.

## File structure

New files:

| File | Responsibility |
|---|---|
| `web/src/components/MemoEditor/types/editorController.ts` | The shared `EditorController` interface |
| `web/src/components/MemoEditor/Editor/controllerAdapter.ts` | Adapts textarea `EditorRefActions` → `EditorController` |
| `web/src/components/MemoEditor/TiptapEditor/extensions.ts` | Canonical schema extension list (`buildExtensions()`) |
| `web/src/components/MemoEditor/TiptapEditor/markdownCodec.ts` | Headless parse/serialize/round-trip helpers (tests + load guard) |
| `web/src/components/MemoEditor/TiptapEditor/PreservedBlock.ts` | Fidelity workhorse: preserved block node, preserved inline mark, parse bridges for table/html/math |
| `web/src/components/MemoEditor/TiptapEditor/Tag.ts` | Inline `#tag` atom node with tokenizer + input rule |
| `web/src/components/MemoEditor/TiptapEditor/suggestionMenu.tsx` | Shared popup component + Suggestion-plugin renderer factory |
| `web/src/components/MemoEditor/TiptapEditor/TagSuggestion.ts` | `#` suggestion popup extension |
| `web/src/components/MemoEditor/TiptapEditor/SlashCommand.ts` | `/` command popup extension |
| `web/src/components/MemoEditor/TiptapEditor/index.tsx` | The Tiptap editor React component (implements `EditorController`) |
| `web/src/components/MemoEditor/editorMode.ts` | localStorage mode preference helpers |
| `web/tests/fixtures/markdown-corpus/supported/*.md` | Round-trip fixtures: semantic equality group |
| `web/tests/fixtures/markdown-corpus/preserved/*.md` | Round-trip fixtures: byte equality group |

Modified files: `web/src/components/MemoEditor/Editor/shortcuts.ts` (export `toggleTextStyle`), `state/types.ts` + `state/actions.ts` + `state/reducer.ts` + `state/context.tsx` (editor mode), `components/EditorContent.tsx` (dual host), `components/EditorToolbar.tsx` (toggle button), `hooks/useKeyboard.ts` + `hooks/useMemoInit.ts` + `index.tsx` (switch to `EditorController`), `web/src/locales/en.json` (new strings), `web/src/index.css` (task-list/placeholder styles), `web/package.json`.

---

### Task 1: Branch + dependencies

**Files:**
- Modify: `web/package.json` (via pnpm)

- [ ] **Step 1: Create the feature branch** (skip if already on an isolated worktree created for this plan)

```bash
cd /Users/steven/Projects/usememos/memos
git checkout -b feat/wysiwyg-editor
```

- [ ] **Step 2: Install Tiptap packages**

```bash
cd /Users/steven/Projects/usememos/memos/web
pnpm add @tiptap/core@3.26.0 @tiptap/pm@3.26.0 @tiptap/react@3.26.0 @tiptap/starter-kit@3.26.0 @tiptap/extension-list@3.26.0 @tiptap/extensions@3.26.0 @tiptap/suggestion@3.26.0 @tiptap/markdown@3.26.0 marked@^17.0.1
```

Expected: pnpm resolves and writes to `package.json`/`pnpm-lock.yaml` without peer-dependency errors (`@tiptap/pm` is the peer of `@tiptap/markdown`).

- [ ] **Step 3: Verify the toolchain still passes**

```bash
pnpm lint && pnpm test
```

Expected: PASS (no source changes yet).

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat(web): add tiptap 3.26 dependencies for wysiwyg editor"
```

---

### Task 2: Spike — markdown codec + round-trip corpus test (GO/NO-GO gate)

This is the spike from the spec's fidelity contract. It must be done first. If, after honest effort at configuration/custom tokenizers, the **supported-syntax** corpus cannot pass, **STOP and report**: the fallback decision (swap only the parse/serialize layer to remark, keeping the Tiptap editor) is a human decision, not something to improvise mid-plan.

**Files:**
- Create: `web/src/components/MemoEditor/TiptapEditor/extensions.ts`
- Create: `web/src/components/MemoEditor/TiptapEditor/markdownCodec.ts`
- Create: `web/tests/fixtures/markdown-corpus/supported/` (7 fixture files below)
- Test: `web/tests/markdown-roundtrip.test.ts`

- [ ] **Step 1: Create the corpus fixtures**

`web/tests/fixtures/markdown-corpus/supported/basic.md`:

````markdown
# Hello memos

Some **bold**, *italic*, ~~struck~~, and `inline code` text.

> A blockquote with **bold** inside.

A [link](https://example.com/docs) in a sentence.
````

`web/tests/fixtures/markdown-corpus/supported/headings.md`:

````markdown
# H1

## H2

### H3

#### H4

##### H5

###### H6

Body under headings.
````

`web/tests/fixtures/markdown-corpus/supported/lists.md`:

````markdown
- alpha
- beta
  - nested one
  - nested two
- gamma

1. first
2. second
   1. second-a
   2. second-b
3. third
````

`web/tests/fixtures/markdown-corpus/supported/task-lists.md`:

````markdown
- [ ] open task
- [x] done task
- [ ] task with **bold** text

Regular paragraph between.

- [ ] another list
  - [x] nested done
````

`web/tests/fixtures/markdown-corpus/supported/code-blocks.md`:

`````markdown
Some text first.

```go
func main() {
	fmt.Println("hello *not italic* #not-a-tag")
}
```

```mermaid
graph TD;
  A-->B;
```

```
no language fence
```
`````

`web/tests/fixtures/markdown-corpus/supported/cjk-emoji.md`:

````markdown
# 日本語の見出し

これは**太字**と*斜体*のテストです。改行も確認します。

- 中文列表项
- 한국어 항목
- emoji 🎉 in a list 🚀

> 引用文です 😀
````

`web/tests/fixtures/markdown-corpus/supported/blockquote-mixed.md`:

````markdown
> Outer quote line one.
> Still the same quote.

Paragraph after.

> - a list in a quote
> - second item
````

- [ ] **Step 2: Write the failing round-trip test**

`web/tests/markdown-roundtrip.test.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseMarkdown, roundTripMarkdown } from "@/components/MemoEditor/TiptapEditor/markdownCodec";

const CORPUS_DIR = join(__dirname, "fixtures", "markdown-corpus");

function fixtures(group: string): Array<[name: string, source: string]> {
  const dir = join(CORPUS_DIR, group);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => [f, readFileSync(join(dir, f), "utf8")]);
}

// Fidelity contract part 1: supported constructs round-trip semantically.
// "Semantic" = the parsed document tree is identical before and after a
// serialize cycle; marker style (e.g. `*` vs `-` bullets) may normalize.
describe("markdown round-trip corpus: supported syntax (semantic equality)", () => {
  for (const [name, source] of fixtures("supported")) {
    it(`${name}: parse → serialize → parse is identity`, () => {
      const serialized = roundTripMarkdown(source);
      expect(parseMarkdown(serialized)).toEqual(parseMarkdown(source));
    });

    it(`${name}: serialization is idempotent`, () => {
      const once = roundTripMarkdown(source);
      expect(roundTripMarkdown(once)).toBe(once);
    });
  }
});
```

- [ ] **Step 3: Run it to verify it fails for the right reason**

```bash
pnpm test -- markdown-roundtrip
```

Expected: FAIL with "Failed to resolve import …/markdownCodec" (module doesn't exist yet).

- [ ] **Step 4: Implement the extension list and the codec**

`web/src/components/MemoEditor/TiptapEditor/extensions.ts`:

```ts
import type { AnyExtension } from "@tiptap/core";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";

/**
 * The canonical schema-relevant extension set, shared by the live editor and
 * the headless markdown codec so that parse/serialize behavior is identical
 * in both. UI-only extensions (Placeholder, suggestion popups) are added by
 * the editor component on top of this list and must never affect the schema.
 */
export function buildExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      link: { openOnClick: false },
      // Markdown has no underline syntax; keeping the extension would let
      // Ctrl+U create marks that cannot serialize. Out of the schema entirely.
      underline: false,
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Markdown,
  ];
}
```

`web/src/components/MemoEditor/TiptapEditor/markdownCodec.ts`:

```ts
import { Editor, type JSONContent } from "@tiptap/core";
import { buildExtensions } from "./extensions";

/**
 * Headless markdown ⇄ ProseMirror document helpers built on the exact same
 * extension list as the live editor. Used by the round-trip corpus tests and
 * the memo-open load guard.
 */
function withEditor<T>(markdown: string, fn: (editor: Editor) => T): T {
  const editor = new Editor({
    extensions: buildExtensions(),
    content: markdown,
    contentType: "markdown",
  });
  try {
    return fn(editor);
  } finally {
    editor.destroy();
  }
}

export function parseMarkdown(markdown: string): JSONContent {
  return withEditor(markdown, (editor) => editor.getJSON());
}

export function roundTripMarkdown(markdown: string): string {
  return withEditor(markdown, (editor) => editor.getMarkdown());
}

/** True when a serialize cycle would not change the document's meaning. */
export function isLosslessRoundTrip(markdown: string): boolean {
  try {
    const once = parseMarkdown(markdown);
    const twice = parseMarkdown(roundTripMarkdown(markdown));
    return JSON.stringify(once) === JSON.stringify(twice);
  } catch {
    return false;
  }
}
```

- [ ] **Step 5: Run the corpus test — this is the gate**

```bash
pnpm test -- markdown-roundtrip
```

Expected: PASS (14 tests: 7 fixtures × 2 assertions).

Troubleshooting, in order:
1. `new Editor()` throws about a missing element in jsdom → pass `element: document.createElement("div")` in `withEditor`.
2. A specific fixture fails semantic equality → diff the two JSON trees (`console.log(JSON.stringify(parseMarkdown(src), null, 2))`), then fix via StarterKit configuration or (only if config can't) a small custom `parseMarkdown`/`renderMarkdown` override on the offending extension via `.extend()` in `extensions.ts`. Document each override with a comment naming the fixture that needs it.
3. Idempotence fails but semantic equality passes → acceptable only if the second pass output equals the third (stable after one normalization); in that case change the idempotence assertion to compare pass 2 vs pass 3 and leave a comment explaining the one-time normalization. Otherwise treat as a real bug.
4. **If supported-syntax failures cannot be fixed at all → STOP. Report NO-GO** with the failing fixtures and diffs. Do not proceed to Task 3.

- [ ] **Step 6: Commit**

```bash
cd /Users/steven/Projects/usememos/memos
git add web/src/components/MemoEditor/TiptapEditor web/tests
git commit -m "test(web): add markdown round-trip corpus spike for tiptap codec"
```

---

### Task 3: PreservedBlock / PreservedInline — byte-for-byte fidelity for unmodeled syntax

Tables, `$…$`/`$$…$$` math, and raw HTML are out of the v1 editing scope but must survive an edit session byte-for-byte. Block constructs become an editable literal-text block node (`preservedBlock`, mono styling, `code: true` so nothing inside is escaped); inline constructs become plain text carrying a `preservedInline` mark (`code: true` likewise). Marked "bridge" extensions route the relevant tokens into them at parse time.

**Files:**
- Create: `web/src/components/MemoEditor/TiptapEditor/PreservedBlock.ts`
- Modify: `web/src/components/MemoEditor/TiptapEditor/extensions.ts`
- Create: `web/tests/fixtures/markdown-corpus/preserved/` (5 fixtures)
- Test: `web/tests/tiptap-preserved.test.ts`, extend `web/tests/markdown-roundtrip.test.ts`

- [ ] **Step 1: Create the preserved-corpus fixtures**

IMPORTANT authoring constraint: these files are asserted **byte-equal** (trimmed) after a round trip, so they must contain *only* preserved constructs plus plain prose that no serializer pass would rewrite — no `*`, `_`, `` ` ``, `[`, `]`, `~`, `\` characters outside the preserved spans, no list markers, no headings.

`web/tests/fixtures/markdown-corpus/preserved/table.md`:

````markdown
| Name | Role |
| --- | --- |
| Ada | Engineer |
| Grace | Admiral |
````

`web/tests/fixtures/markdown-corpus/preserved/math-block.md`:

````markdown
Before the math.

$$
E = mc^2 \cdot \frac{1}{\sqrt{1 - v^2/c^2}}
$$

After the math.
````

`web/tests/fixtures/markdown-corpus/preserved/math-inline.md`:

````markdown
Energy is $E=mc^2$ and the index is $x_1$ in this sentence.
````

`web/tests/fixtures/markdown-corpus/preserved/inline-html.md`:

````markdown
Use <em>emphasis</em> and a line<br>break and <span class="x">spans</span> here.
````

`web/tests/fixtures/markdown-corpus/preserved/block-html.md`:

````markdown
Paragraph before.

<div class="custom">
  <p>Raw HTML block content</p>
</div>

Paragraph after.
````

- [ ] **Step 2: Extend the corpus test with the byte-equality group**

Append to `web/tests/markdown-roundtrip.test.ts`:

```ts
// Fidelity contract part 2: unmodeled constructs round-trip byte-for-byte.
// Fixtures in preserved/ contain only preserved constructs + inert prose,
// so the entire file must survive a round trip unchanged (modulo outer trim).
describe("markdown round-trip corpus: preserved syntax (byte equality)", () => {
  for (const [name, source] of fixtures("preserved")) {
    it(`${name}: round-trips byte-for-byte`, () => {
      expect(roundTripMarkdown(source).trim()).toBe(source.trim());
    });

    it(`${name}: serialization is idempotent`, () => {
      const once = roundTripMarkdown(source);
      expect(roundTripMarkdown(once)).toBe(once);
    });
  }
});
```

- [ ] **Step 3: Write the unit test for the preservation nodes**

`web/tests/tiptap-preserved.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseMarkdown, roundTripMarkdown } from "@/components/MemoEditor/TiptapEditor/markdownCodec";

function blockTypes(markdown: string): string[] {
  return (parseMarkdown(markdown).content ?? []).map((node) => node.type ?? "");
}

describe("PreservedBlock", () => {
  it("captures a table as a single preservedBlock node", () => {
    const md = "| a | b |\n| --- | --- |\n| 1 | 2 |";
    expect(blockTypes(md)).toEqual(["preservedBlock"]);
  });

  it("captures block math as preservedBlock", () => {
    const md = "$$\nx^2\n$$";
    expect(blockTypes(md)).toEqual(["preservedBlock"]);
  });

  it("captures block HTML as preservedBlock", () => {
    const md = "<div>\nhello\n</div>";
    expect(blockTypes(md)).toEqual(["preservedBlock"]);
  });
});

describe("PreservedInline", () => {
  it("keeps inline math verbatim — underscores must not get escaped", () => {
    expect(roundTripMarkdown("index $x_1$ here").trim()).toBe("index $x_1$ here");
  });

  it("keeps inline HTML tags literal instead of converting them to marks", () => {
    expect(roundTripMarkdown("an <em>emphasis</em> tag").trim()).toBe("an <em>emphasis</em> tag");
  });

  it("does not swallow autolinks", () => {
    const doc = parseMarkdown("see <https://example.com> now");
    const para = doc.content?.[0];
    const hasLinkMark = (para?.content ?? []).some((n) => (n.marks ?? []).some((m) => m.type === "link"));
    expect(hasLinkMark).toBe(true);
  });
});
```

- [ ] **Step 4: Run both tests to verify they fail**

```bash
pnpm test -- tiptap-preserved markdown-roundtrip
```

Expected: the new preserved/byte-equality and unit tests FAIL (e.g. table parsed via fallback, `$x_1$` re-serialized as `$x\_1$`); the supported group still PASSES.

- [ ] **Step 5: Implement the preservation extensions**

`web/src/components/MemoEditor/TiptapEditor/PreservedBlock.ts`:

```ts
import { Extension, Mark, Node, mergeAttributes } from "@tiptap/core";
import type { MarkdownParseHelpers, MarkdownToken } from "@tiptap/core";

/**
 * Fidelity workhorse for syntax the WYSIWYG editor does not model (tables,
 * math, raw HTML). Constructs are captured at parse time with their raw
 * markdown source, shown as editable literal mono text, and re-emitted
 * byte-for-byte on serialize. `code: true` keeps the serializer from
 * escaping/entity-encoding the inner text.
 */
export const PreservedBlock = Node.create({
  name: "preservedBlock",
  group: "block",
  content: "text*",
  marks: "",
  code: true,
  defining: true,

  parseHTML() {
    return [{ tag: "pre[data-preserved-block]", preserveWhitespace: "full" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "pre",
      mergeAttributes(HTMLAttributes, {
        "data-preserved-block": "",
        class: "font-mono text-sm opacity-80 whitespace-pre-wrap my-0",
      }),
      0,
    ];
  },

  // The literal source is the node's text; Document joins blocks with \n\n.
  renderMarkdown: (node, helpers) => (node.content ? helpers.renderChildren(node.content) : ""),
});

/** Inline counterpart: a `code: true` mark that emits its text verbatim. */
export const PreservedInline = Mark.create({
  name: "preservedInline",
  code: true,

  parseHTML() {
    return [{ tag: "span[data-preserved-inline]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-preserved-inline": "", class: "font-mono opacity-80" }), 0];
  },

  // No delimiters: the preserved text already contains its own syntax.
  renderMarkdown: (node, helpers) => (node.content ? helpers.renderChildren(node.content) : ""),
});

function preservedBlockFromToken(token: MarkdownToken, helpers: MarkdownParseHelpers) {
  const source = (token.raw ?? "").replace(/\n+$/, "");
  if (!source) {
    return null;
  }
  return helpers.createNode("preservedBlock", {}, [helpers.createTextNode(source)]);
}

/** Routes marked's `table` tokens into preservedBlock instead of dropping them. */
export const PreservedTableBridge = Extension.create({
  name: "preservedTableBridge",
  markdownTokenName: "table",
  parseMarkdown: preservedBlockFromToken,
});

/**
 * Routes block-level raw HTML into preservedBlock. Inline HTML never reaches
 * the handler registry (the markdown manager intercepts it and would convert
 * recognized tags like <em> into marks), so inline tags are captured earlier
 * by the custom tokenizer in PreservedHtmlInlineBridge below.
 */
export const PreservedHtmlBlockBridge = Extension.create({
  name: "preservedHtmlBlockBridge",
  markdownTokenName: "html",
  parseMarkdown: (token, helpers) => {
    if (!token.block) {
      return null;
    }
    return preservedBlockFromToken(token, helpers);
  },
});

export const PreservedHtmlInlineBridge = Extension.create({
  name: "preservedHtmlInlineBridge",
  markdownTokenName: "preservedHtmlInline",
  markdownTokenizer: {
    name: "preservedHtmlInline",
    level: "inline",
    start: (src: string) => src.indexOf("<"),
    tokenize(src: string) {
      // One opening/closing/self-closing HTML tag. The first character after
      // `<` (or `</`) must be a letter and the tag name only [a-zA-Z0-9-],
      // followed by attributes/`>` — this never matches autolinks such as
      // <https://example.com> or <mail@example.com> (`:`/`@` break the match).
      const match = /^<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?\/?>/.exec(src);
      if (!match) {
        return undefined;
      }
      return { type: "preservedHtmlInline", raw: match[0], text: match[0] };
    },
  },
  parseMarkdown: (token, helpers) => helpers.createTextNode(token.raw ?? "", [{ type: "preservedInline" }]),
});

export const PreservedMathBlockBridge = Extension.create({
  name: "preservedMathBlockBridge",
  markdownTokenName: "preservedMathBlock",
  markdownTokenizer: {
    name: "preservedMathBlock",
    level: "block",
    start: (src: string) => src.indexOf("$$"),
    tokenize(src: string) {
      const match = /^\$\$[\s\S]+?\$\$(?:\n+|$)/.exec(src);
      if (!match) {
        return undefined;
      }
      return { type: "preservedMathBlock", raw: match[0], text: match[0] };
    },
  },
  parseMarkdown: preservedBlockFromToken,
});

export const PreservedMathInlineBridge = Extension.create({
  name: "preservedMathInlineBridge",
  markdownTokenName: "preservedMathInline",
  markdownTokenizer: {
    name: "preservedMathInline",
    level: "inline",
    start: (src: string) => src.indexOf("$"),
    tokenize(src: string) {
      const match = /^\$[^$\n]+\$/.exec(src);
      if (!match) {
        return undefined;
      }
      return { type: "preservedMathInline", raw: match[0], text: match[0] };
    },
  },
  parseMarkdown: (token, helpers) => helpers.createTextNode(token.raw ?? "", [{ type: "preservedInline" }]),
});

export const preservedExtensions = [
  PreservedBlock,
  PreservedInline,
  PreservedTableBridge,
  PreservedHtmlBlockBridge,
  PreservedHtmlInlineBridge,
  PreservedMathBlockBridge,
  PreservedMathInlineBridge,
];
```

Register in `web/src/components/MemoEditor/TiptapEditor/extensions.ts` — add the import and spread the list into the returned array after `Markdown`:

```ts
import { preservedExtensions } from "./PreservedBlock";
// …inside buildExtensions() return array, after Markdown:
    ...preservedExtensions,
```

- [ ] **Step 6: Run the tests until green**

```bash
pnpm test -- tiptap-preserved markdown-roundtrip
```

Expected: PASS (all groups).

Troubleshooting:
- TS error on `markdownTokenName`/`parseMarkdown` config fields → confirm `@tiptap/core` is 3.26.0 (`pnpm why @tiptap/core`); these fields are typed in `ExtendableConfig` there.
- Inline HTML still converted to `<em>` marks → the custom tokenizer isn't winning; verify the `markdownTokenizer.name` matches `markdownTokenName` exactly and check token output with `editor.markdown.parse("…")` in a scratch test.
- `block-html.md` byte test fails on internal blank lines: marked may split an HTML block at blank lines into multiple tokens. If so, simplify the fixture's `<div>` to have no blank lines inside (the contract is per-construct preservation, not blank-line geometry inside raw HTML), and note it in the fixture.
- Tokenizer with `level: "block"` not firing mid-document → marked requires block tokenizers to match at line starts; the `start` index approach is handled by the markdown manager. Verify with a one-line scratch test before deeper debugging.

- [ ] **Step 7: Commit**

```bash
git add web/src/components/MemoEditor/TiptapEditor web/tests
git commit -m "feat(web): preserve unmodeled markdown syntax byte-for-byte in tiptap editor"
```

---

### Task 4: `Tag` extension — memos `#tags` as inline tokens

**Files:**
- Create: `web/src/components/MemoEditor/TiptapEditor/Tag.ts`
- Modify: `web/src/components/MemoEditor/TiptapEditor/extensions.ts`
- Test: `web/tests/tiptap-tag.test.ts`

- [ ] **Step 1: Write the failing test**

`web/tests/tiptap-tag.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseMarkdown, roundTripMarkdown } from "@/components/MemoEditor/TiptapEditor/markdownCodec";

function firstParagraphChildren(markdown: string) {
  return parseMarkdown(markdown).content?.[0]?.content ?? [];
}

describe("Tag node", () => {
  it("parses #tag into a tag node", () => {
    const children = firstParagraphChildren("#hello world");
    expect(children[0]).toMatchObject({ type: "tag", attrs: { tag: "hello" } });
    expect(children[1]).toMatchObject({ type: "text", text: " world" });
  });

  it("serializes a tag node back to #tag verbatim", () => {
    expect(roundTripMarkdown("a #b-tag c").trim()).toBe("a #b-tag c");
  });

  it("supports unicode and nested-path tags", () => {
    expect(firstParagraphChildren("#日本語 and #work/project-1")[0]).toMatchObject({
      type: "tag",
      attrs: { tag: "日本語" },
    });
    const children = firstParagraphChildren("see #work/project-1 now");
    const tagNode = children.find((n) => n.type === "tag");
    expect(tagNode?.attrs?.tag).toBe("work/project-1");
  });

  it("does not turn headings into tags", () => {
    expect(parseMarkdown("# heading").content?.[0]?.type).toBe("heading");
  });

  it("does not match a bare # followed by space", () => {
    const children = firstParagraphChildren("a # b");
    expect(children.every((n) => n.type === "text")).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
pnpm test -- tiptap-tag
```

Expected: FAIL — `#hello` currently parses as plain text, no `tag` node.

- [ ] **Step 3: Implement the Tag node**

`web/src/components/MemoEditor/TiptapEditor/Tag.ts`:

```ts
import { InputRule, Node, mergeAttributes } from "@tiptap/core";
import type { MarkdownToken } from "@tiptap/core";

// Mirrors the renderer's tag lexer (web/src/utils/remark-plugins/remark-tag.ts):
// letters, numbers, symbols, plus _ - / &, max 100 chars. Keep the two in sync.
const TAG_CHAR = "[\\p{L}\\p{N}\\p{S}_\\-/&]";
const TAG_INPUT_RULE = new RegExp(`(?:^|\\s)#(${TAG_CHAR}{1,100})\\s$`, "u");
const TAG_TOKEN_RULE = new RegExp(`^#(${TAG_CHAR}{1,100})`, "u");

/**
 * Inline atom for memos `#tags`: rendered as a styled token in the editor,
 * serialized back to `#tag` verbatim. Parsed live while typing (input rule)
 * and from markdown (custom marked tokenizer).
 */
export const Tag = Node.create({
  name: "tag",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return { tag: { default: "" } };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-tag]",
        getAttrs: (element) => ({ tag: (element as HTMLElement).getAttribute("data-tag") ?? "" }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-tag": node.attrs.tag,
        class: "inline-block w-auto rounded bg-accent text-accent-foreground px-1",
      }),
      `#${node.attrs.tag}`,
    ];
  },

  addInputRules() {
    return [
      new InputRule({
        find: TAG_INPUT_RULE,
        handler: ({ state, range, match }) => {
          // The match may include a leading space/start anchor — only replace
          // from the `#` so we don't eat the separator before the tag.
          const start = range.from + match[0].indexOf("#");
          state.tr.replaceWith(start, range.to, [this.type.create({ tag: match[1] }), state.schema.text(" ")]);
        },
      }),
    ];
  },

  markdownTokenName: "memoTag",
  markdownTokenizer: {
    name: "memoTag",
    level: "inline",
    start: (src: string) => src.indexOf("#"),
    tokenize(src: string) {
      const match = TAG_TOKEN_RULE.exec(src);
      if (!match) {
        return undefined;
      }
      // Parity with remark-tag: `##x` is not a tag boundary.
      if (src[match[0].length] === "#") {
        return undefined;
      }
      return { type: "memoTag", raw: match[0], text: match[0], tag: match[1] };
    },
  },
  parseMarkdown: (token, helpers) => helpers.createNode("tag", { tag: (token as MarkdownToken & { tag?: string }).tag ?? "" }),
  renderMarkdown: (node) => `#${node.attrs?.tag ?? ""}`,
});
```

Register in `extensions.ts` (inside the `buildExtensions()` array, after the preserved extensions):

```ts
import { Tag } from "./Tag";
// …
    Tag,
```

- [ ] **Step 4: Run the tag tests and the full corpus**

```bash
pnpm test -- tiptap-tag markdown-roundtrip tiptap-preserved
```

Expected: PASS. (The corpus must stay green — the `#` tokenizer must not affect headings, which marked tokenizes at block level before inline rules run.)

- [ ] **Step 5: Commit**

```bash
git add web/src/components/MemoEditor/TiptapEditor web/tests/tiptap-tag.test.ts
git commit -m "feat(web): add memos tag node to tiptap editor with verbatim serialization"
```

---

### Task 5: `EditorController` interface + textarea adapter + MemoEditor rewiring

Introduce the shared interface and make the **existing textarea editor** implement it, so every consumer in `MemoEditor` stops depending on `EditorRefActions`. No Tiptap in the UI yet; behavior must be unchanged.

**Files:**
- Create: `web/src/components/MemoEditor/types/editorController.ts`
- Create: `web/src/components/MemoEditor/Editor/controllerAdapter.ts`
- Modify: `web/src/components/MemoEditor/Editor/shortcuts.ts` (export `toggleTextStyle`)
- Modify: `web/src/components/MemoEditor/components/EditorContent.tsx`
- Modify: `web/src/components/MemoEditor/hooks/useKeyboard.ts`
- Modify: `web/src/components/MemoEditor/hooks/useMemoInit.ts`
- Modify: `web/src/components/MemoEditor/index.tsx`
- Test: `web/tests/editor-controller-adapter.test.tsx`

- [ ] **Step 1: Define the interface**

`web/src/components/MemoEditor/types/editorController.ts`:

```ts
/**
 * The contract both memo editors (raw textarea and Tiptap WYSIWYG) implement.
 * Everything outside an editor implementation must talk markdown through this
 * interface and never reach for editor-specific APIs like EditorRefActions.
 */
export interface EditorController {
  focus(): void;
  hasFocus(): boolean;
  isEmpty(): boolean;
  /** Current document as a markdown string (the only storage format). */
  getMarkdown(): string;
  /** Replace the whole document from a markdown string. */
  setMarkdown(markdown: string): void;
  /** Insert markdown at the cursor as its own block, with blank-line separation as needed. */
  insertMarkdown(markdown: string): void;
  scrollToCursor(): void;
  // Formatting intents — each editor realizes them natively.
  toggleBold(): void;
  toggleItalic(): void;
  toggleTaskList(): void;
}
```

- [ ] **Step 2: Export `toggleTextStyle` from shortcuts.ts**

In `web/src/components/MemoEditor/Editor/shortcuts.ts` change the declaration on line 43 from:

```ts
function toggleTextStyle(editor: EditorRefActions, delimiter: string): void {
```

to:

```ts
export function toggleTextStyle(editor: EditorRefActions, delimiter: string): void {
```

- [ ] **Step 3: Write the failing adapter test**

`web/tests/editor-controller-adapter.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import Editor, { type EditorRefActions } from "@/components/MemoEditor/Editor";
import { createTextareaController } from "@/components/MemoEditor/Editor/controllerAdapter";

vi.mock("@/components/MemoEditor/Editor/TagSuggestions", () => ({ default: () => null }));
vi.mock("@/components/MemoEditor/Editor/SlashCommands", () => ({ default: () => null }));

function setup(initialContent = "") {
  const ref = createRef<EditorRefActions>();
  render(
    <Editor
      ref={ref}
      className=""
      initialContent={initialContent}
      placeholder="memo"
      onContentChange={vi.fn()}
      onPaste={vi.fn()}
    />,
  );
  const controller = createTextareaController(() => ref.current);
  const textarea = screen.getByPlaceholderText("memo") as HTMLTextAreaElement;
  return { controller, textarea };
}

describe("textarea EditorController adapter", () => {
  it("getMarkdown/setMarkdown mirror the textarea value", () => {
    const { controller, textarea } = setup("hello");
    expect(controller.getMarkdown()).toBe("hello");
    controller.setMarkdown("changed");
    expect(textarea.value).toBe("changed");
  });

  it("isEmpty treats whitespace-only content as empty", () => {
    const { controller } = setup("  \n ");
    expect(controller.isEmpty()).toBe(true);
  });

  it("insertMarkdown separates blocks with blank lines", () => {
    const { controller, textarea } = setup("first line");
    textarea.setSelectionRange(10, 10);
    controller.insertMarkdown("transcribed");
    expect(textarea.value).toBe("first line\n\ntranscribed");
  });

  it("toggleBold wraps the selection in **", () => {
    const { controller, textarea } = setup("read the docs");
    textarea.setSelectionRange(9, 13);
    controller.toggleBold();
    expect(textarea.value).toBe("read the **docs**");
  });

  it("toggleTaskList prefixes and unprefixes the current line", () => {
    const { controller, textarea } = setup("buy milk");
    textarea.setSelectionRange(4, 4);
    controller.toggleTaskList();
    expect(textarea.value).toBe("- [ ] buy milk");
    controller.toggleTaskList();
    expect(textarea.value).toBe("buy milk");
  });

  it("hasFocus reflects the active element", () => {
    const { controller, textarea } = setup("x");
    expect(controller.hasFocus()).toBe(false);
    textarea.focus();
    expect(controller.hasFocus()).toBe(true);
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

```bash
pnpm test -- editor-controller-adapter
```

Expected: FAIL — `controllerAdapter` module not found.

- [ ] **Step 5: Implement the adapter**

`web/src/components/MemoEditor/Editor/controllerAdapter.ts`:

```ts
import type { EditorController } from "../types/editorController";
import { toggleTextStyle } from "./shortcuts";
import type { EditorRefActions } from "./index";

const TASK_PREFIX = "- [ ] ";

/**
 * Adapts the textarea editor's imperative string-surgery API to the shared
 * EditorController contract. Takes a getter because the underlying ref is
 * populated after mount and may swap when the editor remounts.
 */
export function createTextareaController(getActions: () => EditorRefActions | null): EditorController {
  return {
    focus: () => getActions()?.focus(),
    hasFocus: () => {
      const element = getActions()?.getEditor();
      return Boolean(element) && document.activeElement === element;
    },
    isEmpty: () => (getActions()?.getContent() ?? "").trim() === "",
    getMarkdown: () => getActions()?.getContent() ?? "",
    setMarkdown: (markdown) => getActions()?.setContent(markdown),
    insertMarkdown: (markdown) => {
      const actions = getActions();
      if (!actions) return;
      const content = actions.getContent();
      const cursor = actions.getCursorPosition();
      const before = content.slice(0, cursor);
      const after = content.slice(cursor);
      const prefix = before.length === 0 || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
      const suffix = after.length === 0 || after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
      actions.insertText(markdown, prefix, suffix);
    },
    scrollToCursor: () => getActions()?.scrollToCursor(),
    toggleBold: () => {
      const actions = getActions();
      if (actions) toggleTextStyle(actions, "**");
    },
    toggleItalic: () => {
      const actions = getActions();
      if (actions) toggleTextStyle(actions, "*");
    },
    toggleTaskList: () => {
      const actions = getActions();
      if (!actions) return;
      const lineNumber = actions.getCursorLineNumber();
      const line = actions.getLine(lineNumber);
      actions.setLine(lineNumber, line.startsWith(TASK_PREFIX) ? line.slice(TASK_PREFIX.length) : `${TASK_PREFIX}${line}`);
    },
  };
}
```

- [ ] **Step 6: Run the adapter test**

```bash
pnpm test -- editor-controller-adapter
```

Expected: PASS.

- [ ] **Step 7: Rewire EditorContent to expose EditorController**

Replace `web/src/components/MemoEditor/components/EditorContent.tsx` imports and component shell (the drag/paste/composition handlers stay exactly as they are):

```tsx
import { forwardRef, useImperativeHandle, useRef } from "react";
import Editor, { type EditorRefActions } from "../Editor";
import { createTextareaController } from "../Editor/controllerAdapter";
import { useBlobUrls, useDragAndDrop } from "../hooks";
import { useEditorContext } from "../state";
import type { EditorContentProps } from "../types";
import type { LocalFile } from "../types/attachment";
import type { EditorController } from "../types/editorController";

export const EditorContent = forwardRef<EditorController, EditorContentProps>(({ placeholder }, ref) => {
  const { state, actions, dispatch } = useEditorContext();
  const { createBlobUrl } = useBlobUrls();
  const textareaActionsRef = useRef<EditorRefActions>(null);

  useImperativeHandle(ref, () => createTextareaController(() => textareaActionsRef.current), []);

  // …existing dragHandlers / handleCompositionStart / handleCompositionEnd /
  // handleContentChange / handlePaste bodies unchanged…

  return (
    <div className="w-full flex flex-col flex-1" {...dragHandlers}>
      <Editor
        ref={textareaActionsRef}
        className="memo-editor-content"
        initialContent={state.content}
        placeholder={placeholder || ""}
        isFocusMode={state.ui.isFocusMode}
        isInIME={state.ui.isComposing}
        onContentChange={handleContentChange}
        onPaste={handlePaste}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
      />
    </div>
  );
});

EditorContent.displayName = "EditorContent";
```

- [ ] **Step 8: Switch the MemoEditor consumers to the controller**

In `web/src/components/MemoEditor/hooks/useKeyboard.ts`, replace the whole file:

```ts
import { useEffect, useRef } from "react";
import type { EditorController } from "../types/editorController";

export const useKeyboard = (editorRef: React.RefObject<EditorController | null>, onSave: () => void) => {
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") {
        return;
      }

      if (!editorRef.current?.hasFocus()) {
        return;
      }

      event.preventDefault();
      onSaveRef.current();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editorRef]);
};
```

In `web/src/components/MemoEditor/hooks/useMemoInit.ts`, change only the type import/usage:

```ts
// remove: import type { EditorRefActions } from "../Editor";
import type { EditorController } from "../types/editorController";

interface UseMemoInitOptions {
  editorRef: React.RefObject<EditorController | null>;
  // …rest unchanged
}
```

In `web/src/components/MemoEditor/index.tsx`:

```ts
// remove: import type { EditorRefActions } from "./Editor";
import type { EditorController } from "./types/editorController";
// …
const editorRef = useRef<EditorController>(null);
```

and replace the `insertTranscribedText` callback body with:

```ts
const insertTranscribedText = useCallback((text: string) => {
  const editor = editorRef.current;
  if (!editor) {
    return;
  }
  editor.insertMarkdown(text);
  editor.scrollToCursor();
}, []);
```

- [ ] **Step 9: Run the full suite + lint**

```bash
pnpm lint && pnpm test
```

Expected: PASS — including the untouched `memo-editor-shortcuts` and `memo-editor-paste` tests (they render `Editor` directly and are unaffected).

- [ ] **Step 10: Commit**

```bash
git add web/src web/tests/editor-controller-adapter.test.tsx
git commit -m "refactor(web): introduce EditorController abstraction over the textarea editor"
```

---

### Task 6: TiptapEditor component

The WYSIWYG editor component: `useEditor` with the Task-2 extension list + `Placeholder`, markdown in/out on every update, file-paste delegation, composition events, and a `forwardRef` `EditorController`.

**Files:**
- Create: `web/src/components/MemoEditor/TiptapEditor/index.tsx`
- Modify: `web/src/index.css` (task-list + placeholder styles)
- Test: `web/tests/tiptap-editor-controller.test.tsx`

- [ ] **Step 1: Extend EditorController with `selectAll` (needed to test selection-based intents)**

Add to the `EditorController` interface in `web/src/components/MemoEditor/types/editorController.ts` (after `scrollToCursor`):

```ts
  /** Select the entire document (used by tests and select-all flows). */
  selectAll(): void;
```

and add the textarea implementation in `web/src/components/MemoEditor/Editor/controllerAdapter.ts` (after `scrollToCursor`):

```ts
    selectAll: () => {
      const actions = getActions();
      if (!actions) return;
      actions.setCursorPosition(0, actions.getContent().length);
    },
```

- [ ] **Step 2: Write the failing test**

`web/tests/tiptap-editor-controller.test.tsx`:

```tsx
import { act, render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import TiptapEditor from "@/components/MemoEditor/TiptapEditor";
import type { EditorController } from "@/components/MemoEditor/types/editorController";

function setup(initialContent = "") {
  const ref = createRef<EditorController>();
  const onContentChange = vi.fn();
  render(
    <TiptapEditor
      initialContent={initialContent}
      placeholder="memo"
      onContentChange={onContentChange}
      onPaste={vi.fn()}
    />,
  );
  return { ref, onContentChange };
}

describe("TiptapEditor EditorController", () => {
  it("loads markdown and serializes it back", () => {
    const { ref } = setup("# Title\n\nSome **bold** text.");
    expect(ref.current?.getMarkdown()).toBe("# Title\n\nSome **bold** text.");
  });

  it("reports emptiness", () => {
    const { ref } = setup("");
    expect(ref.current?.isEmpty()).toBe(true);
  });

  it("setMarkdown replaces the document", () => {
    const { ref } = setup("old");
    act(() => ref.current?.setMarkdown("- [ ] task"));
    expect(ref.current?.getMarkdown()).toBe("- [ ] task");
  });

  it("insertMarkdown adds content and notifies onContentChange", () => {
    const { ref, onContentChange } = setup("");
    act(() => ref.current?.insertMarkdown("hello"));
    expect(ref.current?.getMarkdown()).toContain("hello");
    expect(onContentChange).toHaveBeenCalledWith(expect.stringContaining("hello"));
  });

  it("toggleBold bolds the selected text", () => {
    const { ref } = setup("bold me");
    act(() => ref.current?.selectAll());
    act(() => ref.current?.toggleBold());
    expect(ref.current?.getMarkdown()).toBe("**bold me**");
  });

  it("toggleTaskList converts the current block", () => {
    const { ref } = setup("buy milk");
    act(() => ref.current?.toggleTaskList());
    expect(ref.current?.getMarkdown()).toBe("- [ ] buy milk");
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

```bash
pnpm test -- tiptap-editor-controller
```

Expected: FAIL — `@/components/MemoEditor/TiptapEditor` has no `index.tsx` default export yet.

- [ ] **Step 4: Implement the component**

`web/src/components/MemoEditor/TiptapEditor/index.tsx`:

```tsx
import { EditorContent as TiptapEditorContent, useEditor } from "@tiptap/react";
import { Placeholder } from "@tiptap/extensions";
import { forwardRef, useEffect, useImperativeHandle } from "react";
import { cn } from "@/lib/utils";
import { EDITOR_HEIGHT } from "../constants";
import type { EditorController } from "../types/editorController";
import { buildExtensions } from "./extensions";

export interface TiptapEditorProps {
  className?: string;
  initialContent: string;
  placeholder: string;
  isFocusMode?: boolean;
  onContentChange: (content: string) => void;
  onPaste: (event: React.ClipboardEvent) => void;
  onCompositionStart?: () => void;
  onCompositionEnd?: () => void;
}

/**
 * WYSIWYG memo editor on Tiptap/ProseMirror. Markdown is the only format
 * crossing its boundary: in via setContent(contentType: "markdown"), out via
 * getMarkdown() on every update. IME, list continuation, input rules, and
 * auto-grow are native ProseMirror/contenteditable behavior.
 */
const TiptapEditor = forwardRef<EditorController, TiptapEditorProps>(function TiptapEditor(props, ref) {
  const { className, initialContent, placeholder, isFocusMode, onContentChange, onPaste, onCompositionStart, onCompositionEnd } = props;

  const editor = useEditor({
    extensions: [...buildExtensions(), Placeholder.configure({ placeholder })],
    content: initialContent,
    contentType: "markdown",
    editorProps: {
      attributes: {
        class: "memo-wysiwyg outline-none w-full text-base break-words min-h-6",
      },
      handlePaste: (_view, event) => {
        const hasFiles = Array.from(event.clipboardData?.items ?? []).some((item) => item.kind === "file");
        if (hasFiles) {
          onPaste(event as unknown as React.ClipboardEvent);
          return true;
        }
        // Text paste (incl. URL-over-selection → link) is handled natively.
        return false;
      },
      handleDOMEvents: {
        compositionstart: () => {
          onCompositionStart?.();
          return false;
        },
        compositionend: () => {
          onCompositionEnd?.();
          return false;
        },
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onContentChange(currentEditor.getMarkdown());
    },
  });

  // Sync external content changes (e.g. reset after save, draft restore)
  // without clobbering the document the user is typing into: only apply when
  // the markdown actually differs.
  useEffect(() => {
    if (!editor) {
      return;
    }
    if (editor.getMarkdown() !== initialContent) {
      editor.commands.setContent(initialContent, { contentType: "markdown", emitUpdate: false });
    }
  }, [initialContent, editor]);

  useImperativeHandle(
    ref,
    (): EditorController => ({
      focus: () => editor?.commands.focus(),
      hasFocus: () => editor?.isFocused ?? false,
      isEmpty: () => editor?.isEmpty ?? true,
      getMarkdown: () => editor?.getMarkdown() ?? "",
      setMarkdown: (markdown) => editor?.commands.setContent(markdown, { contentType: "markdown" }),
      insertMarkdown: (markdown) => editor?.chain().focus().insertContent(markdown, { contentType: "markdown" }).run(),
      scrollToCursor: () => editor?.commands.scrollIntoView(),
      selectAll: () => editor?.commands.selectAll(),
      toggleBold: () => editor?.chain().focus().toggleBold().run(),
      toggleItalic: () => editor?.chain().focus().toggleItalic().run(),
      toggleTaskList: () => editor?.chain().focus().toggleTaskList().run(),
    }),
    [editor],
  );

  return (
    <div
      className={cn(
        "flex flex-col justify-start items-start relative w-full bg-inherit overflow-y-auto overflow-x-hidden",
        isFocusMode ? "flex-1" : `h-auto ${EDITOR_HEIGHT.normal}`,
        className,
      )}
    >
      <TiptapEditorContent editor={editor} className="w-full" />
    </div>
  );
});

export default TiptapEditor;
```

- [ ] **Step 5: Add minimal global styles**

Append to `web/src/index.css`:

```css
/* Tiptap WYSIWYG memo editor */
.memo-wysiwyg p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  opacity: 0.7;
  pointer-events: none;
}

.memo-wysiwyg ul,
.memo-wysiwyg ol {
  padding-left: 1.5rem;
}

.memo-wysiwyg ul {
  list-style: disc;
}

.memo-wysiwyg ol {
  list-style: decimal;
}

.memo-wysiwyg ul[data-type="taskList"] {
  list-style: none;
  padding-left: 0;
}

.memo-wysiwyg ul[data-type="taskList"] li {
  display: flex;
  gap: 0.5rem;
}

.memo-wysiwyg ul[data-type="taskList"] li > label {
  flex: 0 0 auto;
  user-select: none;
}

.memo-wysiwyg ul[data-type="taskList"] li > div {
  flex: 1 1 auto;
}

.memo-wysiwyg blockquote {
  border-left: 2px solid var(--border);
  padding-left: 0.75rem;
  opacity: 0.9;
}

.memo-wysiwyg pre {
  background: var(--muted);
  border-radius: 0.375rem;
  padding: 0.5rem 0.75rem;
  font-family: var(--font-mono, monospace);
  font-size: 0.875rem;
  white-space: pre-wrap;
}

.memo-wysiwyg code {
  background: var(--muted);
  border-radius: 0.25rem;
  padding: 0 0.25rem;
  font-family: var(--font-mono, monospace);
  font-size: 0.875em;
}

.memo-wysiwyg pre code {
  background: transparent;
  padding: 0;
}
```

(If `var(--border)` / `var(--muted)` are not defined in this project's Tailwind theme, check `web/src/index.css` for the actual CSS custom property names used by shadcn components — they exist because classes like `bg-muted`/`border-border` are used throughout — and substitute the real names.)

- [ ] **Step 6: Run the test until green**

```bash
pnpm test -- tiptap-editor-controller
```

Expected: PASS.

Troubleshooting:
- jsdom missing APIs when the ProseMirror view mounts (`getClientRects`, `elementFromPoint`): add to `web/tests/setup.ts`:

```ts
// ProseMirror probes layout APIs jsdom doesn't implement.
if (typeof document !== "undefined") {
  if (!document.elementFromPoint) {
    document.elementFromPoint = () => null;
  }
  if (typeof Range !== "undefined" && !Range.prototype.getClientRects) {
    Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
    Range.prototype.getBoundingClientRect = () =>
      ({ x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, toJSON: () => ({}) }) as DOMRect;
  }
}
```

- `useEditor` returning `null` on first render in React 19 → wrap assertions in `await waitFor(...)` from @testing-library/react, or pass `immediatelyRender: true` to `useEditor` (Tiptap v3 option) — prefer `immediatelyRender: true` since this app is client-only.

- [ ] **Step 7: Verify the corpus is still green, lint, commit**

```bash
pnpm lint && pnpm test
git add web/src web/tests
git commit -m "feat(web): add tiptap wysiwyg editor component behind EditorController"
```

---

### Task 7: Dual-mode `EditorContent`, mode toggle UI, localStorage persistence

**Files:**
- Create: `web/src/components/MemoEditor/editorMode.ts`
- Modify: `web/src/components/MemoEditor/state/types.ts`
- Modify: `web/src/components/MemoEditor/state/actions.ts`
- Modify: `web/src/components/MemoEditor/state/reducer.ts`
- Modify: `web/src/components/MemoEditor/state/context.tsx`
- Modify: `web/src/components/MemoEditor/components/EditorContent.tsx`
- Modify: `web/src/components/MemoEditor/components/EditorToolbar.tsx`
- Modify: `web/src/locales/en.json`
- Test: `web/tests/editor-mode.test.ts`, `web/tests/editor-mode-toggle.test.tsx`

- [ ] **Step 1: Write the failing preference-helper test**

`web/tests/editor-mode.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { getPreferredEditorMode, setPreferredEditorMode } from "@/components/MemoEditor/editorMode";

describe("editor mode preference", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to wysiwyg", () => {
    expect(getPreferredEditorMode()).toBe("wysiwyg");
  });

  it("persists raw mode", () => {
    setPreferredEditorMode("raw");
    expect(getPreferredEditorMode()).toBe("raw");
    expect(localStorage.getItem("memos-editor-mode")).toBe("raw");
  });

  it("ignores garbage values", () => {
    localStorage.setItem("memos-editor-mode", "weird");
    expect(getPreferredEditorMode()).toBe("wysiwyg");
  });
});
```

- [ ] **Step 2: Run it to verify it fails, then implement the helper**

```bash
pnpm test -- editor-mode.test
```

Expected: FAIL (module missing). Then create `web/src/components/MemoEditor/editorMode.ts`:

```ts
export type EditorMode = "wysiwyg" | "raw";

const STORAGE_KEY = "memos-editor-mode";

/** Per-device editor mode preference. WYSIWYG is the default for everyone. */
export function getPreferredEditorMode(): EditorMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === "raw" ? "raw" : "wysiwyg";
  } catch {
    return "wysiwyg";
  }
}

export function setPreferredEditorMode(mode: EditorMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // localStorage unavailable (e.g. blocked storage) — preference won't persist.
  }
}
```

Re-run: `pnpm test -- editor-mode.test` → PASS.

- [ ] **Step 3: Add editor mode to the reducer state**

In `web/src/components/MemoEditor/state/types.ts`:

1. Add the import at the top:

```ts
import { getPreferredEditorMode, type EditorMode } from "../editorMode";
```

2. In `EditorState["ui"]`, add a field after `isComposing: boolean;`:

```ts
    editorMode: EditorMode;
```

3. Add to the `EditorAction` union:

```ts
  | { type: "SET_EDITOR_MODE"; payload: EditorMode }
```

4. In `initialState.ui`, after `isComposing: false,` add:

```ts
    editorMode: "wysiwyg",
```

5. After the `initialState` declaration, add:

```ts
/**
 * Fresh initial state for a mounting editor. Reads the persisted mode
 * preference at call time (not module load) so newly opened editors honor a
 * toggle made earlier in the session.
 */
export function createInitialState(): EditorState {
  return {
    ...initialState,
    ui: { ...initialState.ui, editorMode: getPreferredEditorMode() },
  };
}
```

In `web/src/components/MemoEditor/state/actions.ts`, add to `editorActions` (and add `import type { EditorMode } from "../editorMode";`):

```ts
  setEditorMode: (mode: EditorMode): EditorAction => ({
    type: "SET_EDITOR_MODE",
    payload: mode,
  }),
```

In `web/src/components/MemoEditor/state/reducer.ts`:

1. Change the import line `import { initialState } from "./types";` to `import { createInitialState } from "./types";`
2. Add a case before `RESET`:

```ts
    case "SET_EDITOR_MODE":
      return {
        ...state,
        ui: {
          ...state.ui,
          editorMode: action.payload,
        },
      };
```

3. Change the `RESET` case to re-read the persisted preference:

```ts
    case "RESET":
      return createInitialState();
```

In `web/src/components/MemoEditor/state/context.tsx`, change the import of `initialState` to `createInitialState` and the `useReducer` line to lazy-init:

```ts
import { createInitialState } from "./types";
// …
  const [state, dispatch] = useReducer(editorReducer, initialEditorState, (provided) => provided ?? createInitialState());
```

Check `web/src/components/MemoEditor/state/index.ts` re-exports and add `createInitialState` / `EditorMode` exports if it enumerates names explicitly.

- [ ] **Step 4: Write the failing dual-mode test**

`web/tests/editor-mode-toggle.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EditorContent } from "@/components/MemoEditor/components/EditorContent";
import { EditorProvider, useEditorContext } from "@/components/MemoEditor/state";

vi.mock("@/components/MemoEditor/Editor/TagSuggestions", () => ({ default: () => null }));
vi.mock("@/components/MemoEditor/Editor/SlashCommands", () => ({ default: () => null }));

function ModeProbe() {
  const { state, actions, dispatch } = useEditorContext();
  return (
    <button
      type="button"
      data-testid="probe-toggle"
      onClick={() => dispatch(actions.setEditorMode(state.ui.editorMode === "wysiwyg" ? "raw" : "wysiwyg"))}
    >
      {state.ui.editorMode}
    </button>
  );
}

function renderDualEditor() {
  render(
    <EditorProvider>
      <EditorContent placeholder="memo" />
      <ModeProbe />
    </EditorProvider>,
  );
}

describe("editor mode switching", () => {
  it("mounts the WYSIWYG editor by default", () => {
    localStorage.clear();
    renderDualEditor();
    expect(document.querySelector(".memo-wysiwyg")).not.toBeNull();
    expect(screen.queryByPlaceholderText("memo")).toBeNull();
  });

  it("mounts the textarea when the persisted preference is raw", () => {
    localStorage.setItem("memos-editor-mode", "raw");
    renderDualEditor();
    expect(screen.getByPlaceholderText("memo")).toBeInTheDocument();
    expect(document.querySelector(".memo-wysiwyg")).toBeNull();
  });

  it("hands content across when toggling raw → wysiwyg", () => {
    localStorage.setItem("memos-editor-mode", "raw");
    renderDualEditor();
    const textarea = screen.getByPlaceholderText("memo") as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: "hello **world**" } });

    fireEvent.click(screen.getByTestId("probe-toggle"));

    const wysiwyg = document.querySelector(".memo-wysiwyg");
    expect(wysiwyg).not.toBeNull();
    expect(wysiwyg?.textContent).toContain("hello world");
    expect(wysiwyg?.querySelector("strong")?.textContent).toBe("world");
  });
});
```

Run `pnpm test -- editor-mode-toggle` — expected FAIL (`EditorContent` always renders the textarea).

- [ ] **Step 5: Make EditorContent host both editors**

Replace `web/src/components/MemoEditor/components/EditorContent.tsx` with:

```tsx
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from "react";
import Editor, { type EditorRefActions } from "../Editor";
import { createTextareaController } from "../Editor/controllerAdapter";
import { useBlobUrls, useDragAndDrop } from "../hooks";
import { useEditorContext } from "../state";
import TiptapEditor from "../TiptapEditor";
import type { EditorContentProps } from "../types";
import type { LocalFile } from "../types/attachment";
import type { EditorController } from "../types/editorController";

/**
 * Hosts one of the two editor implementations behind the EditorController
 * contract, selected by state.ui.editorMode. Mode switching is a markdown
 * handoff: both editors serialize into state.content on every change, so the
 * incoming editor simply initializes from it.
 */
export const EditorContent = forwardRef<EditorController, EditorContentProps>(({ placeholder }, ref) => {
  const { state, actions, dispatch } = useEditorContext();
  const { createBlobUrl } = useBlobUrls();
  const mode = state.ui.editorMode;

  const textareaActionsRef = useRef<EditorRefActions>(null);
  const tiptapControllerRef = useRef<EditorController>(null);
  const textareaController = useMemo(() => createTextareaController(() => textareaActionsRef.current), []);

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const getActive = useCallback(
    (): EditorController | null => (modeRef.current === "wysiwyg" ? tiptapControllerRef.current : textareaController),
    [textareaController],
  );

  useImperativeHandle(
    ref,
    (): EditorController => ({
      focus: () => getActive()?.focus(),
      hasFocus: () => getActive()?.hasFocus() ?? false,
      isEmpty: () => getActive()?.isEmpty() ?? true,
      getMarkdown: () => getActive()?.getMarkdown() ?? "",
      setMarkdown: (markdown) => getActive()?.setMarkdown(markdown),
      insertMarkdown: (markdown) => getActive()?.insertMarkdown(markdown),
      scrollToCursor: () => getActive()?.scrollToCursor(),
      selectAll: () => getActive()?.selectAll(),
      toggleBold: () => getActive()?.toggleBold(),
      toggleItalic: () => getActive()?.toggleItalic(),
      toggleTaskList: () => getActive()?.toggleTaskList(),
    }),
    [getActive],
  );

  const { dragHandlers } = useDragAndDrop((files: FileList) => {
    const localFiles: LocalFile[] = Array.from(files).map((file) => ({
      file,
      previewUrl: createBlobUrl(file),
      origin: "upload",
    }));
    localFiles.forEach((localFile) => dispatch(actions.addLocalFile(localFile)));
  });

  const handleCompositionStart = () => {
    dispatch(actions.setComposing(true));
  };

  const handleCompositionEnd = () => {
    dispatch(actions.setComposing(false));
  };

  const handleContentChange = (content: string) => {
    dispatch(actions.updateContent(content));
  };

  const handlePaste = (event: React.ClipboardEvent<Element>) => {
    const clipboard = event.clipboardData;
    if (!clipboard) return;

    const files: File[] = [];
    if (clipboard.items && clipboard.items.length > 0) {
      for (const item of Array.from(clipboard.items)) {
        if (item.kind !== "file") continue;
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    } else if (clipboard.files && clipboard.files.length > 0) {
      files.push(...Array.from(clipboard.files));
    }

    if (files.length === 0) return;

    const localFiles: LocalFile[] = files.map((file) => ({
      file,
      previewUrl: createBlobUrl(file),
      origin: "upload",
    }));
    localFiles.forEach((localFile) => dispatch(actions.addLocalFile(localFile)));
    event.preventDefault();
  };

  return (
    <div className="w-full flex flex-col flex-1" {...dragHandlers}>
      {mode === "wysiwyg" ? (
        <TiptapEditor
          ref={tiptapControllerRef}
          className="memo-editor-content"
          initialContent={state.content}
          placeholder={placeholder || ""}
          isFocusMode={state.ui.isFocusMode}
          onContentChange={handleContentChange}
          onPaste={handlePaste}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
        />
      ) : (
        <Editor
          ref={textareaActionsRef}
          className="memo-editor-content"
          initialContent={state.content}
          placeholder={placeholder || ""}
          isFocusMode={state.ui.isFocusMode}
          isInIME={state.ui.isComposing}
          onContentChange={handleContentChange}
          onPaste={handlePaste}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
        />
      )}
    </div>
  );
});

EditorContent.displayName = "EditorContent";
```

Run `pnpm test -- editor-mode-toggle` → PASS.

- [ ] **Step 6: Add the toggle button to the toolbar + i18n strings**

In `web/src/locales/en.json`, inside the `"editor"` object (alphabetical-ish placement next to its siblings), add:

```json
    "switch-to-raw": "Edit raw Markdown",
    "switch-to-wysiwyg": "Edit rich text",
```

In `web/src/components/MemoEditor/components/EditorToolbar.tsx`:

1. Add imports:

```tsx
import { CodeXmlIcon, TypeIcon } from "lucide-react";
import { setPreferredEditorMode } from "../editorMode";
```

2. Inside the component, add a handler after `handleToggleFocusMode`:

```tsx
  const handleToggleEditorMode = () => {
    const next = state.ui.editorMode === "wysiwyg" ? "raw" : "wysiwyg";
    dispatch(actions.setEditorMode(next));
    setPreferredEditorMode(next);
  };
```

3. In the left button group, right after `<InsertMenu …/>`, add:

```tsx
        <Button
          variant="ghost"
          size="icon"
          className="ml-1 shadow-none text-muted-foreground"
          onClick={handleToggleEditorMode}
          title={state.ui.editorMode === "wysiwyg" ? t("editor.switch-to-raw") : t("editor.switch-to-wysiwyg")}
        >
          {state.ui.editorMode === "wysiwyg" ? <CodeXmlIcon className="size-4" /> : <TypeIcon className="size-4" />}
        </Button>
```

- [ ] **Step 7: Add a toolbar toggle test**

Append to `web/tests/editor-mode-toggle.test.tsx` (extend the existing file; add the import `import { EditorToolbar } from "@/components/MemoEditor/components/EditorToolbar";`):

```tsx
describe("toolbar mode toggle button", () => {
  it("switches mode and persists the preference", async () => {
    localStorage.clear();
    render(
      <EditorProvider>
        <EditorContent placeholder="memo" />
        <EditorToolbar onSave={vi.fn()} onAudioRecorderClick={vi.fn()} />
      </EditorProvider>,
    );

    // i18n resources load through a lazy backend — await the translated title.
    fireEvent.click(await screen.findByTitle("Edit raw Markdown"));

    expect(screen.getByPlaceholderText("memo")).toBeInTheDocument();
    expect(localStorage.getItem("memos-editor-mode")).toBe("raw");
    expect(await screen.findByTitle("Edit rich text")).toBeInTheDocument();
  });
});
```

(If the translated title never resolves because the test environment leaves i18next uninitialized, `t()` returns the key — query `findByTitle("editor.switch-to-raw")` instead and leave a comment. Check how the suite behaves before reaching for an i18n test bootstrap.)

(If `EditorToolbar` pulls in providers that explode in jsdom — e.g. `VisibilitySelector`'s radix Select — mock the offending child: `vi.mock("@/components/MemoEditor/Toolbar/VisibilitySelector", () => ({ default: () => null }));` and same for `InsertMenu` if needed. Note `Toolbar/index.ts` may re-export; mock the exact module path the component imports.)

- [ ] **Step 8: Full suite + lint + commit**

```bash
pnpm lint && pnpm test
git add web/src web/tests
git commit -m "feat(web): dual-mode memo editor with wysiwyg/raw toggle persisted per device"
```

---

### Task 8: Tag suggestions popup in WYSIWYG mode

**Files:**
- Create: `web/src/components/MemoEditor/TiptapEditor/suggestionMenu.tsx`
- Create: `web/src/components/MemoEditor/TiptapEditor/TagSuggestion.ts`
- Modify: `web/src/components/MemoEditor/TiptapEditor/index.tsx`
- Test: `web/tests/suggestion-menu.test.tsx`

- [ ] **Step 1: Write the failing popup-component test**

`web/tests/suggestion-menu.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { SuggestionMenu, type SuggestionMenuHandle } from "@/components/MemoEditor/TiptapEditor/suggestionMenu";

function setup(items = ["alpha", "beta", "gamma"]) {
  const command = vi.fn();
  const ref = createRef<SuggestionMenuHandle>();
  render(
    <SuggestionMenu
      ref={ref}
      items={items}
      command={command}
      getItemKey={(item: string) => item}
      renderItem={(item: string) => <span>#{item}</span>}
    />,
  );
  return { command, ref };
}

const keyDown = (key: string) => ({ event: new KeyboardEvent("keydown", { key }) }) as never;

describe("SuggestionMenu", () => {
  it("renders all items", () => {
    setup();
    expect(screen.getByText("#alpha")).toBeInTheDocument();
    expect(screen.getByText("#gamma")).toBeInTheDocument();
  });

  it("navigates with arrows and selects with Enter", () => {
    const { command, ref } = setup();
    expect(ref.current?.onKeyDown(keyDown("ArrowDown"))).toBe(true);
    expect(ref.current?.onKeyDown(keyDown("Enter"))).toBe(true);
    expect(command).toHaveBeenCalledWith("beta");
  });

  it("selects on mouse down", () => {
    const { command } = setup();
    fireEvent.mouseDown(screen.getByText("#gamma"));
    expect(command).toHaveBeenCalledWith("gamma");
  });

  it("renders nothing for an empty list and lets keys pass through", () => {
    const { ref } = setup([]);
    expect(document.querySelector("[data-suggestion-menu]")).toBeNull();
    expect(ref.current?.onKeyDown(keyDown("Enter"))).toBe(false);
  });
});
```

Run `pnpm test -- suggestion-menu` — expected FAIL (module missing).

- [ ] **Step 2: Implement the shared menu + suggestion renderer factory**

`web/src/components/MemoEditor/TiptapEditor/suggestionMenu.tsx`:

```tsx
import { ReactRenderer } from "@tiptap/react";
import type { SuggestionKeyDownProps, SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import { forwardRef, useEffect, useImperativeHandle, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SuggestionMenuHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

interface SuggestionMenuProps<T> {
  items: T[];
  command: (item: T) => void;
  renderItem: (item: T, isSelected: boolean) => ReactNode;
  getItemKey: (item: T) => string;
}

// Visual parity with the textarea editor's popup (Editor/SuggestionsPopup.tsx).
const MENU_STYLES = {
  container:
    "z-50 p-1 max-w-48 max-h-60 rounded border bg-popover text-popover-foreground shadow-lg font-mono flex flex-col overflow-y-auto overflow-x-hidden",
  item: "rounded p-1 px-2 w-full text-sm cursor-pointer transition-colors select-none hover:bg-accent hover:text-accent-foreground",
};

function SuggestionMenuInner<T>(
  { items, command, renderItem, getItemKey }: SuggestionMenuProps<T>,
  ref: React.ForwardedRef<SuggestionMenuHandle>,
) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => setSelectedIndex(0), [items]);

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown: ({ event }) => {
        if (items.length === 0) {
          return false;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((index) => (index + 1) % items.length);
          return true;
        }
        if (event.key === "ArrowUp") {
          setSelectedIndex((index) => (index - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          command(items[selectedIndex]);
          return true;
        }
        return false;
      },
    }),
    [items, selectedIndex, command],
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <div data-suggestion-menu className={MENU_STYLES.container}>
      {items.map((item, index) => (
        <div
          key={getItemKey(item)}
          onMouseDown={(event) => {
            event.preventDefault();
            command(item);
          }}
          className={cn(MENU_STYLES.item, index === selectedIndex && "bg-accent text-accent-foreground")}
        >
          {renderItem(item, index === selectedIndex)}
        </div>
      ))}
    </div>
  );
}

export const SuggestionMenu = forwardRef(SuggestionMenuInner) as <T>(
  props: SuggestionMenuProps<T> & { ref?: React.ForwardedRef<SuggestionMenuHandle> },
) => ReturnType<typeof SuggestionMenuInner>;

/**
 * Builds the Suggestion-plugin `render` lifecycle: mounts SuggestionMenu in a
 * floating container positioned at the trigger's caret rect. No tippy —
 * a plain absolutely-positioned element on document.body.
 */
export function createSuggestionRenderer<T>(menu: {
  renderItem: (item: T, isSelected: boolean) => ReactNode;
  getItemKey: (item: T) => string;
}): SuggestionOptions<T>["render"] {
  return () => {
    let renderer: ReactRenderer<SuggestionMenuHandle> | null = null;
    let container: HTMLDivElement | null = null;

    const reposition = (props: SuggestionProps<T>) => {
      const rect = props.clientRect?.();
      if (!rect || !container) {
        return;
      }
      container.style.left = `${rect.left + window.scrollX}px`;
      container.style.top = `${rect.bottom + window.scrollY + 4}px`;
    };

    const destroy = () => {
      renderer?.destroy();
      container?.remove();
      renderer = null;
      container = null;
    };

    const menuProps = (props: SuggestionProps<T>) => ({
      items: props.items,
      command: (item: T) => props.command(item),
      renderItem: menu.renderItem,
      getItemKey: menu.getItemKey,
    });

    return {
      onStart: (props) => {
        renderer = new ReactRenderer(SuggestionMenu, { props: menuProps(props), editor: props.editor });
        container = document.createElement("div");
        container.style.position = "absolute";
        container.style.zIndex = "50";
        container.appendChild(renderer.element);
        document.body.appendChild(container);
        reposition(props);
      },
      onUpdate: (props) => {
        renderer?.updateProps(menuProps(props));
        reposition(props);
      },
      onKeyDown: (props) => {
        if (props.event.key === "Escape") {
          destroy();
          return true;
        }
        return renderer?.ref?.onKeyDown(props) ?? false;
      },
      onExit: destroy,
    };
  };
}
```

Run `pnpm test -- suggestion-menu` → PASS.

- [ ] **Step 3: Implement the TagSuggestion extension**

`web/src/components/MemoEditor/TiptapEditor/TagSuggestion.ts`:

```ts
import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";
import { createElement } from "react";
import { createSuggestionRenderer } from "./suggestionMenu";

export interface TagSuggestionOptions {
  /** Getter (not a snapshot) so the popup always sees freshly fetched tags. */
  getTags: () => string[];
}

const MAX_SUGGESTIONS = 20;

/** `#` popup backed by the user's existing tags; inserts a Tag node + space. */
export const TagSuggestion = Extension.create<TagSuggestionOptions>({
  name: "tagSuggestion",

  addOptions() {
    return { getTags: () => [] };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<string>({
        editor: this.editor,
        pluginKey: new PluginKey("tagSuggestion"),
        char: "#",
        allowSpaces: false,
        items: ({ query }) => {
          const tags = this.options.getTags();
          const q = query.toLowerCase();
          const filtered = q ? tags.filter((tag) => tag.toLowerCase().includes(q)) : tags;
          return filtered.slice(0, MAX_SUGGESTIONS);
        },
        command: ({ editor, range, props: tag }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              { type: "tag", attrs: { tag } },
              { type: "text", text: " " },
            ])
            .run();
        },
        render: createSuggestionRenderer<string>({
          getItemKey: (tag) => tag,
          renderItem: (tag) =>
            createElement("span", { className: "truncate" }, createElement("span", { className: "text-muted-foreground mr-1" }, "#"), tag),
        }),
      }),
    ];
  },
});
```

- [ ] **Step 4: Wire tags into the editor component**

In `web/src/components/MemoEditor/TiptapEditor/index.tsx`:

1. Add imports:

```tsx
import { useMemo, useRef } from "react";
import { matchPath } from "react-router-dom";
import { useTagCounts } from "@/hooks/useUserQueries";
import { Routes } from "@/router";
import { TagSuggestion } from "./TagSuggestion";
```

2. Inside the component before `useEditor`, mirror the textarea's tag sourcing (`Editor/TagSuggestions.tsx`):

```tsx
  // On the explore page suggestions include all users' tags; otherwise the
  // current user's. Same sourcing as the raw editor's TagSuggestions.
  const isExplorePage = Boolean(matchPath(Routes.EXPLORE, window.location.pathname));
  const { data: tagCount = {} } = useTagCounts(!isExplorePage);
  const sortedTags = useMemo(
    () =>
      Object.entries(tagCount)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([tag]) => tag),
    [tagCount],
  );
  const tagsRef = useRef<string[]>([]);
  tagsRef.current = sortedTags;
```

3. Add to the `useEditor` extensions array:

```tsx
      TagSuggestion.configure({ getTags: () => tagsRef.current }),
```

- [ ] **Step 5: Fix tests that now need the query hook mocked**

`useTagCounts` is a react-query hook; any test rendering `TiptapEditor` without a `QueryClientProvider` will now throw. Add to the TOP of `web/tests/tiptap-editor-controller.test.tsx` AND `web/tests/editor-mode-toggle.test.tsx`:

```tsx
vi.mock("@/hooks/useUserQueries", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useTagCounts: () => ({ data: {} }),
}));
```

(If `importOriginal` drags in transitive modules that fail at import time, replace with a plain object mock exporting just `useTagCounts` and any names those tests touch.)

- [ ] **Step 6: Full suite + lint + commit**

```bash
pnpm lint && pnpm test
git add web/src web/tests
git commit -m "feat(web): tag suggestion popup for wysiwyg editor"
```

---

### Task 9: Slash commands in WYSIWYG mode

**Files:**
- Create: `web/src/components/MemoEditor/TiptapEditor/SlashCommand.ts`
- Modify: `web/src/components/MemoEditor/TiptapEditor/index.tsx`
- Test: `web/tests/tiptap-slash-commands.test.ts`

- [ ] **Step 1: Write the failing test**

`web/tests/tiptap-slash-commands.test.ts`:

```ts
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { buildExtensions } from "@/components/MemoEditor/TiptapEditor/extensions";
import { slashCommandItems } from "@/components/MemoEditor/TiptapEditor/SlashCommand";

let editor: Editor;

function applyCommand(name: string, content = "") {
  editor = new Editor({ extensions: buildExtensions(), content, contentType: "markdown" });
  const item = slashCommandItems.find((candidate) => candidate.name === name);
  if (!item) throw new Error(`unknown slash command: ${name}`);
  // Simulate a trigger at the end of the document: range covers a typed "/".
  editor.commands.insertContent("/");
  const end = editor.state.doc.content.size;
  item.apply(editor, { from: end - 1, to: end });
  return editor.getMarkdown();
}

afterEach(() => editor?.destroy());

describe("WYSIWYG slash commands", () => {
  it("todo converts the block into a task list", () => {
    expect(applyCommand("todo")).toBe("- [ ]");
  });

  it("code converts the block into a code block", () => {
    expect(applyCommand("code")).toContain("```");
  });

  it("link inserts a markdown link", () => {
    expect(applyCommand("link")).toContain("[text](url)");
  });

  it("table inserts a preserved markdown table", () => {
    const markdown = applyCommand("table");
    expect(markdown).toContain("| Header | Header |");
    expect(markdown).toContain("| ------ | ------ |");
  });
});
```

Run `pnpm test -- tiptap-slash-commands` — expected FAIL (module missing).

Note: if the `todo` expectation fails on exact whitespace (e.g. `"- [ ] "` vs `"- [ ]"`), assert with `expect(markdown.trimEnd()).toBe("- [ ]")` — the meaningful claim is the empty task item, not trailing-space geometry.

- [ ] **Step 2: Implement the SlashCommand extension**

`web/src/components/MemoEditor/TiptapEditor/SlashCommand.ts`:

```ts
import { Extension, type Editor, type Range } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";
import { createElement } from "react";
import { createSuggestionRenderer } from "./suggestionMenu";

export interface SlashCommandItem {
  name: string;
  apply: (editor: Editor, range: Range) => void;
}

// WYSIWYG counterparts of the raw editor's commands (Editor/commands.ts):
// the same four entries, realized as editor commands instead of raw strings.
export const slashCommandItems: SlashCommandItem[] = [
  {
    name: "todo",
    apply: (editor, range) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    name: "code",
    apply: (editor, range) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    name: "link",
    apply: (editor, range) =>
      editor.chain().focus().deleteRange(range).insertContent("[text](url)", { contentType: "markdown" }).run(),
  },
  {
    name: "table",
    apply: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent("| Header | Header |\n| ------ | ------ |\n| Cell   | Cell |", { contentType: "markdown" })
        .run(),
  },
];

/** `/` command popup; replaces the raw editor's SlashCommands in WYSIWYG mode. */
export const SlashCommand = Extension.create({
  name: "slashCommand",

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommandItem>({
        editor: this.editor,
        pluginKey: new PluginKey("slashCommand"),
        char: "/",
        allowSpaces: false,
        items: ({ query }) => {
          const q = query.toLowerCase();
          return q ? slashCommandItems.filter((item) => item.name.startsWith(q)) : slashCommandItems;
        },
        command: ({ editor, range, props: item }) => {
          item.apply(editor, range);
        },
        render: createSuggestionRenderer<SlashCommandItem>({
          getItemKey: (item) => item.name,
          renderItem: (item) =>
            createElement(
              "span",
              { className: "tracking-wide" },
              createElement("span", { className: "text-muted-foreground" }, "/"),
              item.name,
            ),
        }),
      }),
    ];
  },
});
```

- [ ] **Step 3: Register in the editor component**

In `web/src/components/MemoEditor/TiptapEditor/index.tsx` add the import and append to the `useEditor` extensions array (after `TagSuggestion.configure(…)`):

```tsx
import { SlashCommand } from "./SlashCommand";
// …
      SlashCommand,
```

- [ ] **Step 4: Run tests + lint + commit**

```bash
pnpm lint && pnpm test
git add web/src web/tests/tiptap-slash-commands.test.ts
git commit -m "feat(web): slash command popup for wysiwyg editor"
```

---

### Task 10: Load guard (round-trip tripwire on opening existing memos)

When opening an **existing** memo in WYSIWYG mode, verify the round trip is lossless; if not, switch this editor session to raw mode (without persisting the preference) and tell the user. Expected never to fire — `PreservedBlock` should make every input lossless — but this is the safety net the fidelity contract demands.

**Files:**
- Modify: `web/src/components/MemoEditor/hooks/useMemoInit.ts`
- Modify: `web/src/locales/en.json`
- Test: `web/tests/editor-load-guard.test.tsx`

- [ ] **Step 1: Add the i18n string**

In `web/src/locales/en.json`, in the `"editor"` object next to the Task-7 keys:

```json
    "unsupported-syntax-raw-mode": "This memo contains syntax the rich-text editor can't safely edit, so it opened in raw Markdown mode.",
```

- [ ] **Step 2: Write the failing test**

`web/tests/editor-load-guard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { create } from "@bufbuild/protobuf";
import { useMemoInit } from "@/components/MemoEditor/hooks";
import { EditorProvider, useEditorContext } from "@/components/MemoEditor/state";
import { MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("react-hot-toast", () => ({ toast: Object.assign(toastMock, { error: vi.fn(), success: vi.fn() }) }));

const isLosslessMock = vi.hoisted(() => vi.fn());
vi.mock("@/components/MemoEditor/TiptapEditor/markdownCodec", () => ({
  isLosslessRoundTrip: isLosslessMock,
}));

function Harness({ content }: { content: string }) {
  const memo = create(MemoSchema, { name: "memos/1", content });
  useMemoInit({ editorRef: { current: null }, memo, username: "users/test" });
  const { state } = useEditorContext();
  return <span data-testid="mode">{state.ui.editorMode}</span>;
}

function renderGuard(content: string) {
  render(
    <EditorProvider>
      <Harness content={content} />
    </EditorProvider>,
  );
}

describe("memo-open load guard", () => {
  it("switches the session to raw mode when the round trip would lose content", () => {
    localStorage.clear();
    isLosslessMock.mockReturnValue(false);
    renderGuard("some exotic content");
    expect(screen.getByTestId("mode").textContent).toBe("raw");
    expect(toastMock).toHaveBeenCalled();
    // Session-only: the persisted preference is untouched.
    expect(localStorage.getItem("memos-editor-mode")).toBeNull();
  });

  it("stays in wysiwyg when the round trip is lossless", () => {
    localStorage.clear();
    isLosslessMock.mockReturnValue(true);
    renderGuard("plain content");
    expect(screen.getByTestId("mode").textContent).toBe("wysiwyg");
  });
});
```

(Adjust the `Memo` construction to this repo's proto runtime: check how other tests build a `Memo` — e.g. grep `MemoSchema` in `web/tests/` — and mirror that. If none exists, `create(MemoSchema, { name, content })` with `@bufbuild/protobuf` is correct for protobuf-es v2.)

Run `pnpm test -- editor-load-guard` — expected FAIL (mode stays `wysiwyg`, no toast).

- [ ] **Step 3: Implement the guard in useMemoInit**

In `web/src/components/MemoEditor/hooks/useMemoInit.ts`:

1. Add imports:

```ts
import { toast } from "react-hot-toast";
import { useTranslate } from "@/utils/i18n";
import { getPreferredEditorMode } from "../editorMode";
import { isLosslessRoundTrip } from "../TiptapEditor/markdownCodec";
```

2. Add `const t = useTranslate();` next to the existing `useEditorContext()` call.

3. In the `if (memo)` branch, after `dispatch(actions.initMemo(initialState));`, add:

```ts
      // Load guard (tripwire): if the WYSIWYG round trip would change this
      // memo's meaning, edit it raw for this session. Preference untouched.
      if (getPreferredEditorMode() === "wysiwyg" && initialState.content && !isLosslessRoundTrip(initialState.content)) {
        console.warn("memo content failed wysiwyg round-trip; falling back to raw editor", memo.name);
        dispatch(actions.setEditorMode("raw"));
        toast(t("editor.unsupported-syntax-raw-mode"));
      }
```

4. Add `t` to the effect's dependency array.

- [ ] **Step 4: Run tests + lint + commit**

```bash
pnpm lint && pnpm test
git add web/src web/tests/editor-load-guard.test.tsx
git commit -m "feat(web): raw-mode load guard for memos the wysiwyg editor cannot round-trip"
```

---

### Task 11: Final verification, docs, release build

**Files:**
- Modify: `web/src/components/MemoEditor/README.md`

- [ ] **Step 1: Full verification**

```bash
cd /Users/steven/Projects/usememos/memos/web
pnpm lint && pnpm test && pnpm build
```

Expected: all PASS; the build completes. Note the reported gzip size of chunks containing tiptap — the budget from the spec is ~100 KB gzipped for the editor stack; if it lands wildly above (>150 KB), flag it in the final report (do not silently accept).

- [ ] **Step 2: Update the MemoEditor README**

Read `web/src/components/MemoEditor/README.md` and update it to describe the new architecture: the `EditorController` contract, the two implementations (`Editor/` textarea = raw mode, `TiptapEditor/` = WYSIWYG default), the mode toggle + localStorage key `memos-editor-mode`, the markdown codec + corpus tests as the fidelity gate, and the load guard. Keep its existing tone/format; do not document internals that the code already states.

- [ ] **Step 3: Manual QA checklist (requires a running dev server: `pnpm dev` against a local memos server)**

Walk through and record results — these are the spec's manual-QA items that jsdom cannot cover:

1. Type `**bold**`, `# heading`, `- ` list, `> quote`, ` ``` ` fence — each converts live as you type.
2. Type `#` — tag popup opens, filter works, Enter inserts a styled tag chip; saved memo renders the tag.
3. Type `/` — command popup opens; todo/code/link/table all insert.
4. Paste an image — it appears in the attachment strip (upload path), not as text.
5. Select text and paste a URL over it — it becomes a link.
6. Toggle to raw mode mid-edit — markdown matches what was typed; toggle back — nothing lost; reload — preference remembered.
7. Edit a memo containing a table + `$math$` — both visible as literal mono text; save without touching them; verify the stored content is byte-identical (compare in raw mode before/after).
8. CJK IME composition (macOS Japanese/Chinese input): no duplicated or dropped characters while composing.
9. Focus mode: editor grows to fill; typing/scrolling fine.
10. Mobile Safari/Chrome (or responsive emulation): soft keyboard works, popups usable.
11. Ctrl/Cmd+B/I in WYSIWYG; Ctrl/Cmd+Enter saves from inside the editor.
12. Draft persistence: type in a new memo, reload the page, content restored (in both modes).

- [ ] **Step 4: Final commit**

```bash
cd /Users/steven/Projects/usememos/memos
git add web/src/components/MemoEditor/README.md
git commit -m "docs(web): document dual-mode memo editor architecture"
```

Then use the **superpowers:finishing-a-development-branch** skill to decide merge/PR handling.

---

## Self-review notes (already applied)

- Spec coverage: raw-mode toggle (Task 7), fidelity contract + corpus-first spike (Tasks 2–3), v1 live set via StarterKit/TaskList/Tag (Tasks 2, 4), tables/math/inline-HTML literal (Task 3), suggestion popups (Tasks 8–9), file paste/drag (Task 6 + existing container drag), load guard (Task 10), draft/save path untouched (state.content unchanged throughout), manual QA list (Task 11). Out-of-scope items from the spec are not implemented anywhere.
- Known accepted deviations, each annotated inline: serialize-on-update instead of debounce (Task header note); `##x` tokenizer edge differs from remark-tag but serializes identically (Task 4); slash `link` command can't preselect the URL placeholder in WYSIWYG (raw mode retains that nicety).
- Type-consistency check: `EditorController` gains `selectAll()` in Task 6 — implementers executing tasks out of order should add it to the interface + textarea adapter as described there; all later facades (Task 7) already include it.
