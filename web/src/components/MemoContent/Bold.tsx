import { Node } from "@/types/proto/api/v1/markdown_service";
import Renderer from "./Renderer";

interface Props {
  symbol: string;
  children: Node[];
}

const Bold: React.FC<Props> = ({ children }: Props) => {
  return (
    <strong>
      {children.map((child, index) => (
        <Renderer key={`${child.type}-${index}`} index={String(index)} node={child} />
      ))}
    </strong>
  );
};

export default Bold;
