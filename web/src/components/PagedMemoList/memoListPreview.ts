export interface MemoListPreview {
  title: string;
  description: string;
}

// Block-level markers that carry no reading value in a one-line preview.
const LINE_PREFIX = /^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/;
const FENCE_OR_RULE = /^\s*(?:```|~~~|-{3,}|\*{3,}|_{3,})/;

const toPlainLine = (line: string): string =>
  line
    .replace(LINE_PREFIX, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*|__|~~|`/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Splits memo markdown into a list-row title (first text line) and a one-line description (the rest). */
export const getMemoListPreview = (content: string): MemoListPreview => {
  const lines = content
    .split(/\r?\n/)
    .filter((line) => !FENCE_OR_RULE.test(line))
    .map(toPlainLine)
    .filter(Boolean);
  return { title: lines[0] ?? "", description: lines.slice(1).join(" ") };
};
