import { CSSProperties } from "react";
import { inlineElementParserList } from ".";
import { marked } from "..";
import { matcher } from "../matcher";

export const TABLE_REG = /^((?:\|[^|\r\n]+)+)\|?\r?\n([ -:]*(?:\|[ -:]*)+)((?:\r?\n[^|\r\n]*\|[^\r\n]*)+)/;

const splitPipeDelimiter = (rawStr: string) => {
  // should take care of escaped pipes, like
  // | aaaa | bbbb | cc\|cc |
  // will return:
  // ["aaaa", "bbbb", "cc|cc"]
  return (rawStr.match(/(?:\\\||[^|])+/g) || []).map((cell) => cell.replaceAll("\\|", "|").trim());
};

const renderer = (rawStr: string) => {
  const matchResult = matcher(rawStr, TABLE_REG);
  if (!matchResult) {
    return rawStr;
  }
  const headerContents = splitPipeDelimiter(matchResult[1]);
  const cellStyles: CSSProperties[] = splitPipeDelimiter(matchResult[2]).map((cell) => {
    const left = cell.startsWith(":");
    const right = cell.endsWith(":");
    // github markdown spec says that by default, content is left aligned
    return {
      textAlign: left && right ? "center" : right ? "right" : "left",
    };
  });
  const defaultCellStyle: CSSProperties = {
    textAlign: "left",
  };
  const rowContents = matchResult[3]
    .split(/\r?\n/)
    .map(splitPipeDelimiter)
    .filter((array) => array.length > 0);

  return (
    <table>
      <thead>
        <tr>
          {headerContents.map((header, index) => (
            <th key={"th-" + index}>{marked(header, [], inlineElementParserList)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rowContents.map((row, rowIndex) => (
          <tr key={"tr-" + rowIndex}>
            {row.map((cell, cellIndex) => (
              <td key={"td-" + rowIndex + "-" + cellIndex} style={cellIndex < cellStyles.length ? cellStyles[cellIndex] : defaultCellStyle}>
                {marked(cell, [], inlineElementParserList)}
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
