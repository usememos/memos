import { GFM, type MarkdownConfig, type MarkdownExtension } from "@lezer/markdown";

function openingMathFenceSize(line: { text: string; pos: number }): number | undefined {
  let end = line.pos;
  while (line.text.charCodeAt(end) === 0x24) end++;
  const size = end - line.pos;
  if (size < 2 || line.text.indexOf("$", end) >= 0) return undefined;
  return size;
}

function isClosingMathFence(line: { text: string; pos: number; skipSpace(from: number): number }, openingSize: number): boolean {
  let end = line.pos;
  while (line.text.charCodeAt(end) === 0x24) end++;
  return end - line.pos >= openingSize && line.skipSpace(end) === line.text.length;
}

function isWhitespace(character: number): boolean {
  return character < 0 || /\p{White_Space}/u.test(String.fromCharCode(character));
}

function isDigit(character: number): boolean {
  return character >= 0x30 && character <= 0x39;
}

const mathExtension: MarkdownConfig = {
  defineNodes: ["InlineMath", "MathMark", { name: "BlockMath", block: true }],
  parseBlock: [
    {
      name: "BlockMath",
      parse(context, line) {
        const openingSize = openingMathFenceSize(line);
        if (!openingSize) return false;

        const from = context.lineStart + line.pos;
        // This is the same scope guard used by Lezer's fenced-code parser. It
        // keeps an unclosed math block inside its current list or blockquote.
        const activeDepth = context.depth;
        while (context.nextLine() && (line as typeof line & { depth: number }).depth >= activeDepth) {
          if (isClosingMathFence(line, openingSize)) {
            context.nextLine();
            break;
          }
        }
        context.addElement(context.elt("BlockMath", from, context.prevLineEnd()));
        return true;
      },
      endLeaf(_context, line) {
        return openingMathFenceSize(line) !== undefined;
      },
      before: "FencedCode",
    },
  ],
  parseInline: [
    {
      name: "InlineMath",
      parse(context, next, position) {
        if (next !== 0x24) return -1;

        let openingEnd = position + 1;
        while (context.char(openingEnd) === 0x24) openingEnd++;
        const openingSize = openingEnd - position;
        if (openingSize === 1 && isWhitespace(context.char(openingEnd))) return openingEnd;

        for (let cursor = openingEnd; cursor < context.end; ) {
          if (context.char(cursor) !== 0x24) {
            cursor++;
            continue;
          }
          let closingEnd = cursor + 1;
          while (context.char(closingEnd) === 0x24) closingEnd++;
          const closingSize = closingEnd - cursor;
          if (closingSize === openingSize) {
            if (openingSize === 1 && (isWhitespace(context.char(cursor - 1)) || isDigit(context.char(closingEnd)))) return openingEnd;
            return context.addElement(
              context.elt("InlineMath", position, closingEnd, [
                context.elt("MathMark", position, openingEnd),
                context.elt("MathMark", cursor, closingEnd),
              ]),
            );
          }
          cursor = closingEnd;
        }
        // An unmatched opener is ordinary text. Consume the complete run so
        // a later dollar cannot reinterpret its tail as a shorter opener.
        return openingEnd;
      },
      after: "Escape",
    },
  ],
};

/** GFM plus the opaque dollar-math nodes understood by the memo renderer. */
export const memoMarkdownExtensions: MarkdownExtension = [GFM, mathExtension];
