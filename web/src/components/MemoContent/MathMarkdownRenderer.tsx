import "katex/dist/katex.min.css";
import rehypeKatex from "rehype-katex";
import { remarkCurrencySafeMath } from "@/utils/remark-plugins/remark-currency-safe-math";
import { MemoMarkdownRendererCore, type MemoMarkdownRendererProps } from "./MemoMarkdownRenderer";

const MathMarkdownRenderer = (props: MemoMarkdownRendererProps) => (
  <MemoMarkdownRendererCore
    {...props}
    mathRemarkPlugins={[remarkCurrencySafeMath]}
    mathRehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
  />
);

export default MathMarkdownRenderer;
