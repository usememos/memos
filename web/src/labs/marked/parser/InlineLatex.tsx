import TeX from "@matejmazur/react-katex";
import "katex/dist/katex.min.css";

export const LATEX_INLINE_REG = /\$(.+?)\$|\\\((.+?)\\\)/;

const inlineRenderer = (rawStr: string) => {
  const matchResult = LATEX_INLINE_REG.exec(rawStr);
  if (matchResult) {
    let latexCode = "";
    if (matchResult[1]) {
      latexCode = matchResult[1];
    } else if (matchResult[2]) {
      latexCode = matchResult[2];
    }
    return (
      <div className="w-full max-w-full overflow-x-auto">
        <TeX key={latexCode}>{latexCode}</TeX>
      </div>
    );
  }
  return rawStr;
};

export default {
  name: "inlineLatex",
  regexp: LATEX_INLINE_REG,
  renderer: inlineRenderer,
};
