import { CSSProperties } from "react";
import { inlineElementParserList } from ".";
import { marked } from "..";
import { matcher } from "../matcher";

export const TABLE_REG = /^((?:\|[^|\r\n]+)+)\|\r?\n((?:[ -:]*\|[ -:]*)+)((?:\r?\n\|[^\r\n]+)+)/;

const splitMarkdownTablePipes = (lineString: string) => {
  // should take care of escaped pipes, like
  // | aaaa | bbbb | cc\|cc |
  // will return:
  // ["aaaa", "bbbb", "cc|cc"]
  return (lineString.match(/(?:\\\||[^|])+/g) || []).map((s) => s.replaceAll("\\|", "|"));
};

const renderer = (rawStr: string) => {
  const matchResult = matcher(rawStr, TABLE_REG);
  if (!matchResult) {
    return rawStr;
  }
  const headerContents = splitMarkdownTablePipes(matchResult[1]);
  const columnStyles: CSSProperties[] = splitMarkdownTablePipes(matchResult[2]).map((cell) => {
    const left = cell.trim().startsWith(":");
    const right = cell.trim().endsWith(":");
    // github markdown spec says that by default, content is left aligned
    return {
      textAlign: left && right ? "center" : right ? "right" : "left",
    };
  });
  const bodyContents = matchResult[3].split(/\r?\n/).map(splitMarkdownTablePipes);

  return (
    <table>
      <thead>
        <tr>
          {headerContents.map((content, index) => (
            <th key={"th-" + index}>{marked(content, [], inlineElementParserList)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {bodyContents.map((bodyLine, bodyIndex) => (
          <tr key={"tr-" + bodyIndex}>
            {bodyLine.map((content, contentIndex) => (
              <td key={"td-" + bodyIndex + "-" + contentIndex} style={contentIndex < columnStyles.length ? columnStyles[contentIndex] : {}}>
                {marked(content, [], inlineElementParserList)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default {
  name: "table",
  regexp: TABLE_REG,
  renderer,
};
