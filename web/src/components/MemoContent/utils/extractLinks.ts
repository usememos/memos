/**
 * Extracts all HTTP/HTTPS URLs from markdown content.
 * Filters out internal memo links, mailto:, and other non-HTTP protocols.
 */
export function extractLinks(content: string): string[] {
  // Match markdown links: [text](url) or autolinks: <url> or plain URLs
  // This regex matches:
  // 1. Markdown links: [text](http://...)
  // 2. Autolinks: <http://...>
  // 3. Plain URLs: http://... or https://...
  const urlRegex = /(?:\[([^\]]+)\]\(([^)]+)\)|<(https?:\/\/[^\s>]+)>|(https?:\/\/[^\s)]+))/gi;

  const links: string[] = [];
  const seen = new Set<string>();

  let match;
  while ((match = urlRegex.exec(content)) !== null) {
    // match[2] = markdown link URL, match[3] = autolink URL, match[4] = plain URL
    const url = match[2] || match[3] || match[4];

    if (url && isValidExternalUrl(url)) {
      const normalizedUrl = normalizeUrl(url);
      if (!seen.has(normalizedUrl)) {
        seen.add(normalizedUrl);
        links.push(normalizedUrl);
      }
    }
  }

  return links;
}

/**
 * Checks if a URL is a valid external HTTP/HTTPS URL.
 * Filters out internal memo links, mailto:, and other protocols.
 */
function isValidExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Only allow http and https
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    // Filter out internal memo links (e.g., /memos/abc123)
    // These are relative URLs that would be parsed as invalid or same-origin
    if (url.startsWith("/") || url.startsWith("./") || url.startsWith("../")) {
      return false;
    }

    return true;
  } catch {
    // Invalid URL format
    return false;
  }
}

/**
 * Normalizes a URL by removing trailing slashes and fragments.
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove fragment (hash)
    parsed.hash = "";
    // Remove trailing slash from pathname (except root)
    if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}
