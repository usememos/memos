import TeX from "@matejmazur/react-katex";
import "katex/dist/katex.min.css";

export const LATEX_INLINE_REG = /\$(.+?)\$|\\\(([^\\]+)\\\)/g;

const inlineRenderer = (rawStr: string) => {
  const matchResult = LATEX_INLINE_REG.exec(rawStr);
  if (!matchResult) {
    return rawStr;
  }

  let latexCode = "";

  if (matchResult[1]) {
    // $
    latexCode = matchResult[1];
  } else if (matchResult[2]) {
    // \( and \)
    latexCode = matchResult[2];
  }
  return <TeX>{latexCode}</TeX>;
};

export default {
  name: "inlineLatex",
  regexp: LATEX_INLINE_REG,
  renderer: inlineRenderer,
};
