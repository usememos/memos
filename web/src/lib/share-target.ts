/** What another app hands over through the Web Share Target API (`share_target` in `site.webmanifest`). */
export interface SharedData {
  title?: string | null;
  text?: string | null;
  url?: string | null;
}

/**
 * The Markdown a shared item starts a memo with: the title, the text and the URL, each
 * on its own paragraph. Apps differ in which field they fill, and many repeat the page
 * title or the link inside `text`, so a field the text already contains is dropped.
 */
export const sharedDataToMarkdown = ({ title, text, url }: SharedData): string => {
  const body = text?.trim() ?? "";
  const heading = title?.trim() ?? "";
  const link = url?.trim() ?? "";
  const parts = [heading && !body.includes(heading) ? heading : "", body, link && !body.includes(link) ? link : ""];
  return parts.filter(Boolean).join("\n\n");
};

/** Reads a shared item from the share target's query string. */
export const sharedDataFromSearch = (search: string): SharedData => {
  const params = new URLSearchParams(search);
  return { title: params.get("title"), text: params.get("text"), url: params.get("url") };
};
