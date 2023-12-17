import { Checkbox } from "@mui/joy";
import { Node } from "@/types/proto/api/v2/markdown_service";
import Renderer from "./Renderer";

interface Props {
  symbol: string;
  complete: boolean;
  children: Node[];
}

const TaskList: React.FC<Props> = ({ complete, children }: Props) => {
  return (
    <ul>
      <li className="grid grid-cols-[24px_1fr] gap-1">
        <div className="w-7 h-6 flex justify-center items-center">
          <Checkbox size="sm" checked={complete} readOnly />
        </div>
        <div>
          {children.map((child, index) => (
            <Renderer key={`${child.type}-${index}`} node={child} />
          ))}
        </div>
      </li>
    </ul>
  );
};

export default TaskList;
