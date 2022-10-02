export const BOLD_REG = /\*\*([\S ]+?)\*\*/;

const match = (rawStr: string): number => {
  const matchResult = rawStr.match(BOLD_REG);
  if (!matchResult) {
    return 0;
  }

  const matchStr = matchResult[0];
  return matchStr.length;
};

const renderer = (rawStr: string): string => {
  const parsedStr = rawStr.replace(BOLD_REG, "<strong>$1</strong>");
  return parsedStr;
};

export default {
  name: "bold",
  regex: BOLD_REG,
  match,
  renderer,
};
