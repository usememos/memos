import type { Element, Root } from "hast";
import { visit } from "unist-util-visit";
import { slugify } from "@/utils/markdown-manipulation";

function getTextContent(node: Element): string {
  let text = "";
  for (const child of node.children) {
    if (child.type === "text") {
      text += child.value;
    } else if (child.type === "element") {
      text += getTextContent(child);
    }
  }
  return text;
}

/** Rehype plugin that adds unique slugified `id` attributes to heading elements. */
export const rehypeHeadingId = () => {
  return (tree: Root) => {
    const slugCounts = new Map<string, number>();

    visit(tree, "element", (node: Element) => {
      if (!/^h[1-6]$/.test(node.tagName)) return;

      const text = getTextContent(node);
      let slug = slugify(text);
      if (!slug) return;

      const count = slugCounts.get(slug) || 0;
      slugCounts.set(slug, count + 1);
      if (count > 0) slug = `${slug}-${count}`;

      node.properties = node.properties || {};
      node.properties.id = slug;
    });
  };
};
