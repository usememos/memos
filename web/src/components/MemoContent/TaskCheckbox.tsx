import { useContext } from "react";
import { memoStore } from "@/store";
import { toggleTaskAtIndex } from "@/utils/markdown-manipulation";
import { MemoContentContext } from "./MemoContentContext";

/**
 * Custom checkbox component for react-markdown task lists
 *
 * Handles interactive task checkbox clicks and updates memo content.
 * This component is used via react-markdown's components prop.
 */

interface TaskCheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  checked?: boolean;
  disabled?: boolean;
}

export const TaskCheckbox: React.FC<TaskCheckboxProps> = ({ checked, disabled, ...props }) => {
  const context = useContext(MemoContentContext);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Don't update if readonly or no memo context
    if (context.readonly || !context.memoName) {
      return;
    }

    const newChecked = e.target.checked;

    // Find the task index by walking up the DOM
    const listItem = e.target.closest("li.task-list-item");
    if (!listItem) {
      return;
    }

    // Get task index from data attribute, or calculate by counting
    const taskIndexStr = listItem.getAttribute("data-task-index");
    let taskIndex = 0;

    if (taskIndexStr !== null) {
      taskIndex = parseInt(taskIndexStr);
    } else {
      // Fallback: Calculate index by counting previous task list items
      const allTaskItems = listItem.closest("ul, ol")?.querySelectorAll("li.task-list-item") || [];
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

  return <input {...props} type="checkbox" checked={checked} disabled={context.readonly || disabled} onChange={handleChange} />;
};
