import { matcher } from "../matcher";

const renderer = (rawStr: string, highlightWord?: string) => {
  if (!highlightWord) {
    return rawStr;
  }
  const markReg = RegExp(`(${highlightWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`);
  const matchResult = matcher(rawStr, markReg);
  if (!matchResult) {
    return rawStr;
  }
  return <mark>{matchResult[0]}</mark>;
};

export default {
  name: "mark",
  regexp: /.*/,
  renderer,
};
