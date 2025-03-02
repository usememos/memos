import TeX from "@matejmazur/react-katex";
import { cn } from "@/utils";
import "katex/dist/katex.min.css";

interface Props {
  content: string;
  block?: boolean;
}

const Math: React.FC<Props> = ({ content, block }: Props) => {
  return <TeX className={cn("max-w-full", block ? "w-full block" : "inline text-sm")} block={block} math={content}></TeX>;
};

export default Math;
