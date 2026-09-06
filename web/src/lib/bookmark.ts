/** Accepts only absolute web URLs for bookmark capture and import. */
export const isValidBookmarkUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

/** Encodes Markdown delimiters consistently for link storage and import duplicate detection. */
export const normalizeBookmarkUrl = (url: string): string =>
  url.trim().replace(/[\s()<>\\]/g, (character) => encodeURIComponent(character).replace(/\(/g, "%28").replace(/\)/g, "%29"));

/** Serializes captured text without allowing titles to inject Markdown links or formatting. */
export const buildBookmarkContent = (url: string, title: string, tags: readonly string[]): string => {
  if (!isValidBookmarkUrl(url)) return "";
  const destination = normalizeBookmarkUrl(url);
  const label = title
    .trim()
    .replace(/[\r\n]+/g, " ")
    .replace(/[\\`*_[\]<>!]/g, "\\$&");
  const link = label ? `[${label}](${destination})` : destination;
  const tagString = tags
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean)
    .map((tag) => `#${tag}`)
    .join(" ");
  return tagString ? `${link} ${tagString}` : link;
};
