import type { Root, Text } from "mdast";
import type { Node as UnistNode } from "unist";
import { visit } from "unist-util-visit";
import type { TagNode, TagNodeData } from "@/types/markdown";

const MAX_TAG_LENGTH = 100;

function isTagChar(char: string): boolean {
  if (/\p{L}/u.test(char)) {
    return true;
  }

  if (/\p{N}/u.test(char)) {
    return true;
  }

  if (/\p{S}/u.test(char)) {
    return true;
  }

  return char === "_" || char === "-" || char === "/";
}

function parseTagsFromText(text: string): Array<{ type: "text"; value: string } | { type: "tag"; value: string }> {
  const segments: Array<{ type: "text"; value: string } | { type: "tag"; value: string }> = [];

  const chars = [...text];
  let i = 0;

  while (i < chars.length) {
    if (chars[i] === "#" && i + 1 < chars.length && isTagChar(chars[i + 1])) {
      const prevChar = i > 0 ? chars[i - 1] : "";
      const nextChar = i + 1 < chars.length ? chars[i + 1] : "";

      if (prevChar === "#" || nextChar === "#" || nextChar === " ") {
        segments.push({ type: "text", value: chars[i] });
        i++;
        continue;
      }

      let j = i + 1;
      while (j < chars.length && isTagChar(chars[j])) {
        j++;
      }

      const tagContent = chars.slice(i + 1, j).join("");

      const runeCount = [...tagContent].length;
      if (runeCount > 0 && runeCount <= MAX_TAG_LENGTH) {
        segments.push({ type: "tag", value: tagContent });
        i = j;
        continue;
      }
    }

    let j = i + 1;
    while (j < chars.length && chars[j] !== "#") {
      j++;
    }
    segments.push({ type: "text", value: chars.slice(i, j).join("") });
    i = j;
  }

  return segments;
}

function createTagNode(tagValue: string): TagNode {
  const data: TagNodeData = {
    hName: "span",
    hProperties: {
      className: "tag",
      "data-tag": tagValue,
    },
    hChildren: [{ type: "text", value: `#${tagValue}` }],
  };

  return {
    type: "tagNode",
    value: tagValue,
    data,
  } as TagNode;
}

export const remarkTag = () => {
  return (tree: Root) => {
    visit(tree, (node, index, parent) => {
      if (node.type !== "text" || !parent || index === null) return;

      const textNode = node as Text;
      const text = textNode.value;
      const segments = parseTagsFromText(text);

      if (segments.every((seg) => seg.type === "text")) {
        return;
      }

      const newNodes = segments.map((segment) => {
        if (segment.type === "tag") {
          return createTagNode(segment.value);
        }
        return {
          type: "text",
          value: segment.value,
        } as Text;
      });

      if (typeof index === "number" && parent) {
        (parent.children as UnistNode[]).splice(index, 1, ...(newNodes as UnistNode[]));
      }
    });
  };
};
