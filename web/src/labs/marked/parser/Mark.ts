export const MARK_REG = /@\[([\S ]+?)\]\((\S+?)\)/;

const match = (rawStr: string): number => {
  const matchResult = rawStr.match(MARK_REG);
  if (!matchResult) {
    return 0;
  }

  const matchStr = matchResult[0];
  return matchStr.length;
};

const renderer = (rawStr: string): string => {
  const parsedStr = rawStr.replace(MARK_REG, "<span class='memo-link-text' data-value='$2'>$1</span>");
  return parsedStr;
};

export default {
  name: "mark",
  regex: MARK_REG,
  match,
  renderer,
};
