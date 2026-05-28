import type { Root, Text } from "mdast";
import type { Node as UnistNode } from "unist";
import { visit } from "unist-util-visit";
import type { MentionNode, MentionNodeData } from "@/types/markdown";

const MAX_MENTION_LENGTH = 32;

function isMentionChar(char: string): boolean {
  return /[A-Za-z0-9-]/.test(char);
}

function isMentionBoundary(char: string): boolean {
  if (!char) return true;
  return !isMentionChar(char);
}

type Segment = { type: "text"; value: string } | { type: "mention"; value: string };

export function parseMentionsFromText(text: string): Segment[] {
  const segments: Segment[] = [];
  const chars = [...text];
  let i = 0;

  while (i < chars.length) {
    const prevChar = i > 0 ? chars[i - 1] : "";
    if (chars[i] === "@" && isMentionBoundary(prevChar) && i + 1 < chars.length && isMentionChar(chars[i + 1])) {
      let j = i + 1;
      while (j < chars.length && isMentionChar(chars[j]) && j - i - 1 < MAX_MENTION_LENGTH) {
        j++;
      }

      const username = chars.slice(i + 1, j).join("");
      const hasLetterOrNumber = [...username].some((char) => /[A-Za-z0-9]/.test(char));
      if (username && hasLetterOrNumber) {
        segments.push({ type: "mention", value: username.toLowerCase() });
        i = j;
        continue;
      }
    }

    let j = i + 1;
    while (j < chars.length && chars[j] !== "@") {
      j++;
    }
    segments.push({ type: "text", value: chars.slice(i, j).join("") });
    i = j;
  }

  return segments;
}

export function extractMentionUsernames(text: string): string[] {
  const usernames = parseMentionsFromText(text)
    .filter((segment): segment is { type: "mention"; value: string } => segment.type === "mention")
    .map((segment) => segment.value);
  return Array.from(new Set(usernames));
}

function createMentionNode(username: string): MentionNode {
  const data: MentionNodeData = {
    hName: "span",
    hProperties: {
      className: "mention",
      "data-mention": username,
    },
    hChildren: [{ type: "text", value: `@${username}` }],
  };

  return {
    type: "mentionNode",
    value: username,
    data,
  } as MentionNode;
}

export const remarkMention = () => {
  return (tree: Root) => {
    visit(tree, (node, index, parent) => {
      if (node.type !== "text" || !parent || index === null) return;

      const textNode = node as Text;
      const segments = parseMentionsFromText(textNode.value);
      if (segments.every((segment) => segment.type === "text")) {
        return;
      }

      const newNodes = segments.map((segment) => {
        if (segment.type === "mention") {
          return createMentionNode(segment.value);
        }
        return {
          type: "text",
          value: segment.value,
        } as Text;
      });

      if (typeof index === "number") {
        (parent.children as UnistNode[]).splice(index, 1, ...(newNodes as UnistNode[]));
      }
    });
  };
};
