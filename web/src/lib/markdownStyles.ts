import { cn } from "@/lib/utils";

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** Per-level heading classes (size / weight / border), matching MemoContent. */
const headingLevelClasses: Record<HeadingLevel, string> = {
  1: "text-3xl font-bold border-b border-border pb-2",
  2: "text-2xl font-semibold border-b border-border pb-1.5",
  3: "text-xl font-semibold",
  4: "text-lg font-semibold",
  5: "text-base font-semibold",
  6: "text-base font-medium text-muted-foreground",
};

/** Shared base classes applied to every heading level. */
const headingBaseClasses = "mt-3 mb-2 leading-tight";

/**
 * Complete heading class per level, precomputed once at module load (base +
 * per-level). headingClass is a hot path — MemoContent renders it per heading
 * on every content render — so the cn() merge happens here, not per call.
 */
const headingClasses: Record<HeadingLevel, string> = {
  1: cn(headingBaseClasses, headingLevelClasses[1]),
  2: cn(headingBaseClasses, headingLevelClasses[2]),
  3: cn(headingBaseClasses, headingLevelClasses[3]),
  4: cn(headingBaseClasses, headingLevelClasses[4]),
  5: cn(headingBaseClasses, headingLevelClasses[5]),
  6: cn(headingBaseClasses, headingLevelClasses[6]),
};

/**
 * Single source of truth for the styling of common markdown elements rendered
 * by the read-only memo view (MemoContent). Each value is a complete, standalone
 * Tailwind class string so it can be dropped onto a DOM element as-is (MemoContent
 * merges them with `cn`). The editor does not use these — it styles its raw
 * markdown source via CodeMirror decorations in `MemoEditor/Editor/theme.ts`.
 *
 * These are static string literals so Tailwind's JIT scanner detects them.
 */
export const markdownStyles = {
  paragraph: "my-0 mb-2 leading-6",
  blockquote: "my-0 mb-2 border-l-4 border-primary/30 pl-3 text-muted-foreground italic",
  bulletList: "my-0 mb-2 list-outside pl-6 list-disc",
  orderedList: "my-0 mb-2 list-outside pl-6 list-decimal",
  listItem: "mt-0.5 leading-6",
  // Shared by the read-only task item (MemoContent/markdown/List.tsx) and the
  // editor so the checkbox + text grid stays identical in both.
  taskListItem: "mt-0.5 min-w-0 leading-6 list-none grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 [&>[data-slot=checkbox]]:mt-1",
  taskItemContent: "min-w-0 [overflow-wrap:anywhere] [&>*:last-child]:mb-0",
  inlineCode: "font-mono text-sm bg-muted px-1 py-0.5 rounded-md",
  link: "text-primary underline decoration-primary/50 underline-offset-2 transition-colors hover:decoration-primary",
  horizontalRule: "my-2 h-0 border-0 border-b border-border",
} as const;

/** Complete heading class for a given level (shared base + per-level classes). */
export const headingClass = (level: HeadingLevel): string => headingClasses[level];

/**
 * Tag pill styling for the read-only memo view (MemoContent/Tag.tsx). Split into
 * two tokens so the viewer can swap `defaultColor` for an inline custom color.
 * (The editor does not use these; it colors `#tag` source via the
 * `cm-memo-tag` decoration in Editor/theme.ts.)
 */
export const tagStyles = {
  /** Shape, padding, and typography — always applied. */
  base: "inline-flex items-center align-baseline px-1.5 py-0.5 text-[0.9em] leading-none font-normal rounded-full border",
  /** Default theme color, used when no custom tag color is set. */
  defaultColor: "border-primary text-primary bg-primary/15",
} as const;

/**
 * `@mention` styling for the read-only memo view (MemoContent/Mention.tsx).
 * Unlike a tag this is not a pill — it is a primary-colored accent (the read-only
 * view adds `hover:underline` for its link). (The editor does not use these; it
 * colors `@mention` source via the `cm-memo-mention` decoration in
 * Editor/theme.ts.)
 */
export const mentionStyles = {
  base: "text-primary underline-offset-2",
} as const;
