import { parserList } from "./parser";

const match = (rawStr: string, regex: RegExp): number => {
  const matchResult = rawStr.match(regex);
  if (!matchResult) {
    return 0;
  }

  const matchStr = matchResult[0];
  return matchStr.length;
};

export const marked = (markdownStr: string, parsers = parserList) => {
  for (const parser of parsers) {
    const startIndex = markdownStr.search(parser.regex);
    const matchedLength = match(markdownStr, parser.regex);

    if (startIndex > -1 && matchedLength > 0) {
      const prefixStr = markdownStr.slice(0, startIndex);
      const matchedStr = markdownStr.slice(startIndex, startIndex + matchedLength);
      const suffixStr = markdownStr.slice(startIndex + matchedLength);
      markdownStr = marked(prefixStr, parsers) + parser.renderer(matchedStr) + marked(suffixStr, parsers);
      break;
    }
  }

  return markdownStr;
};
