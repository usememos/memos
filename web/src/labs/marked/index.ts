import { blockElementParserList, inlineElementParserList } from "./parser";

const match = (rawStr: string, regex: RegExp): number => {
  const matchResult = rawStr.match(regex);
  if (!matchResult) {
    return 0;
  }

  const matchStr = matchResult[0];
  return matchStr.length;
};

export const marked = (markdownStr: string, blockParsers = blockElementParserList, inlineParsers = inlineElementParserList): string => {
  for (const parser of blockParsers) {
    const startIndex = markdownStr.search(parser.regex);
    const matchedLength = match(markdownStr, parser.regex);

    if (startIndex > -1 && matchedLength > 0) {
      const prefixStr = markdownStr.slice(0, startIndex);
      const matchedStr = markdownStr.slice(startIndex, startIndex + matchedLength);
      const suffixStr = markdownStr.slice(startIndex + matchedLength);
      return marked(prefixStr, blockParsers, inlineParsers) + parser.renderer(matchedStr) + marked(suffixStr, blockParsers, inlineParsers);
    }
  }

  let matchedInlineParser = undefined;
  let matchedIndex = -1;

  for (const parser of inlineElementParserList) {
    if (parser.name === "plain text" && matchedInlineParser !== undefined) {
      continue;
    }

    const startIndex = markdownStr.search(parser.regex);
    const matchedLength = match(markdownStr, parser.regex);

    if (startIndex > -1 && matchedLength > 0) {
      if (!matchedInlineParser || matchedIndex > startIndex) {
        matchedIndex = startIndex;
        matchedInlineParser = parser;
      }
    }
  }

  if (matchedInlineParser) {
    const matchedLength = match(markdownStr, matchedInlineParser.regex);
    const prefixStr = markdownStr.slice(0, matchedIndex);
    const matchedStr = markdownStr.slice(matchedIndex, matchedIndex + matchedLength);
    const suffixStr = markdownStr.slice(matchedIndex + matchedLength);
    return prefixStr + matchedInlineParser.renderer(matchedStr) + marked(suffixStr, [], inlineParsers);
  }

  return markdownStr;
};
