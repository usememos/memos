import { Node } from "@/types/proto/api/v1/markdown_service";
import Renderer from "./Renderer";

interface Props {
  symbol: string;
  indent: number;
  children: Node[];
}

const UnorderedListItem: React.FC<Props> = ({ children }: Props) => {
  return (
    <li>
      {children.map((child, index) => (
        <Renderer key={`${child.type}-${index}`} index={String(index)} node={child} />
      ))}
    </li>
  );
};

export default UnorderedListItem;
