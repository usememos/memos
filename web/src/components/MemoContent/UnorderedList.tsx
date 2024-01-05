import { Node } from "@/types/proto/api/v2/markdown_service";
import Renderer from "./Renderer";

interface Props {
  symbol: string;
  children: Node[];
}

const UnorderedList: React.FC<Props> = ({ children }: Props) => {
  return (
    <ul>
      <li className="grid grid-cols-[24px_1fr] gap-1">
        <div className="w-7 h-6 flex justify-center items-center">
          <span className="opacity-80">•</span>
        </div>
        <div>
          {children.map((child, index) => (
            <Renderer key={`${child.type}-${index}`} index={String(index)} node={child} />
          ))}
        </div>
      </li>
    </ul>
  );
};

export default UnorderedList;
