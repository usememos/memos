import TeX from "@matejmazur/react-katex";
import "katex/dist/katex.min.css";

interface Props {
  content: string;
  block?: boolean;
}

const Math: React.FC<Props> = ({ content, block }: Props) => {
  return <TeX className="max-w-full inline-block overflow-auto" block={block} math={content}></TeX>;
};

export default Math;
