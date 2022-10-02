export const EMPHASIS_REG = /\*([\S ]+?)\*/;

const match = (rawStr: string): number => {
  const matchResult = rawStr.match(EMPHASIS_REG);
  if (!matchResult) {
    return 0;
  }

  const matchStr = matchResult[0];
  return matchStr.length;
};

const renderer = (rawStr: string): string => {
  const parsedStr = rawStr.replace(EMPHASIS_REG, "<em>$1</em>");
  return parsedStr;
};

export default {
  name: "emphasis",
  regex: EMPHASIS_REG,
  match,
  renderer,
};
