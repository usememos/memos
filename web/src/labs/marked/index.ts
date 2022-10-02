import { parserList } from "./parser";

export const marked = (markdownStr: string, parsers = parserList) => {
  for (const parser of parsers) {
    const startIndex = markdownStr.search(parser.regex);
    const matchedLength = parser.match(markdownStr);

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
