import { escape } from "lodash-es";

export const TAG_REG = /#([^\s#]+)/;

export const matcher = (rawStr: string) => {
  const matchResult = rawStr.match(TAG_REG);
  if (matchResult) {
    return matchResult;
  }
  return null;
};

const renderer = (rawStr: string): string => {
  const matchResult = matcher(rawStr);
  if (!matchResult) {
    return rawStr;
  }

  return `<span class='tag-span'>#${escape(matchResult[1])}</span>`;
};

export default {
  name: "tag",
  regex: TAG_REG,
  matcher,
  renderer,
};
