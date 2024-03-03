import { Node } from "@/types/node";

export const TAG_REG = /#([^\s#,]+)/;

// extractTagsFromNodes extracts tags from nodes.
export const extractTagsFromNodes = (nodes: Node[]) => {
  const tags = new Set<string>();

  const traverse = (nodes: Node[], handle: (node: Node) => void) => {
    for (const node of nodes) {
      if (!node) {
        continue;
      }

      handle(node);
      if (node.type === "PARAGRAPH" || node.type === "ORDERED_LIST" || node.type === "UNORDERED_LIST") {
        const children = (node.node as any).children;
        if (Array.isArray(children)) {
          traverse(children, handle);
        }
      }
    }
  };

  traverse(nodes, (node) => {
    if (node.type === "TAG" && node.node) {
      tags.add((node.node as any).content);
    }
  });

  return Array.from(tags);
};
