export const MARK_REG = /@\[([\S ]+?)\]\((\S+?)\)/;

const renderer = (rawStr: string): string => {
  const parsedStr = rawStr.replace(MARK_REG, "<span class='memo-link-text' data-value='$2'>$1</span>");
  return parsedStr;
};

export default {
  name: "mark",
  regex: MARK_REG,
  renderer,
};
