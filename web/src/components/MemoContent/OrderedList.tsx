import { repeat } from "lodash-es";
import { Node } from "@/types/proto/api/v2/markdown_service";
import Renderer from "./Renderer";
import { BaseProps } from "./types";

interface Props extends BaseProps {
  number: string;
  indent: number;
  children: Node[];
}

const OrderedList: React.FC<Props> = ({ number, indent, children }: Props) => {
  return (
    <ol>
      <li className="w-full flex flex-row">
        <div className="block font-mono shrink-0">
          <span>{repeat(" ", indent)}</span>
        </div>
        <div className="w-auto grid grid-cols-[24px_1fr] gap-1">
          <div className="w-7 h-6 flex justify-center items-center">
            <span className="opacity-80">{number}.</span>
          </div>
          <div>
            {children.map((child, index) => (
              <Renderer key={`${child.type}-${index}`} index={String(index)} node={child} />
            ))}
          </div>
        </div>
      </li>
    </ol>
  );
};

export default OrderedList;
