import { markdownServiceClient } from "@/grpcweb";
import { Node, NodeType, TagNode } from "@/types/proto/api/v1/markdown_service";

export const TAG_REG = /#([^\s#,]+)/;

// extractTagsFromContent extracts tags from content.
export const extractTagsFromContent = async (content: string) => {
  const { nodes } = await markdownServiceClient.parseMarkdown({ markdown: content });
  const tags = new Set<string>();

  const traverse = (nodes: Node[], handle: (node: Node) => void) => {
    for (const node of nodes) {
      if (!node) {
        continue;
      }

      handle(node);
      if (node.type === "PARAGRAPH" || node.type === "ORDERED_LIST" || node.type === "UNORDERED_LIST") {
        const children = node.paragraphNode?.children || node.orderedListNode?.children || node.unorderedListNode?.children;
        if (Array.isArray(children)) {
          traverse(children, handle);
        }
      }
    }
  };

  traverse(nodes, (node) => {
    if (node.type === NodeType.TAG && node.tagNode) {
      tags.add((node.tagNode as TagNode).content);
    }
  });

  return Array.from(tags);
};
