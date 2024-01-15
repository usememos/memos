import { Node } from "@/types/proto/api/v2/markdown_service";
import Renderer from "./Renderer";
import { BaseProps } from "./types";

interface Props extends BaseProps {
  children: Node[];
}

const Blockquote: React.FC<Props> = ({ children }: Props) => {
  return (
    <blockquote className="p-2 border-s-4 border-gray-300 bg-gray-50 dark:border-gray-500 dark:bg-zinc-700">
      {children.map((child, index) => (
        <Renderer key={`${child.type}-${index}`} index={String(index)} node={child} />
      ))}
    </blockquote>
  );
};

export default Blockquote;
