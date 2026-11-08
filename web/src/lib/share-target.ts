/** What another app hands over through the Web Share Target API (`share_target` in `site.webmanifest`). */
export interface SharedData {
  title?: string | null;
  text?: string | null;
  url?: string | null;
}

/**
 * The Markdown a shared item starts a memo with: the title, the text and the URL, each
 * on its own paragraph. Apps differ in which field they fill, and many repeat the page
 * title or the link inside `text`, so a field the text already contains as a whole is
 * dropped: a title only as whole words, a URL only where the link ends.
 */
export const sharedDataToMarkdown = ({ title, text, url }: SharedData): string => {
  const body = text?.trim() ?? "";
  const heading = title?.trim() ?? "";
  const link = url?.trim() ?? "";
  const parts = [
    heading && !containsWhole(body, heading, isWordBoundary) ? heading : "",
    body,
    link && !containsWhole(body, link, isUrlEnd) ? link : "",
  ];
  return parts.filter(Boolean).join("\n\n");
};

/** Whether `value` occurs in `text` at a position `isBoundary` accepts. */
const containsWhole = (text: string, value: string, isBoundary: (text: string, start: number, end: number) => boolean): boolean => {
  for (let start = text.indexOf(value); start !== -1; start = text.indexOf(value, start + 1)) {
    if (isBoundary(text, start, start + value.length)) return true;
  }
  return false;
};

const WORD_CHARACTER = /[\p{L}\p{N}\p{M}_]/u;

/** A title counts as contained only as whole words: "Go" is not in "Going home". */
const isWordBoundary = (text: string, start: number, end: number): boolean =>
  !WORD_CHARACTER.test(text.charAt(start - 1)) && !WORD_CHARACTER.test(text.charAt(end));

/**
 * A URL counts as contained only where the link in the text ends with it: at the end, at
 * whitespace, before a closing bracket or quote, or before sentence punctuation that the
 * text does not continue. `https://example.com/a` is not in `https://example.com/ab`.
 */
const isUrlEnd = (text: string, _start: number, end: number): boolean => {
  const next = text.charAt(end);
  if (next === "" || /\s/.test(next) || /[)\]>"']/.test(next)) return true;
  const after = text.charAt(end + 1);
  return /[.,;:!?]/.test(next) && (after === "" || /\s/.test(after));
};

/** Reads a shared item from the share target's query string. */
export const sharedDataFromSearch = (search: string): SharedData => {
  const params = new URLSearchParams(search);
  return { title: params.get("title"), text: params.get("text"), url: params.get("url") };
};
