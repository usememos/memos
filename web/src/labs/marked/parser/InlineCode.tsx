import { escape } from "lodash-es";
import { matcher } from "../matcher";

export const INLINE_CODE_REG = /`(.+?)`/;

const renderer = (rawStr: string) => {
  const matchResult = matcher(rawStr, INLINE_CODE_REG);
  if (!matchResult) {
    return rawStr;
  }

  return <code>{escape(matchResult[1])}</code>;
};

export default {
  name: "inline code",
  regexp: INLINE_CODE_REG,
  renderer,
};
