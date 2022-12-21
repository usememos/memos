import { blockElementParserList, inlineElementParserList } from "./parser";

export const marked = (markdownStr: string, blockParsers = blockElementParserList, inlineParsers = inlineElementParserList): string => {
  for (const parser of blockParsers) {
    const matchResult = parser.matcher(markdownStr);
    if (!matchResult) {
      continue;
    }
    const matchedStr = matchResult[0];
    const retainContent = markdownStr.slice(matchedStr.length);

    if (parser.name === "br") {
      return parser.renderer(matchedStr) + marked(retainContent, blockParsers, inlineParsers);
    } else {
      if (retainContent === "") {
        return parser.renderer(matchedStr);
      } else if (retainContent.startsWith("\n")) {
        return parser.renderer(matchedStr) + marked(retainContent.slice(1), blockParsers, inlineParsers);
      }
    }
  }

  let matchedInlineParser = undefined;
  let matchedIndex = -1;

  for (const parser of inlineParsers) {
    const matchResult = parser.matcher(markdownStr);
    if (!matchResult) {
      continue;
    }

    if (parser.name === "plain text" && matchedInlineParser !== undefined) {
      continue;
    }

    const startIndex = matchResult.index as number;
    if (matchedInlineParser === undefined || matchedIndex > startIndex) {
      matchedInlineParser = parser;
      matchedIndex = startIndex;
    }
  }

  if (matchedInlineParser) {
    const matchResult = matchedInlineParser.matcher(markdownStr);
    if (matchResult) {
      const matchedStr = matchResult[0];
      const matchedLength = matchedStr.length;
      const prefixStr = markdownStr.slice(0, matchedIndex);
      const suffixStr = markdownStr.slice(matchedIndex + matchedLength);
      return prefixStr + matchedInlineParser.renderer(matchedStr) + marked(suffixStr, [], inlineParsers);
    }
  }

  return markdownStr;
};
