import { useQueryClient } from "@tanstack/react-query";
import { useContext, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { memoKeys, useUpdateMemo } from "@/hooks/useMemoQueries";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { toggleTaskAtIndex } from "@/utils/markdown-manipulation";
import { MemoContentContext } from "./MemoContentContext";

interface TaskListItemProps extends React.InputHTMLAttributes<HTMLInputElement> {
  node?: any; // AST node from react-markdown
  checked?: boolean;
}

export const TaskListItem: React.FC<TaskListItemProps> = ({ checked, ...props }) => {
  const context = useContext(MemoContentContext);
  const checkboxRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();
  const { mutate: updateMemo } = useUpdateMemo();

  const handleChange = async (newChecked: boolean) => {
    // Don't update if readonly or no memo context
    if (context.readonly || !context.memoName) {
      return;
    }

    // Find the task index by walking up the DOM
    const listItem = checkboxRef.current?.closest("li.task-list-item");
    if (!listItem) {
      return;
    }

    // Get task index from data attribute, or calculate by counting
    const taskIndexStr = listItem.getAttribute("data-task-index");
    let taskIndex = 0;

    if (taskIndexStr !== null) {
      taskIndex = parseInt(taskIndexStr);
    } else {
      // Fallback: Calculate index by counting ALL task list items in the memo
      // Use the container ref from context for proper scoping
      const container = context.containerRef?.current;
      if (!container) {
        return;
      }

      const allTaskItems = container.querySelectorAll("li.task-list-item");
      for (let i = 0; i < allTaskItems.length; i++) {
        if (allTaskItems[i] === listItem) {
          taskIndex = i;
          break;
        }
      }
    }

    // Update memo content using the string manipulation utility
    const memo = queryClient.getQueryData<Memo>(memoKeys.detail(context.memoName));
    if (!memo) {
      return;
    }

    const newContent = toggleTaskAtIndex(memo.content, taskIndex, newChecked);
    updateMemo({
      update: {
        name: memo.name,
        content: newContent,
      },
      updateMask: ["content"],
    });
  };

  // Override the disabled prop from remark-gfm (which defaults to true)
  // We want interactive checkboxes, only disabled when readonly
  return (
    <Checkbox ref={checkboxRef} checked={checked} disabled={context.readonly} onCheckedChange={handleChange} className={props.className} />
  );
};
