import { matcher } from "../matcher";

export const TAG_REG = /#((?:[^\s\p{P}]|_)+)/u;

const renderer = (rawStr: string) => {
  const matchResult = matcher(rawStr, TAG_REG);
  if (!matchResult) {
    return rawStr;
  }

  return <span className="tag-span">#{matchResult[1]}</span>;
};

export default {
  name: "tag",
  regexp: TAG_REG,
  renderer,
};
