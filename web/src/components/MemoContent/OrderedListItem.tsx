import { Node } from "@/types/proto/api/v1/markdown_service";
import Renderer from "./Renderer";
import { BaseProps } from "./types";

interface Props extends BaseProps {
  number: string;
  indent: number;
  children: Node[];
}

const OrderedListItem: React.FC<Props> = ({ children }: Props) => {
  return (
    <li>
      {children.map((child, index) => (
        <Renderer key={`${child.type}-${index}`} index={String(index)} node={child} />
      ))}
    </li>
  );
};

export default OrderedListItem;
