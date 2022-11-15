export const HORIZONTAL_RULES_REG = /^---\n|^\*\*\*\n|^___\n/;

export const renderer = (rawStr: string): string => {
  const matchResult = rawStr.match(HORIZONTAL_RULES_REG);
  if (!matchResult) {
    return rawStr;
  }
  return `<hr>\n`;
};

export default {
  name: "horizontal rules",
  regex: HORIZONTAL_RULES_REG,
  renderer,
};
