import type { Root } from "mdast";
import { visit } from "unist-util-visit";
import type { ExtendedData } from "@/types/markdown";

const STANDARD_NODE_TYPES = new Set(["text", "root", "paragraph", "heading", "list", "listItem"]);

export const remarkPreserveType = () => {
  return (tree: Root) => {
    visit(tree, (node) => {
      if (STANDARD_NODE_TYPES.has(node.type)) {
        return;
      }

      if (!node.data) {
        node.data = {};
      }

      const data = node.data as ExtendedData;
      data.mdastType = node.type;
    });
  };
};
