export const LINK_REG = /\[(.*?)\]\((.+?)\)/;

const renderer = (rawStr: string): string => {
  const parsedStr = rawStr.replace(LINK_REG, "<a class='link' target='_blank' rel='noreferrer' href='$2'>$1</a>");
  return parsedStr;
};

export default {
  name: "link",
  regex: LINK_REG,
  renderer,
};
