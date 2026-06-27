import type { Root, Text } from "mdast";
import type { Position, Node as UnistNode } from "unist";
import type { TagNode, TagNodeData } from "@/types/markdown";
import { isTagChar, MAX_TAG_LENGTH } from "@/utils/tag-grammar";

type Segment = { type: "text"; value: string } | { type: "tag"; value: string };

// CommonMark "ASCII punctuation": the only characters a leading backslash can
// escape. A backslash before anything else is a literal backslash.
function isAsciiPunctuation(char: string): boolean {
  if (char.length !== 1) {
    return false;
  }
  const code = char.charCodeAt(0);
  return (
    (code >= 0x21 && code <= 0x2f) || // ! " # $ % & ' ( ) * + , - . /
    (code >= 0x3a && code <= 0x40) || // : ; < = > ? @
    (code >= 0x5b && code <= 0x60) || // [ \ ] ^ _ `
    (code >= 0x7b && code <= 0x7e) //    { | } ~
  );
}

/**
 * Apply CommonMark backslash-unescaping to a raw source slice, tracking which
 * resulting characters came from an escape. `\#` yields a `#` flagged escaped,
 * so the tag lexer can tell a deliberately-escaped hash from a real tag.
 * Returns code points (not UTF-16 units) so astral characters stay intact.
 */
function unescapeBackslashes(source: string): { chars: string[]; escaped: boolean[] } {
  const codePoints = [...source];
  const chars: string[] = [];
  const escaped: boolean[] = [];

  for (let i = 0; i < codePoints.length; i++) {
    if (codePoints[i] === "\\" && i + 1 < codePoints.length && isAsciiPunctuation(codePoints[i + 1])) {
      chars.push(codePoints[i + 1]);
      escaped.push(true);
      i++;
      continue;
    }
    chars.push(codePoints[i]);
    escaped.push(false);
  }

  return { chars, escaped };
}

/**
 * Split a run of characters into text/tag segments. `escaped[i]` marks a
 * character that came from a backslash escape: an escaped `#` can never start a
 * tag (so `\#NAS` stays literal text), matching the backend goldmark parser and
 * the editor's marked tokenizer, both of which honor the escape natively.
 */
function parseSegments(chars: string[], escaped: boolean[]): Segment[] {
  const segments: Segment[] = [];
  let i = 0;

  while (i < chars.length) {
    if (chars[i] === "#" && !escaped[i] && i + 1 < chars.length && isTagChar(chars[i + 1])) {
      const prevChar = i > 0 ? chars[i - 1] : "";
      const nextChar = chars[i + 1];

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

    // Consume a plain-text run up to the next tag-eligible (non-escaped) hash.
    let j = i + 1;
    while (j < chars.length && !(chars[j] === "#" && !escaped[j])) {
      j++;
    }
    segments.push({ type: "text", value: chars.slice(i, j).join("") });
    i = j;
  }

  return segments;
}

/**
 * Segment a text node, preferring the original source slice (where escapes are
 * still visible) over the post-escape `value`. The source-derived parse is only
 * trusted when it reconstructs `value` byte-for-byte; otherwise — entity
 * references, missing positions, upstream rewrites — we fall back to the
 * value-based parse, which is exactly the pre-escape-support behavior. This
 * makes escape support strictly additive: it never changes a node it can't
 * faithfully account for.
 */
function segmentsForTextNode(value: string, position: Position | undefined, source: string): Segment[] {
  const startOffset = position?.start?.offset;
  const endOffset = position?.end?.offset;

  if (source && startOffset != null && endOffset != null) {
    const slice = source.slice(startOffset, endOffset);
    const { chars, escaped } = unescapeBackslashes(slice);
    if (chars.join("") === value) {
      return parseSegments(chars, escaped);
    }
  }

  const chars = [...value];
  return parseSegments(
    chars,
    chars.map(() => false),
  );
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

type ParentNode = UnistNode & { children: UnistNode[] };

function isParentNode(node: UnistNode): node is ParentNode {
  return Array.isArray((node as { children?: unknown }).children);
}

function isLinkNode(node: UnistNode): boolean {
  return node.type === "link" || node.type === "linkReference";
}

function transformTagTextNodes(parent: ParentNode, insideLink: boolean, source: string): void {
  for (let index = 0; index < parent.children.length; index++) {
    const child = parent.children[index];
    const childInsideLink = insideLink || isLinkNode(child);

    if (child.type === "text" && !childInsideLink) {
      const textNode = child as Text;
      const segments = segmentsForTextNode(textNode.value, textNode.position, source);

      if (segments.every((seg) => seg.type === "text")) {
        continue;
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

      parent.children.splice(index, 1, ...(newNodes as UnistNode[]));
      index += newNodes.length - 1;
      continue;
    }

    if (isParentNode(child)) {
      transformTagTextNodes(child, childInsideLink, source);
    }
  }
}

type VFileLike = { value?: string | Uint8Array };

export const remarkTag = () => {
  return (tree: Root, file: VFileLike) => {
    const source = typeof file?.value === "string" ? file.value : "";
    transformTagTextNodes(tree as ParentNode, false, source);
  };
};
