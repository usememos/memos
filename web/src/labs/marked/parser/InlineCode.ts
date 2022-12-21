import { escape } from "lodash-es";

export const INLINE_CODE_REG = /`(.+?)`/;

const matcher = (rawStr: string) => {
  const matchResult = rawStr.match(INLINE_CODE_REG);
  return matchResult;
};

const renderer = (rawStr: string): string => {
  const matchResult = matcher(rawStr);
  if (!matchResult) {
    return rawStr;
  }

  return `<code>${escape(matchResult[1])}</code>`;
};

export default {
  name: "inline code",
  regex: INLINE_CODE_REG,
  matcher,
  renderer,
};
