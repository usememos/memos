import type { Root } from "mdast";
import { visit } from "unist-util-visit";

/**
 * Remark plugin to preserve original mdast node types in the data field
 *
 * This allows us to check the original node type even after
 * transformation to hast (HTML AST).
 *
 * The original type is stored in data.mdastType and will be available
 * in the hast node as data.mdastType.
 */
export const remarkPreserveType = () => {
  return (tree: Root) => {
    visit(tree, (node: any) => {
      // Skip text nodes and standard element types
      if (node.type === "text" || node.type === "root") {
        return;
      }

      // Preserve the original mdast type in data
      if (!node.data) {
        node.data = {};
      }

      // Store original type for custom node types
      if (node.type !== "paragraph" && node.type !== "heading" && node.type !== "list" && node.type !== "listItem") {
        node.data.mdastType = node.type;
      }
    });
  };
};
