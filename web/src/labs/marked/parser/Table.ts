/**
 * Match markdown table
 * example:
 * | a | b | c |
 * |---|---|---|
 * | 1 | 2 | 3 |
 * | 4 | 5 | 6 |
 */
export const TABLE_REG = /^(\|.*\|)(?:(?:\n(?:\|-*)+\|))((?:\n\|.*\|)+)(\n?)/;

const renderer = (rawStr: string): string => {
  const matchResult = rawStr.match(TABLE_REG);
  if (!matchResult) {
    return rawStr;
  }
  const tableHeader = matchResult[1]
    .split("|")
    .filter((str) => str !== "")
    .map((str) => str.trim());
  const tableBody = matchResult[2]
    .trim()
    .split("\n")
    .map((str) =>
      str
        .split("|")
        .filter((str) => str !== "")
        .map((str) => str.trim())
    );
  return `<table>
  <thead>
    <tr>
      ${tableHeader.map((str) => `<th>${str}</th>`).join("")}
    </tr>
  </thead>
  <tbody>
    ${tableBody.map((row) => `<tr>${row.map((str) => `<td>${str}</td>`).join("")}</tr>`).join("")}
  </tbody>
</table>${matchResult[3]}`;
};

export default {
  name: "table",
  regex: TABLE_REG,
  renderer,
};
