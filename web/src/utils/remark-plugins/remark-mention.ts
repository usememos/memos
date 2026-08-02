import type { Root, Text } from "mdast";
import type { Node as UnistNode } from "unist";
import { visit } from "unist-util-visit";
import type { MentionNode, MentionNodeData } from "@/types/markdown";
import { isMentionChar, MAX_MENTION_LENGTH } from "@/utils/mention-grammar";

function isMentionBoundary(char: string): boolean {
  if (!char) return true;
  return !isMentionChar(char);
}

type Segment = { type: "text"; value: string } | { type: "mention"; value: string };

export function parseMentionsFromText(text: string, leadingChar = ""): Segment[] {
  const segments: Segment[] = [];
  const chars = [...text];
  let i = 0;

  const appendText = (value: string) => {
    const previous = segments.at(-1);
    if (previous?.type === "text") {
      previous.value += value;
    } else {
      segments.push({ type: "text", value });
    }
  };

  while (i < chars.length) {
    const prevChar = i > 0 ? chars[i - 1] : leadingChar;
    if (chars[i] === "@" && isMentionBoundary(prevChar) && i + 1 < chars.length && isMentionChar(chars[i + 1])) {
      let j = i + 1;
      while (j < chars.length && isMentionChar(chars[j]) && j - i - 1 < MAX_MENTION_LENGTH) {
        j++;
      }

      const username = chars.slice(i + 1, j).join("");
      const isOverlong = j < chars.length && isMentionChar(chars[j]);
      const hasLetterOrNumber = [...username].some((char) => /[A-Za-z0-9]/.test(char));
      if (username && !isOverlong && hasLetterOrNumber) {
        segments.push({ type: "mention", value: username.toLowerCase() });
        i = j;
        continue;
      }
    }

    let j = i + 1;
    while (j < chars.length && chars[j] !== "@") {
      j++;
    }
    appendText(chars.slice(i, j).join(""));
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

function trailingText(node: UnistNode | undefined): string {
  if (!node) return "";
  if (node.type === "text") return (node as Text).value;
  const nodeChildren = (node as { children?: UnistNode[] }).children;
  if (nodeChildren?.length) return trailingText(nodeChildren.at(-1));
  const children = (node.data as { hChildren?: Array<{ type?: string; value?: string }> } | undefined)?.hChildren;
  const last = children?.at(-1);
  return last?.type === "text" ? (last.value ?? "") : "";
}

function previousSourceCharacter(source: string, offset: number): string {
  return [...source.slice(Math.max(0, offset - 2), offset)].at(-1) ?? "";
}

function synthesizedLiteralTrailingText(node: UnistNode | undefined, source: string): string {
  if (!node) return "";
  if (node.type === "tagNode" || node.type === "mentionNode") return trailingText(node);
  if (node.type !== "link" || !(node as { url?: string }).url?.startsWith("mailto:")) return "";

  const rendered = trailingText(node);
  const from = node.position?.start.offset;
  const to = node.position?.end.offset;
  if (from !== undefined && to !== undefined && source.slice(from, to) !== rendered) {
    // Explicit links and autolinks end in Markdown syntax (`)` or `>`), which
    // is the mention boundary. Only a literal GFM email contributes its final
    // rendered character across an mdast child boundary.
    return "";
  }
  return rendered;
}

function leadingCharacter(parent: UnistNode, index: number, node: Text, source: string): string {
  const previous = (parent as { children?: UnistNode[] }).children?.[index - 1];
  if (!previous) return "";

  const currentFrom = node.position?.start.offset;
  const previousTo = previous.position?.end.offset;
  if (currentFrom !== undefined && previousTo === currentFrom) {
    // Use the actual source boundary instead of text rendered by an arbitrary
    // preceding node. Formatting and link delimiters are meaningful mention
    // boundaries even though they are not present in rendered text.
    return previousSourceCharacter(source, currentFrom);
  }

  return [...synthesizedLiteralTrailingText(previous, source)].at(-1) ?? "";
}

type VFileLike = { value?: string | Uint8Array };

export const remarkMention = () => {
  return (tree: Root, file: VFileLike) => {
    const source = typeof file.value === "string" ? file.value : "";
    visit(tree, (node, index, parent) => {
      if (node.type !== "text" || !parent || parent.type === "link" || typeof index !== "number") return;

      const textNode = node as Text;
      const segments = parseMentionsFromText(textNode.value, leadingCharacter(parent, index, textNode, source));
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

      (parent.children as UnistNode[]).splice(index, 1, ...(newNodes as UnistNode[]));
    });
  };
};
