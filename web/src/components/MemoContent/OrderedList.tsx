import { Node } from "@/types/proto/api/v2/markdown_service";
import Renderer from "./Renderer";

interface Props {
  number: string;
  children: Node[];
}

const OrderedList: React.FC<Props> = ({ number, children }: Props) => {
  return (
    <ol>
      <li className="grid grid-cols-[24px_1fr] gap-1">
        <div className="w-7 h-6 flex justify-center items-center">
          <span className="opacity-80">{number}.</span>
        </div>
        <div>
          {children.map((child, index) => (
            <Renderer key={`${child.type}-${index}`} node={child} />
          ))}
        </div>
      </li>
    </ol>
  );
};

export default OrderedList;
