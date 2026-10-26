import type { Theme } from "@pierre/highlights";
import type { Decoration } from "@usememos/editor";

type CodeHighlighter = (code: string) => Decoration[];
const readyHighlighters = new Map<string, CodeHighlighter>();
const plainTextLanguages = new Set(["", "plain", "plaintext", "text", "txt"]);

/** Keep structural punctuation plain without adding decoration spans. */
const codeTheme = (theme: Theme): Theme => {
  const foreground = theme.style["editor.foreground"] ?? theme.style.text;
  const syntax = { ...theme.style.syntax };
  for (const name of Object.keys(syntax)) {
    if (name === "operator" || name === "keyword.operator" || name === "punctuation" || name.startsWith("punctuation.")) {
      syntax[name] = { color: foreground };
    }
  }
  return { ...theme, style: { ...theme.style, syntax } };
};

/** Load the Wasm engine and just the two themes we use, only when a code block needs them. */
const loadHighlights = () =>
  Promise.all([
    import("@pierre/highlights"),
    import("@pierre/highlights/themes/github-light"),
    import("@pierre/highlights/themes/github-dark-dimmed"),
  ]).then(([{ codeToTokens, isSupportedLanguage }, light, dark]) => ({
    codeToTokens,
    isSupportedLanguage,
    themes: { light: codeTheme(light.default), dark: codeTheme(dark.default) },
  }));

let highlightsPromise: ReturnType<typeof loadHighlights> | undefined;

/** Loads a token highlighter. Unsupported languages or unavailable Wasm remain plain text. */
export const loadHighlighter = async (language: string): Promise<void> => {
  const key = language.trim().toLowerCase();
  if (plainTextLanguages.has(key) || readyHighlighters.has(key)) return;

  // The editor follows the document's color-scheme. Older browsers keep plain code.
  const supportsThemeColors = typeof CSS === "undefined" || !CSS.supports || CSS.supports("color", "light-dark(black, white)");
  const highlights = supportsThemeColors ? await (highlightsPromise ??= loadHighlights()).catch(() => null) : null;
  if (highlights?.isSupportedLanguage(key)) {
    readyHighlighters.set(key, (code) => {
      const { tokens, fg } = highlights.codeToTokens(code, { lang: key, themes: highlights.themes, defaultColor: "light-dark()" });
      return tokens.flatMap((line) =>
        line
          .filter((token) => token.htmlStyle && !(Object.keys(token.htmlStyle).length === 1 && token.htmlStyle.color === fg))
          .map((token) => ({
            from: token.offset,
            to: token.offset + token.content.length,
            class: "memos-code-token",
            attributes: {
              style: Object.entries(token.htmlStyle ?? {})
                .map(([name, value]) => `${name}:${value}`)
                .join(";"),
            },
          })),
      );
    });
    return;
  }

  readyHighlighters.set(key, () => []);
};

/** Text decorations, or undefined until the language has loaded. Plain text needs no decorations. */
export const highlightLoadedCode = (code: string, language: string): Decoration[] | undefined => {
  const key = language.trim().toLowerCase();
  if (!code || plainTextLanguages.has(key)) return [];
  return readyHighlighters.get(key)?.(code);
};
