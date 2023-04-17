import { matcher } from "../matcher";
import { Link } from "react-router-dom";

export const MEMO_REF_REG = /(m\/\d+)/;

const renderer = (rawStr: string) => {
  const matchResult = matcher(rawStr, MEMO_REF_REG);
  if (!matchResult) {
    return rawStr;
  }

  return (
    <Link className="memo-ref" to={"/" + matchResult[1]}>
      {matchResult[1]}
    </Link>
  );
};

const rendererNonInteractive = (rawStr: string) => {
  const matchResult = matcher(rawStr, MEMO_REF_REG);
  if (!matchResult) {
    return rawStr;
  }

  return <span className="memo-ref">{matchResult[1]}</span>;
};

export default {
  name: "memo ref",
  regexp: MEMO_REF_REG,
  renderer: () => renderer,
};

export const MemoRefNonInteractive = {
  name: "memo ref non-interactive",
  regexp: MEMO_REF_REG,
  renderer: () => rendererNonInteractive,
};
