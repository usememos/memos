import { escape } from "lodash-es";

export const TAG_REG = /#([^\s#]+?) /g;

const renderer = (rawStr: string): string => {
  const matchResult = rawStr.match(TAG_REG);
  if (!matchResult) {
    return rawStr;
  }
  const tag = matchResult[0].replace(TAG_REG, "$1").trim();

  return `<span class='tag-span'>#${escape(tag)}</span> `;
};

export default {
  name: "tag",
  regex: TAG_REG,
  renderer,
};
