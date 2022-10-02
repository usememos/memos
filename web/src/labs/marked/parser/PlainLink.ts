export const PLAIN_LINK_REG = /(https?:\/\/[^ ]+)/;

const match = (rawStr: string): number => {
  const matchResult = rawStr.match(PLAIN_LINK_REG);
  if (!matchResult) {
    return 0;
  }

  const matchStr = matchResult[0];
  return matchStr.length;
};

const renderer = (rawStr: string): string => {
  const parsedStr = rawStr.replace(PLAIN_LINK_REG, "<a class='link' target='_blank' rel='noreferrer' href='$1'>$1</a>");
  return parsedStr;
};

export default {
  name: "plain link",
  regex: PLAIN_LINK_REG,
  match,
  renderer,
};
