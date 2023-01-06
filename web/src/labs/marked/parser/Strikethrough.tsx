import { escape } from "lodash";
import { matcher } from "../matcher";

export const STRIKETHROUGH_REG = /~~(.+?)~~/;

const renderer = (rawStr: string) => {
  const matchResult = matcher(rawStr, STRIKETHROUGH_REG);
  if (!matchResult) {
    return rawStr;
  }

  return <del>{escape(matchResult[1])}</del>;
};

export default {
  name: "Strikethrough",
  regexp: STRIKETHROUGH_REG,
  renderer,
};
