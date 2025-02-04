import TeX from "@matejmazur/react-katex";
import "katex/dist/katex.min.css";
import { cn } from "@/utils";

interface Props {
  content: string;
  block?: boolean;
}

const Math: React.FC<Props> = ({ content, block }: Props) => {
  return <TeX className={cn("max-w-full", block ? "w-full block" : "inline text-sm")} block={block} math={content}></TeX>;
};

export default Math;
