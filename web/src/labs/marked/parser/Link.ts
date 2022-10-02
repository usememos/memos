export const LINK_REG = /\[(.*?)\]\((.+?)\)/;

const match = (rawStr: string): number => {
  const matchResult = rawStr.match(LINK_REG);
  if (!matchResult) {
    return 0;
  }

  const matchStr = matchResult[0];
  return matchStr.length;
};

const renderer = (rawStr: string): string => {
  const parsedStr = rawStr.replace(LINK_REG, "<a class='link' target='_blank' rel='noreferrer' href='$2'>$1</a>");
  return parsedStr;
};

export default {
  name: "link",
  regex: LINK_REG,
  match,
  renderer,
};
