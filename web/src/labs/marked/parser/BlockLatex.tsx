import TeX from "@matejmazur/react-katex";
import "katex/dist/katex.min.css";
import { matcher } from "../matcher";

const BLOCK_LATEX_REG = new RegExp(
  "\\$\\$(\\s*[^\\$\\s][^\\$]*?)\\$\\$|\\\\\\[(.+?)\\\\\\]|\\\\begin{equation}([\\s\\S]+?)\\\\end{equation}"
);

const blockRenderer = (rawStr: string) => {
  const matchResult = matcher(rawStr, BLOCK_LATEX_REG);
  if (!matchResult) {
    return <>{rawStr}</>;
  }

  let latexCode = "";

  if (matchResult[1]) {
    // $$
    latexCode = matchResult[1];
  } else if (matchResult[2]) {
    // \[ and \]
    latexCode = matchResult[2];
  } else if (matchResult[3]) {
    // \begin{equation} and \end{equation}
    latexCode = matchResult[3];
  }

  return <TeX block={true}>{latexCode}</TeX>;
};

export default {
  name: "blockLatex",
  regexp: BLOCK_LATEX_REG,
  renderer: blockRenderer,
};
