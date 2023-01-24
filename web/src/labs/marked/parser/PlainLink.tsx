import { matcher } from "../matcher";
import { marked } from "../index";
import Mark from "./Mark";

export const PLAIN_LINK_REG = /(https?:\/\/[^ ]+)/;

const renderer = (rawStr: string, highlightWord?: string) => {
  const matchResult = matcher(rawStr, PLAIN_LINK_REG);
  if (!matchResult) {
    return rawStr;
  }
  let parsedContent;
  if (highlightWord) {
    parsedContent = marked(matchResult[1], highlightWord, [], [Mark]);
  } else {
    parsedContent = matchResult[1];
  }
  return (
    <a className="link" target="_blank" rel="noreferrer" href={matchResult[1]}>
      {parsedContent}
    </a>
  );
};

export default {
  name: "plain link",
  regexp: PLAIN_LINK_REG,
  renderer,
};
