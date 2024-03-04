import { Node, TagNode } from "@/types/node";

export const TAG_REG = /#([^\s#,]+)/;

// extractTagsFromContent extracts tags from content.
export const extractTagsFromContent = (content: string) => {
  const nodes = window.parse(content);
  const tags = new Set<string>();

  const traverse = (nodes: Node[], handle: (node: Node) => void) => {
    for (const node of nodes) {
      if (!node) {
        continue;
      }

      handle(node);
      if (node.type === "PARAGRAPH" || node.type === "ORDERED_LIST" || node.type === "UNORDERED_LIST") {
        const children = (node.value as any).children;
        if (Array.isArray(children)) {
          traverse(children, handle);
        }
      }
    }
  };

  traverse(nodes, (node) => {
    if (node.type === "TAG" && node.value) {
      tags.add((node.value as TagNode).content);
    }
  });

  return Array.from(tags);
};
