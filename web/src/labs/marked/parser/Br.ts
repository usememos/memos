export const BR_REG = /^(\n+)/;

const matcher = (rawStr: string) => {
  const matchResult = rawStr.match(BR_REG);
  return matchResult;
};

const renderer = (rawStr: string): string => {
  return rawStr.replaceAll("\n", "<br>");
};

export default {
  name: "br",
  regex: BR_REG,
  matcher,
  renderer,
};
