import { useContext, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { memoStore } from "@/store";
import { toggleTaskAtIndex } from "@/utils/markdown-manipulation";
import { MemoContentContext } from "./MemoContentContext";

/**
 * Custom checkbox component for react-markdown task lists
 *
 * Handles interactive task checkbox clicks and updates memo content.
 * This component is used via react-markdown's components prop.
 *
 * Note: This component should only be used for task list checkboxes.
 * Regular inputs are handled by the default input element.
 */

interface TaskListItemProps extends React.InputHTMLAttributes<HTMLInputElement> {
  node?: any; // AST node from react-markdown
  checked?: boolean;
}

export const TaskListItem: React.FC<TaskListItemProps> = ({ checked, ...props }) => {
  const context = useContext(MemoContentContext);
  const checkboxRef = useRef<HTMLButtonElement>(null);

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
    const memo = memoStore.getMemoByName(context.memoName);
    if (!memo) {
      return;
    }

    const newContent = toggleTaskAtIndex(memo.content, taskIndex, newChecked);
    await memoStore.updateMemo(
      {
        name: memo.name,
        content: newContent,
      },
      ["content"],
    );
  };

  // Override the disabled prop from remark-gfm (which defaults to true)
  // We want interactive checkboxes, only disabled when readonly
  return (
    <Checkbox ref={checkboxRef} checked={checked} disabled={context.readonly} onCheckedChange={handleChange} className={props.className} />
  );
};
