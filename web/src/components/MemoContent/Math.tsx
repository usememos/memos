import TeX from "@matejmazur/react-katex";
import clsx from "clsx";
import "katex/dist/katex.min.css";

interface Props {
  content: string;
  block?: boolean;
}

const Math: React.FC<Props> = ({ content, block }: Props) => {
  return <TeX className={clsx("max-w-full", block ? "w-full block" : "inline text-sm")} block={block} math={content}></TeX>;
};

export default Math;
