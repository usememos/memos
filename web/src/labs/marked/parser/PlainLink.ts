export const PLAIN_LINK_REG = /(https?:\/\/[^ ]+)/;

const renderer = (rawStr: string): string => {
  const parsedStr = rawStr.replace(PLAIN_LINK_REG, "<a class='link' target='_blank' rel='noreferrer' href='$1'>$1</a>");
  return parsedStr;
};

export default {
  name: "plain link",
  regex: PLAIN_LINK_REG,
  renderer,
};
