import { Node } from "@/types/node";
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
