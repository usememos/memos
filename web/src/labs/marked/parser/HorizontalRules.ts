export const HORIZONTAL_RULES_REG = /^_{3}|^-{3}|^\*{3}/;

const matcher = (rawStr: string) => {
  const matchResult = rawStr.match(HORIZONTAL_RULES_REG);
  return matchResult;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const renderer = (rawStr: string): string => {
  return `<hr>`;
};

export default {
  name: "horizontal rules",
  regex: HORIZONTAL_RULES_REG,
  matcher,
  renderer,
};
