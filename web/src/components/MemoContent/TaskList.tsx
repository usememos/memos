import { Checkbox } from "@mui/joy";
import { useContext } from "react";
import { useMemoStore } from "@/store/v1";
import { Node, NodeType } from "@/types/proto/api/v2/markdown_service";
import Renderer from "./Renderer";
import { RendererContext } from "./types";

interface Props {
  index: string;
  symbol: string;
  complete: boolean;
  children: Node[];
}

const TaskList: React.FC<Props> = ({ index, complete, children }: Props) => {
  const context = useContext(RendererContext);
  const memoStore = useMemoStore();

  const handleCheckboxChange = async (on: boolean) => {
    const nodeIndex = Number(index);
    if (isNaN(nodeIndex)) {
      return;
    }

    const node = context.nodes[nodeIndex];
    if (node.type !== NodeType.TASK_LIST || !node.taskListNode) {
      return;
    }

    node.taskListNode!.complete = on;
    await memoStore.updateMemo(
      {
        id: context.memoId,
        nodes: context.nodes,
      },
      ["nodes"]
    );
  };

  return (
    <ul>
      <li className="grid grid-cols-[24px_1fr] gap-1">
        <div className="w-7 h-6 flex justify-center items-center">
          <Checkbox size="sm" checked={complete} disabled={context.readonly} onChange={(e) => handleCheckboxChange(e.target.checked)} />
        </div>
        <div>
          {children.map((child, subIndex) => (
            <Renderer key={`${child.type}-${subIndex}`} index={`${index}-${subIndex}`} node={child} />
          ))}
        </div>
      </li>
    </ul>
  );
};

export default TaskList;
