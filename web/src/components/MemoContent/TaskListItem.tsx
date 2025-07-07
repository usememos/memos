import { observer } from "mobx-react-lite";
import { useContext } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { markdownServiceClient } from "@/grpcweb";
import { cn } from "@/lib/utils";
import { memoStore } from "@/store";
import { Node, TaskListItemNode } from "@/types/proto/api/v1/markdown_service";
import Renderer from "./Renderer";
import { RendererContext } from "./types";

interface Props {
  node: Node;
  index: string;
  symbol: string;
  indent: number;
  complete: boolean;
  children: Node[];
}

const TaskListItem = observer(({ node, complete, children }: Props) => {
  const context = useContext(RendererContext);

  const handleCheckboxChange = async (on: boolean) => {
    if (context.readonly || !context.memoName) {
      return;
    }

    (node.taskListItemNode as TaskListItemNode)!.complete = on;
    const { markdown } = await markdownServiceClient.restoreMarkdownNodes({ nodes: context.nodes });
    await memoStore.updateMemo(
      {
        name: context.memoName,
        content: markdown,
      },
      ["content"],
    );
  };

  return (
    <li className={cn("w-full grid grid-cols-[24px_1fr]")}>
      <span className="w-6 h-6 flex justify-start items-center">
        <Checkbox
          className="h-4 w-4"
          checked={complete}
          disabled={context.readonly}
          onCheckedChange={(checked) => handleCheckboxChange(checked === true)}
        />
      </span>
      <p className={cn(complete && "line-through text-muted-foreground")}>
        {children.map((child, index) => (
          <Renderer key={`${child.type}-${index}`} index={String(index)} node={child} />
        ))}
      </p>
    </li>
  );
});

export default TaskListItem;
