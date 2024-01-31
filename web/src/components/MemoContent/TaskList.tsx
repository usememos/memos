import { Checkbox } from "@mui/joy";
import classNames from "classnames";
import { repeat } from "lodash-es";
import { useContext } from "react";
import { useMemoStore } from "@/store/v1";
import { Node, NodeType } from "@/types/node";
import Renderer from "./Renderer";
import { RendererContext } from "./types";

interface Props {
  index: string;
  symbol: string;
  indent: number;
  complete: boolean;
  children: Node[];
}

const TaskList: React.FC<Props> = ({ index, indent, complete, children }: Props) => {
  const context = useContext(RendererContext);
  const memoStore = useMemoStore();

  const handleCheckboxChange = async (on: boolean) => {
    if (context.readonly || !context.memoId) {
      return;
    }

    const nodeIndex = Number(index);
    if (isNaN(nodeIndex)) {
      return;
    }

    const node = context.nodes[nodeIndex];
    if (node.type !== NodeType.TASK_LIST || !node.taskListNode) {
      return;
    }

    node.taskListNode!.complete = on;
    const content = window.restore(context.nodes);
    await memoStore.updateMemo(
      {
        id: context.memoId,
        content,
      },
      ["content"],
    );
  };

  return (
    <ul>
      <li className="w-full flex flex-row">
        <div className="block font-mono shrink-0">
          <span>{repeat(" ", indent)}</span>
        </div>
        <div className="w-auto grid grid-cols-[24px_1fr] gap-1">
          <div className="w-7 h-6 flex justify-center items-center">
            <Checkbox size="sm" checked={complete} disabled={context.readonly} onChange={(e) => handleCheckboxChange(e.target.checked)} />
          </div>
          <div className={classNames(complete && "line-through opacity-80")}>
            {children.map((child, index) => (
              <Renderer key={`${child.type}-${index}`} index={String(index)} node={child} />
            ))}
          </div>
        </div>
      </li>
    </ul>
  );
};

export default TaskList;
