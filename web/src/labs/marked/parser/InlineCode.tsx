import { matcher } from "../matcher";

export const INLINE_CODE_REG = /`(.+?)`/;

const renderer = (rawStr: string) => {
  const matchResult = matcher(rawStr, INLINE_CODE_REG);
  if (!matchResult) {
    return rawStr;
  }

  return <code>{matchResult[1]}</code>;
};

export default {
  name: "inline code",
  regexp: INLINE_CODE_REG,
  renderer,
};
