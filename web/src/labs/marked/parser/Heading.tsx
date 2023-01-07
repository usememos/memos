import { matcher } from "../matcher";

export const HEADING_REG = /^(#+) ([^\n]+)/;

const renderer = (rawStr: string) => {
  const matchResult = matcher(rawStr, HEADING_REG);
  if (!matchResult) {
    return rawStr;
  }

  const level = matchResult[1].length;
  if (level === 1) {
    return <h1>{matchResult[2]}</h1>;
  } else if (level === 2) {
    return <h2>{matchResult[2]}</h2>;
  } else if (level === 3) {
    return <h3>{matchResult[2]}</h3>;
  } else if (level === 4) {
    return <h4>{matchResult[2]}</h4>;
  }
  return <h5>{matchResult[2]}</h5>;
};

export default {
  name: "heading",
  regexp: HEADING_REG,
  renderer,
};
