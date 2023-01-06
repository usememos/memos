import { escape } from "lodash-es";
import { matcher } from "../matcher";

export const TAG_REG = /#([^\s#]+)/;

const renderer = (rawStr: string) => {
  const matchResult = matcher(rawStr, TAG_REG);
  if (!matchResult) {
    return rawStr;
  }

  return <span className="tag-span">#{escape(matchResult[1])}</span>;
};

export default {
  name: "tag",
  regexp: TAG_REG,
  renderer,
};
