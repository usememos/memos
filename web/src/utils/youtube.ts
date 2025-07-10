import { Node, NodeType } from "@/types/proto/api/v1/markdown_service";

// Regular expressions to match various YouTube URL formats.
const YOUTUBE_REGEXPS: RegExp[] = [
  /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([^&\s]+)/i,
  /https?:\/\/(?:www\.)?youtu\.be\/([^?\s]+)/i,
  /https?:\/\/(?:www\.)?youtube\.com\/shorts\/([^?\s]+)/i,
  /https?:\/\/(?:www\.)?youtube\.com\/embed\/([^?\s]+)/i,
];

/**
 * Extract the YouTube video ID from a given URL, if any.
 * @param url The URL string to parse.
 * @returns The video ID, or undefined if the URL is not a YouTube link.
 */
export const extractYoutubeIdFromUrl = (url: string): string | undefined => {
  for (const regexp of YOUTUBE_REGEXPS) {
    const match = url.match(regexp);
    if (match?.[1]) {
      return match[1];
    }
  }
  return undefined;
};

/**
 * Extract YouTube video IDs from markdown nodes.
 * @param nodes The array of markdown nodes to extract YouTube video IDs from.
 * @returns A deduplicated array of YouTube video IDs.
 */
export const extractYoutubeVideoIdsFromNodes = (nodes: Node[]): string[] => {
  const ids = new Set<string>();

  const isNodeArray = (value: unknown): value is Node[] =>
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === "object" &&
    value[0] !== null &&
    "type" in (value[0] as Record<string, unknown>);

  // Collect all child Node instances nested anywhere inside the given node
  const collectChildren = (node: Node): Node[] => {
    const collected: Node[] = [];
    const queue: unknown[] = Object.values(node);

    while (queue.length) {
      const item = queue.shift();
      if (!item) continue;

      if (isNodeArray(item)) {
        collected.push(...item);
        continue;
      }

      if (Array.isArray(item)) {
        queue.push(...item);
      } else if (typeof item === "object") {
        queue.push(...Object.values(item as Record<string, unknown>));
      }
    }

    return collected;
  };

  const stack: Node[] = [...nodes];

  while (stack.length) {
    const node = stack.pop()!;

    if (node.type === NodeType.LINK && node.linkNode) {
      const id = extractYoutubeIdFromUrl(node.linkNode.url);
      if (id) ids.add(id);
    } else if (node.type === NodeType.AUTO_LINK && node.autoLinkNode) {
      const id = extractYoutubeIdFromUrl(node.autoLinkNode.url);
      if (id) ids.add(id);
    }

    const children = collectChildren(node);
    if (children.length) {
      stack.push(...children);
    }
  }

  return [...ids];
};
