import { matcher } from "../matcher";

export const BLOCKQUOTE_REG = /^> ([^\n]+)/;

const renderer = (rawStr: string) => {
  const matchResult = matcher(rawStr, BLOCKQUOTE_REG);
  if (!matchResult) {
    return <>{rawStr}</>;
  }

  return <blockquote>{matchResult[1]}</blockquote>;
};

export default {
  name: "blockquote",
  regexp: BLOCKQUOTE_REG,
  renderer,
};
