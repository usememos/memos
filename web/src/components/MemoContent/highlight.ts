import type { HLJSApi, LanguageFn } from "highlight.js";
import { escape as escapeHTML } from "lodash-es";

type LanguageModule = { default: LanguageFn };
type LanguageLoader = () => Promise<LanguageModule>;

// Keep the languages most commonly used in memos cheap. Less common languages
// fall back to the complete build, preserving existing language support without
// making every visitor download all language definitions.
const commonLanguageLoaders = {
  bash: () => import("highlight.js/lib/languages/bash"),
  c: () => import("highlight.js/lib/languages/c"),
  cpp: () => import("highlight.js/lib/languages/cpp"),
  csharp: () => import("highlight.js/lib/languages/csharp"),
  css: () => import("highlight.js/lib/languages/css"),
  diff: () => import("highlight.js/lib/languages/diff"),
  dockerfile: () => import("highlight.js/lib/languages/dockerfile"),
  go: () => import("highlight.js/lib/languages/go"),
  graphql: () => import("highlight.js/lib/languages/graphql"),
  java: () => import("highlight.js/lib/languages/java"),
  javascript: () => import("highlight.js/lib/languages/javascript"),
  json: () => import("highlight.js/lib/languages/json"),
  kotlin: () => import("highlight.js/lib/languages/kotlin"),
  markdown: () => import("highlight.js/lib/languages/markdown"),
  php: () => import("highlight.js/lib/languages/php"),
  python: () => import("highlight.js/lib/languages/python"),
  ruby: () => import("highlight.js/lib/languages/ruby"),
  rust: () => import("highlight.js/lib/languages/rust"),
  sql: () => import("highlight.js/lib/languages/sql"),
  swift: () => import("highlight.js/lib/languages/swift"),
  typescript: () => import("highlight.js/lib/languages/typescript"),
  xml: () => import("highlight.js/lib/languages/xml"),
  yaml: () => import("highlight.js/lib/languages/yaml"),
} satisfies Record<string, LanguageLoader>;

type CommonLanguage = keyof typeof commonLanguageLoaders;

const languageAliases: Record<string, CommonLanguage> = {
  cs: "csharp",
  cxx: "cpp",
  golang: "go",
  htm: "xml",
  html: "xml",
  js: "javascript",
  jsx: "javascript",
  md: "markdown",
  py: "python",
  rb: "ruby",
  sh: "bash",
  shell: "bash",
  ts: "typescript",
  tsx: "typescript",
  vue: "xml",
  yml: "yaml",
  zsh: "bash",
};

const plainTextLanguages = new Set(["", "plain", "plaintext", "text", "txt"]);
const registeredLanguagePromises = new Map<CommonLanguage, Promise<HLJSApi>>();
let corePromise: Promise<HLJSApi> | undefined;
let fullBuildPromise: Promise<HLJSApi> | undefined;
let injectedThemeKey: string | undefined;

export const isPlainTextLanguage = (language: string): boolean => plainTextLanguages.has(language.trim().toLowerCase());

// The hljs theme stylesheet is a document-global singleton, so it is managed here
// (keyed by theme) rather than by each rendered code block.
export const ensureHighlightTheme = async (isDarkTheme: boolean): Promise<void> => {
  const themeKey = isDarkTheme ? "dark" : "light";
  if (injectedThemeKey === themeKey) {
    return;
  }
  injectedThemeKey = themeKey;

  try {
    const cssModule = isDarkTheme
      ? await import("highlight.js/styles/github-dark-dimmed.css?inline")
      : await import("highlight.js/styles/github.css?inline");
    if (injectedThemeKey !== themeKey) {
      return;
    }

    document.querySelector("style[data-hljs-theme]")?.remove();
    const style = document.createElement("style");
    style.textContent = cssModule.default;
    style.setAttribute("data-hljs-theme", themeKey);
    document.head.appendChild(style);
  } catch (error) {
    injectedThemeKey = undefined;
    console.warn("Failed to load highlight.js theme:", error);
  }
};

const loadCore = (): Promise<HLJSApi> => {
  corePromise ??= import("highlight.js/lib/core").then((module) => module.default);
  return corePromise;
};

const loadCommonLanguage = (language: CommonLanguage): Promise<HLJSApi> => {
  const existingPromise = registeredLanguagePromises.get(language);
  if (existingPromise) {
    return existingPromise;
  }

  const languagePromise = Promise.all([loadCore(), commonLanguageLoaders[language]()]).then(([hljs, languageModule]) => {
    if (!hljs.getLanguage(language)) {
      hljs.registerLanguage(language, languageModule.default);
    }
    return hljs;
  });
  registeredLanguagePromises.set(language, languagePromise);
  return languagePromise;
};

const loadFullBuild = (): Promise<HLJSApi> => {
  fullBuildPromise ??= import("highlight.js").then((module) => module.default);
  return fullBuildPromise;
};

export const highlightCode = async (code: string, language: string): Promise<string> => {
  const normalizedLanguage = language.trim().toLowerCase();
  if (isPlainTextLanguage(normalizedLanguage)) {
    return escapeHTML(code);
  }

  const canonicalLanguage =
    languageAliases[normalizedLanguage] ??
    (Object.hasOwn(commonLanguageLoaders, normalizedLanguage) ? (normalizedLanguage as CommonLanguage) : undefined);

  const hljs = canonicalLanguage ? await loadCommonLanguage(canonicalLanguage) : await loadFullBuild();
  const languageToHighlight = canonicalLanguage ?? normalizedLanguage;
  if (!hljs.getLanguage(languageToHighlight)) {
    return escapeHTML(code);
  }

  return hljs.highlight(code, { language: languageToHighlight }).value;
};
