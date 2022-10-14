import { escape } from "lodash-es";

export const TAG_REG = /#([^\s#]+?) /;

const renderer = (rawStr: string): string => {
  const matchResult = rawStr.match(TAG_REG);
  if (!matchResult) {
    return rawStr;
  }

  return `<span class='tag-span'>#${escape(matchResult[1])}</span> `;
};

export default {
  name: "tag",
  regex: TAG_REG,
  renderer,
};
