import { Node } from "@/types/proto/api/v1/markdown_service";
import Renderer from "./Renderer";
import { BaseProps } from "./types";

interface Props extends BaseProps {
  children: Node[];
}

const Paragraph: React.FC<Props> = ({ children }: Props) => {
  return (
    <p>
      {children.map((child, index) => (
        <Renderer key={`${child.type}-${index}`} index={String(index)} node={child} />
      ))}
    </p>
  );
};

export default Paragraph;
