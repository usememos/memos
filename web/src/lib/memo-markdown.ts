import {
  type Block,
  type Doc,
  defaultResolveUrl,
  type Extension,
  footnotes,
  isPlainTextBlock,
  isTextBlock,
  type Labels,
  type MarkdownOptions,
  math,
  mentions,
  parseMarkdown,
  type ResolveUrl,
  type Span,
  type SyntaxView,
  scanMentions,
  scanTags,
  type TagScanner,
  type TagsOptions,
  type Theme,
  tags,
} from "@usememos/editor";
import { highlightLoadedCode, loadHighlighter } from "@/lib/code-highlight";
import { colorToHex } from "@/lib/color";
import { headingClasses, markdownStyles, mentionStyles, tagStyles } from "@/lib/markdownStyles";
import { findTagMetadata } from "@/lib/tag";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/proto/api/attachment_service_pb";
import type { UserSetting_TagsSetting } from "@/types/proto/api/user_service_pb";
import type { useTranslate } from "@/utils/i18n";
import { resolveManagedAttachmentImageSource } from "@/utils/managed-attachment";

/**
 * The memo Markdown dialect, shared by the composer and the read-only memo view
 * so a memo reads the same while editing and after saving: a single newline is
 * a line break, and setext headings are off, so a line
 * followed by `---` stays a paragraph and a divider.
 */
export const MEMO_MARKDOWN: MarkdownOptions = { breaks: true, setext: false };

type KatexModule = typeof import("katex").default;

let katexModule: KatexModule | null = null;
let katexPromise: Promise<KatexModule> | null = null;

/** Loads KaTeX and its stylesheet once. */
const loadKatex = (): Promise<KatexModule> => {
  katexPromise ??= Promise.all([import("katex"), import("katex/dist/katex.min.css")]).then(([module]) => {
    katexModule = module.default;
    return katexModule;
  });
  return katexPromise;
};

/** Renders TeX with KaTeX, loading it the first time; the editor shows the source meanwhile. */
const renderMath = (tex: string, element: HTMLElement, { displayMode }: { readonly displayMode: boolean }) => {
  const render = (katex: KatexModule) => katex.render(tex, element, { displayMode, throwOnError: false, strict: false });
  if (katexModule) return render(katexModule);
  return loadKatex().then(render);
};

/** Editors whose code needs highlighting again once a language finishes loading. */
const highlightedEditors = new Set<import("@usememos/editor").Editor>();
/** Languages loading now, so each load redecorates the editors once, however many blocks wait for it. */
const loadingLanguages = new Set<string>();

/**
 * Token-based syntax highlighting for code blocks, while editing and when read-only.
 * A language loads the first time it is needed; the editors then highlight again.
 */
const codeHighlight = (): Extension => ({
  name: "codeHighlight",
  onCreate: ({ editor }) => {
    highlightedEditors.add(editor);
    return () => highlightedEditors.delete(editor);
  },
  codeDecorations: ({ text, language }) => {
    if (!language.trim() || !text) return [];
    const ranges = highlightLoadedCode(text, language);
    if (ranges === undefined) {
      const key = language.trim().toLowerCase();
      if (!loadingLanguages.has(key)) {
        loadingLanguages.add(key);
        void loadHighlighter(language)
          .then(
            () => highlightedEditors.forEach((editor) => editor.redecorate()),
            () => undefined,
          )
          .finally(() => loadingLanguages.delete(key));
      }
      return [];
    }
    return ranges;
  },
});

/**
 * Mermaid diagrams for ```mermaid code blocks, drawn by Pele: the diagram types load on
 * first use, the SVG takes its colors from the `.pele` variables in index.css, so a new
 * color scheme needs no redraw, and the layout adapts to the memo's width. The code
 * shows until the diagram is drawn, and stays if it fails.
 */
const renderDiagram: SyntaxView = (source, element) => {
  const pre = document.createElement("pre");
  pre.textContent = source;
  element.appendChild(pre);
  return (async () => {
    const { PeleError, renderAsync } = await import("pele/lazy");
    await document.fonts?.ready;
    const style = getComputedStyle(element);
    try {
      const { svg } = await renderAsync(source, {
        fontFamily: style.fontFamily || "sans-serif",
        fontFamilyMono: style.getPropertyValue("--font-mono").trim() || "monospace",
        maxWidth: element.clientWidth || undefined,
        // A memo column is narrow; the diagram shrinks to fit, but keeps the direction its author wrote.
        autoDirection: false,
        idPrefix: `diagram-${Math.random().toString(36).slice(2)}`,
      });
      element.innerHTML = svg;
    } catch (error) {
      if (!(error instanceof PeleError)) throw error;
      return false;
    }
  })();
};

type HtmlRenderer = typeof import("@/lib/sanitized-html").renderSanitizedHtml;
let htmlRenderer: HtmlRenderer | null = null;
let htmlRendererPromise: Promise<HtmlRenderer> | null = null;

/** Raw HTML (`<details>`, `<kbd>`, trusted embeds) through memos' sanitizer, loaded the first time it is needed. */
const renderHtml: SyntaxView = (source, element, kind) => {
  if (htmlRenderer) return htmlRenderer(source, element, kind);
  htmlRendererPromise ??= import("@/lib/sanitized-html").then((module) => {
    htmlRenderer = module.renderSanitizedHtml;
    return htmlRenderer;
  });
  return htmlRendererPromise.then((render) => render(source, element, kind));
};

/** A tag's custom color from the user's tag settings, as a hex value, or undefined for the theme color. */
function tagColor(tag: string, tagsSetting: UserSetting_TagsSetting | undefined): string | undefined {
  const metadata = tagsSetting ? findTagMetadata(tag, tagsSetting) : undefined;
  return colorToHex(metadata?.backgroundColor);
}

// `mbe-tag` is the editor's own class; the memo view finds tags by it.
const TAG_CLASS = cn("mbe-tag", tagStyles.base);
const DEFAULT_TAG_CLASS = cn(TAG_CLASS, tagStyles.defaultColor);
const CUSTOM_TAG_CLASS = cn(TAG_CLASS, tagStyles.customColor);

/**
 * How a #tag looks wherever a memo is shown, in the composer and the memo view alike:
 * a pill in the theme color, or in the color the user gave the tag, which the element
 * carries as `--tag-color` for tagStyles.customColor to draw from. `getTagsSetting`
 * is read when a block is decorated; call `editor.redecorate()` when it changes.
 */
export const memoTagOptions = (getTagsSetting: () => UserSetting_TagsSetting | undefined): Pick<TagsOptions, "class" | "attributes"> => ({
  class: (match) => (tagColor(match.slice(1), getTagsSetting()) ? CUSTOM_TAG_CLASS : DEFAULT_TAG_CLASS),
  attributes: (match): Record<string, string> => {
    const tag = match.slice(1);
    const color = tagColor(tag, getTagsSetting());
    return color ? { "data-tag": tag, style: `--tag-color: ${color}` } : { "data-tag": tag };
  },
});

const RESOLVED_MENTION_CLASS = cn("mbe-mention", mentionStyles.base);

/**
 * How an @mention looks wherever a memo is shown: in the primary color when the person
 * exists, as plain text otherwise. `isResolved` is read when a block is decorated; call
 * `editor.redecorate()` when it changes.
 */
export const memoMentionOptions = (isResolved: (username: string) => boolean): Pick<TagsOptions, "class" | "attributes"> => ({
  class: (match) => (isResolved(match.slice(1)) ? RESOLVED_MENTION_CLASS : "mbe-mention"),
  attributes: (match): Record<string, string> => {
    const username = match.slice(1);
    return isResolved(username)
      ? { "data-mention": username, "data-resolved": "", title: match }
      : { "data-mention": username, title: match };
  },
});

interface MemoExtensionOptions {
  /** `tags()` class and attributes, for the memo view's pills and colors. */
  readonly tags?: Pick<TagsOptions, "class" | "attributes" | "onClick">;
  /** `mentions()` class and attributes, for links to the people who exist. */
  readonly mentions?: Pick<TagsOptions, "class" | "attributes" | "onClick">;
}

/**
 * The extensions every memo surface reads with, the composer and the memo view
 * alike: math (KaTeX, loaded on demand), footnotes, #tags and @mentions,
 * highlighted code, Mermaid diagrams (drawn by Pele) and sanitized raw HTML.
 * Everything the editor renders shows its source at the caret while editing.
 */
export const memoExtensions = (options: MemoExtensionOptions = {}): Extension[] => [
  math({ render: renderMath }),
  footnotes(),
  tags(options.tags),
  mentions(options.mentions),
  codeHighlight(),
  { name: "memoViews", views: { "code:mermaid": renderDiagram, html: renderHtml } },
];

/** Images load from relative URLs and https only, as memos' sanitizer allowed; anything else is dropped. */
const isAllowedImageSource = (src: string): boolean => !/^[a-z][a-z0-9+.-]*:/i.test(src) || /^https:/i.test(src);

/**
 * memos' URL policy: images the memo names load from relative or https URLs only, and
 * managed attachment images then resolve to their served URL, which is the instance's
 * own origin and may be plain http. Links also allow `sms:`, which hands off to another
 * app, beyond the editor's defaults.
 */
export const memoResolveUrl =
  (attachments: readonly Attachment[] = []): ResolveUrl =>
  (url, kind) => {
    if (kind === "image") {
      return isAllowedImageSource(url) ? (resolveManagedAttachmentImageSource(url, [...attachments]) ?? url) : null;
    }
    return /^sms:/i.test(url.trim()) ? url.trim() : defaultResolveUrl(url, kind);
  };

/**
 * The editor's look in memos' palette. Every color is one of the app's own CSS
 * variables, set once for both schemes (`colors`), since the variables already
 * follow the active memos theme; `inherit` follows the `color-scheme` memos sets
 * on the document. No `highlight` token: memos' HTML sanitizer drops `<mark>`, and
 * should it ever pass, the editor's yellow is what a highlighter means, where a
 * tint of the primary color would read as a tag pill or a selection.
 */
export const MEMO_EDITOR_THEME: Theme = (() => {
  const colors = {
    text: "var(--foreground)",
    muted: "var(--muted-foreground)",
    background: "transparent",
    accent: "var(--primary)",
    link: "var(--primary)",
    codeBackground: "var(--muted)",
    border: "var(--border)",
    popupBackground: "var(--popover)",
    popupBorder: "var(--border)",
    hover: "var(--accent)",
    danger: "var(--destructive)",
  };
  return {
    colorScheme: "inherit",
    tokens: {
      colors,
      font: "inherit",
      mono: "var(--font-mono, ui-monospace, monospace)",
      fontSize: 16,
      lineHeight: 24,
      radius: "calc(var(--radius) - 2px)",
      blockGap: 8,
    },
    classes: {
      heading: headingClasses,
      code: markdownStyles.inlineCode,
      link: markdownStyles.link,
      // The editor sizes and spaces its images; raw HTML images keep markdownStyles.image.
      image: "rounded-lg",
    },
  };
})();

/** The composer's look in focus mode: the same theme, set larger for writing at length. */
export const MEMO_FOCUS_EDITOR_THEME: Theme = {
  ...MEMO_EDITOR_THEME,
  tokens: { ...MEMO_EDITOR_THEME.tokens, fontSize: 17, lineHeight: 28 },
};

/** The editor's UI strings in the user's language. */
export const memoEditorLabels = (t: ReturnType<typeof useTranslate>): Partial<Labels> => ({
  text: t("editor.format.paragraph"),
  heading1: t("editor.format.heading-1"),
  heading2: t("editor.format.heading-2"),
  heading3: t("editor.format.heading-3"),
  heading4: t("editor.format.heading-4"),
  bulletList: t("editor.format.bullet-list"),
  numberedList: t("editor.format.ordered-list"),
  todoList: t("editor.format.task-list"),
  task: t("editor.blocks.task"),
  quote: t("editor.blocks.quote"),
  callout: t("editor.blocks.callout"),
  calloutNote: t("editor.blocks.callout-note"),
  calloutTip: t("editor.blocks.callout-tip"),
  calloutImportant: t("editor.blocks.callout-important"),
  calloutWarning: t("editor.blocks.callout-warning"),
  calloutCaution: t("editor.blocks.callout-caution"),
  details: t("editor.blocks.collapsible-section"),
  detailsHint: t("common.title"),
  expandSection: t("common.expand"),
  collapseSection: t("common.collapse"),
  code: t("editor.format.code-block"),
  table: t("editor.blocks.table"),
  divider: t("editor.blocks.divider"),
  noResults: t("editor.blocks.no-results"),
  suggestions: t("editor.suggestions"),
  commands: t("editor.blocks.commands"),
  loading: t("editor.blocks.loading"),
  duplicate: t("editor.blocks.duplicate"),
  delete: t("common.delete"),
  bold: t("editor.format.bold"),
  italic: t("editor.format.italic"),
  strike: t("editor.format.strikethrough"),
  inlineCode: t("editor.blocks.inline-code"),
  link: t("editor.format.link"),
  textStyle: t("editor.blocks.text-style"),
  list: t("editor.blocks.list-hint"),
  linkPlaceholder: t("editor.blocks.link-placeholder"),
  removeLink: t("editor.blocks.remove-link"),
  openLink: t("editor.blocks.open-link"),
  copyLink: t("editor.blocks.copy-link"),
  editLink: t("editor.blocks.edit-link"),
  blockHandle: t("editor.blocks.block-menu"),
  listHint: t("editor.blocks.list-hint"),
  quoteHint: t("editor.blocks.quote"),
  language: t("common.language"),
  plainText: t("editor.blocks.plain-text"),
  copyCode: t("common.copy"),
  copied: t("message.copied"),
  addRowAbove: t("editor.blocks.add-row-above"),
  addRowBelow: t("editor.blocks.add-row-below"),
  addColumnLeft: t("editor.blocks.add-column-left"),
  addColumnRight: t("editor.blocks.add-column-right"),
  deleteRow: t("editor.blocks.delete-row"),
  deleteColumn: t("editor.blocks.delete-column"),
  align: t("editor.blocks.align"),
  alignLeft: t("editor.blocks.align-left"),
  alignCenter: t("editor.blocks.align-center"),
  alignRight: t("editor.blocks.align-right"),
  tableSection: t("editor.blocks.table"),
  imageSection: t("editor.blocks.image"),
  imageAlignLeft: t("editor.blocks.image-align-left"),
  imageAlignCenter: t("editor.blocks.image-align-center"),
  imageAlignRight: t("editor.blocks.image-align-right"),
  resetImageSize: t("editor.blocks.reset-image-size"),
  altText: t("editor.blocks.alt-text"),
  altTextPlaceholder: t("editor.blocks.alt-text-placeholder"),
  imageUnavailable: t("editor.blocks.image-unavailable"),
  resizeImage: t("editor.blocks.resize-image"),
  footnotes: t("editor.footnotes"),
  backToReference: t("editor.back-to-reference"),
});

/** Whether a span is literal text for tags: not code, raw HTML, a link, an image, or an extension token. */
const isLiteralSpan = (span: Span): boolean =>
  Boolean(span.link || span.image || span.token || span.marks.includes("code") || span.marks.includes("html"));

/** The inline containers of a block: its content, or every table cell. */
function* blockContainers(block: Block): Generator<readonly Span[]> {
  if (block.type === "table") {
    for (const row of block.rows) for (const cell of row) yield cell;
    return;
  }
  if (isTextBlock(block) && !isPlainTextBlock(block)) yield block.content;
}

/**
 * Matches of `scan` in a document, without the trigger, in order and without
 * duplicates. Each run of text with one format is scanned on its own, as the
 * editor's `tags()` and `mentions()` highlighting does, so code, links and
 * other literal text never count.
 */
const collectMatches = (blocks: readonly Block[], scan: TagScanner): string[] => {
  const found = new Set<string>();
  for (const block of blocks) {
    for (const content of blockContainers(block)) {
      for (const span of content) {
        if (isLiteralSpan(span)) continue;
        for (const range of scan(span.text, 0, span.text.length)) found.add(span.text.slice(range.from + 1, range.to));
      }
    }
  }
  return [...found];
};

/** Tags written in a document, as highlighted: `#work/project` gives `work/project`. */
export const collectTags = (blocks: readonly Block[]): string[] => collectMatches(blocks, scanTags);

// The syntax the memo extensions add (math, footnotes, and the escapes of tags and mentions), for parsing outside an editor.
const MEMO_SYNTAX = memoExtensions().flatMap((extension) => (extension.markdown ? [extension.markdown] : []));

/** Parses a memo the way the composer and the memo view read it. */
export const parseMemoMarkdown = (markdown: string): Doc => parseMarkdown(markdown, { ...MEMO_MARKDOWN, syntax: MEMO_SYNTAX });

/**
 * Usernames a memo mentions, as the memo view highlights them: `@name` outside code,
 * links and other literal text. Only these need resolving to profile links.
 */
export const extractMentionUsernames = (markdown: string): string[] =>
  markdown.includes("@") ? collectMatches(parseMemoMarkdown(markdown).blocks, scanMentions) : [];
