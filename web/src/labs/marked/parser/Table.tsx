import { CSSProperties } from "react";
import { inlineElementParserList } from ".";
import { marked } from "..";
import { matcher } from "../matcher";

class TableRegExp extends RegExp {
  [Symbol.match](str: string): RegExpMatchArray | null {
    const result = RegExp.prototype[Symbol.match].call(this, str);
    // regex will only be considered valid if headers and delimiters column count matches
    if (!result || splitPipeDelimiter(result[1]).length != splitPipeDelimiter(result[2]).length) {
      return null;
    }
    return result;
  }
}

export const TABLE_REG = new TableRegExp(/^([^\n|]*\|[^\n]*)\n([ \t:-]*(?<!\\)\|[ \t:|-]*)((?:\n[^\n|]*\|[^\n]*)+)/);

const splitPipeDelimiter = (rawStr: string) => {
  // loose pipe delimiter for markdown tables. escaped pipes are supported. some examples:
  // | aaaa | bbbb | cc\|cc | => ["aaaa", "bbbb", "cc|cc"]
  // aaaa | bbbb | cc\|cc => ["aaaa", "bbbb", "cc|cc"]
  // |a|f => ["a", "f"]
  // ||a|f| => ["", "a", "f"]
  // |||| => ["", "", ""]
  // |\||\||\|| => ["|", "|", "|"]
  return (
    rawStr
      .replaceAll(/(?<!\\)\|/g, "| ")
      .trim()
      .match(/(?:\\\||[^|])+/g) || []
  ).map((cell) => cell.replaceAll("\\|", "|").trim());
  // TODO: Need to move backslash escaping (to PlainText ?) for all characters
  // described in markdown spec (\`*_{}[]()#+-.!), and not just the pipe symbol here
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
  const rowContents = matchResult[3].substring(1).split(/\r?\n/).map(splitPipeDelimiter);

  return (
    <table>
      <thead>
        <tr>
          {headerContents.map((header, index) => (
            <th key={index}>{marked(header, [], inlineElementParserList)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rowContents.map((row, rowIndex) => (
          <tr key={rowIndex} className="dark:even:bg-zinc-600 even:bg-zinc-100">
            {headerContents.map((_, cellIndex) => (
              <td key={cellIndex} style={cellStyles[cellIndex]}>
                {cellIndex < row.length ? marked(row[cellIndex], [], inlineElementParserList) : null}
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
