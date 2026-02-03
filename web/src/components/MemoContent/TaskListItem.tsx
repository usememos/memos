import { useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { useUpdateMemo } from "@/hooks/useMemoQueries";
import { toggleTaskAtIndex } from "@/utils/markdown-manipulation";
import { useMemoViewContext, useMemoViewDerived } from "../MemoView/MemoViewContext";
import { TASK_LIST_ITEM_CLASS } from "./constants";
import type { ReactMarkdownProps } from "./markdown/types";

interface TaskListItemProps extends React.InputHTMLAttributes<HTMLInputElement>, ReactMarkdownProps {
  checked?: boolean;
}

export const TaskListItem: React.FC<TaskListItemProps> = ({ checked, node: _node, ...props }) => {
  const { memo } = useMemoViewContext();
  const { readonly } = useMemoViewDerived();
  const checkboxRef = useRef<HTMLButtonElement>(null);
  const { mutate: updateMemo } = useUpdateMemo();

  const handleChange = async (newChecked: boolean) => {
    // Don't update if readonly or no memo
    if (readonly || !memo) {
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
      // Fallback: Calculate index by counting all task list items in the entire memo
      // We need to search from the root memo content container, not just the nearest list
      // to ensure nested tasks are counted in document order
      let searchRoot = listItem.closest('[class*="memo-content"], [class*="MemoContent"]');

      // If memo content container not found, search from document body
      if (!searchRoot) {
        searchRoot = document.body;
      }

      const allTaskItems = searchRoot.querySelectorAll(`li.${TASK_LIST_ITEM_CLASS}`);
      for (let i = 0; i < allTaskItems.length; i++) {
        if (allTaskItems[i] === listItem) {
          taskIndex = i;
          break;
        }
      }
    }

    // Update memo content using the string manipulation utility
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
  return <Checkbox ref={checkboxRef} checked={checked} disabled={readonly} onCheckedChange={handleChange} className={props.className} />;
};
