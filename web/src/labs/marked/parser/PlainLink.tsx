import { matcher } from "../matcher";

export const PLAIN_LINK_REG = /((?:https?|chrome|edge):\/\/[^ ]+)/;

const renderer = (rawStr: string) => {
  const matchResult = matcher(rawStr, PLAIN_LINK_REG);
  if (!matchResult) {
    return rawStr;
  }

  return (
    <a className="link" target="_blank" href={matchResult[1]}>
      {matchResult[1]}
    </a>
  );
};

const rendererNonInteractive = (rawStr: string) => {
  const matchResult = matcher(rawStr, PLAIN_LINK_REG);
  if (!matchResult) {
    return rawStr;
  }

  return <span className="link">{matchResult[1]}</span>;
};

export default {
  name: "plain link",
  regexp: PLAIN_LINK_REG,
  renderer: () => renderer,
};

export const PlainLinkNonInteractive = {
  name: "plain link non-interactive",
  regexp: PLAIN_LINK_REG,
  renderer: () => rendererNonInteractive,
};
