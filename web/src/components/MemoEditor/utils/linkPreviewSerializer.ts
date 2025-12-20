import type { LinkPreview } from "@/components/memo-metadata";

const PREVIEW_REGEX = /<div[^>]*data-memo-link-preview=["']true["'][^>]*><\/div>/gi;

export function serializeLinkPreviews(previews: LinkPreview[]): string {
  return previews
    .map((preview) => {
      const attrs = [
        `data-memo-link-preview="true"`,
        `data-id="${escapeAttribute(preview.id)}"`,
        `data-url="${escapeAttribute(preview.url)}"`,
        `data-title="${escapeAttribute(preview.title)}"`,
        `data-description="${escapeAttribute(preview.description)}"`,
        `data-image="${escapeAttribute(preview.imageUrl)}"`,
        `data-site="${escapeAttribute(preview.siteName || "")}"`,
      ];
      return `<div class="memo-link-preview" ${attrs.join(" ")}></div>`;
    })
    .join("\n\n");
}

export function appendLinkPreviewsToContent(content: string, previews: LinkPreview[]): string {
  if (previews.length === 0) return content;
  const serialized = serializeLinkPreviews(previews);
  const trimmedContent = content.trimEnd();
  if (!trimmedContent.trim()) return serialized;
  return `${trimmedContent}\n\n${serialized}`;
}

export function extractLinkPreviewsFromContent(content: string): { cleanedContent: string; previews: LinkPreview[] } {
  const matches = content.match(PREVIEW_REGEX) || [];
  const previews: LinkPreview[] = matches.map((snippet) => parsePreviewSnippet(snippet)).filter(Boolean) as LinkPreview[];
  const cleanedContent = content.replace(PREVIEW_REGEX, "").trimEnd();
  return { cleanedContent, previews };
}

function parsePreviewSnippet(snippet: string): LinkPreview | null {
  if (typeof document === "undefined") return null;
  const container = document.createElement("div");
  container.innerHTML = snippet;
  const el = container.firstElementChild as HTMLElement | null;
  if (!el) return null;

  return {
    id: el.getAttribute("data-id") || cryptoId(),
    url: unescapeAttribute(el.getAttribute("data-url") || ""),
    title: unescapeAttribute(el.getAttribute("data-title") || "Link preview"),
    description: unescapeAttribute(el.getAttribute("data-description") || ""),
    imageUrl: unescapeAttribute(el.getAttribute("data-image") || ""),
    siteName: unescapeAttribute(el.getAttribute("data-site") || ""),
  };
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function unescapeAttribute(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function cryptoId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
}
