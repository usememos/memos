import { Node } from "@/types/proto/api/v1/markdown_service";
import Renderer from "./Renderer";
import { BaseProps } from "./types";

interface Props extends BaseProps {
  children: Node[];
}

const Blockquote: React.FC<Props> = ({ children }: Props) => {
  return (
    <blockquote className="p-2 border-s-4 rounded border-muted bg-muted">
      {children.map((child, index) => (
        <Renderer key={`${child.type}-${index}`} index={String(index)} node={child} />
      ))}
    </blockquote>
  );
};

export default Blockquote;
