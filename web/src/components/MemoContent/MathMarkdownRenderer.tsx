import "katex/dist/katex.min.css";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { MemoMarkdownRendererCore, type MemoMarkdownRendererProps } from "./MemoMarkdownRenderer";

const MathMarkdownRenderer = (props: MemoMarkdownRendererProps) => (
  <MemoMarkdownRendererCore
    {...props}
    mathRemarkPlugins={[remarkMath]}
    mathRehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
  />
);

export default MathMarkdownRenderer;
