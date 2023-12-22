import { Node } from "@/types/proto/api/v2/markdown_service";
import Renderer from "./Renderer";

interface Props {
  children: Node[];
}

const Paragraph: React.FC<Props> = ({ children }: Props) => {
  return (
    <p>
      {children.map((child, index) => (
        <Renderer key={`${child.type}-${index}`} node={child} />
      ))}
    </p>
  );
};

export default Paragraph;
