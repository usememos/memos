import { cn } from "@/lib/utils";
import { TASK_LIST_CLASS, TASK_LIST_ITEM_CLASS } from "../constants";
import type { ReactMarkdownProps } from "./types";

interface ListProps extends React.HTMLAttributes<HTMLUListElement | HTMLOListElement>, ReactMarkdownProps {
  ordered?: boolean;
  children: React.ReactNode;
}

/**
 * List component for both regular and task lists (GFM)
 * Detects task lists via the "contains-task-list" class added by remark-gfm
 */
export const List = ({ ordered, children, className, node: _node, ...domProps }: ListProps) => {
  const Component = ordered ? "ol" : "ul";
  const isTaskList = className?.includes(TASK_LIST_CLASS);

  return (
    <Component
      className={cn(
        "my-0 mb-2 list-outside",
        isTaskList
          ? // Task list: no bullets, nested lists get left margin for indentation
            "list-none [&_ul.contains-task-list]:ml-6"
          : // Regular list: standard padding and list style
            cn("pl-6", ordered ? "list-decimal" : "list-disc"),
        className,
      )}
      {...domProps}
    >
      {children}
    </Component>
  );
};

interface ListItemProps extends React.LiHTMLAttributes<HTMLLIElement>, ReactMarkdownProps {
  children: React.ReactNode;
}

/**
 * List item component for both regular and task list items
 * Detects task items via the "task-list-item" class added by remark-gfm
 * Applies specialized styling for task checkboxes
 */
export const ListItem = ({ children, className, node: _node, ...domProps }: ListItemProps) => {
  const isTaskListItem = className?.includes(TASK_LIST_ITEM_CLASS);

  if (isTaskListItem) {
    return (
      <li
        className={cn(
          "mt-0.5 leading-6 list-none",
          // Checkbox styling: margin and alignment
          "[&>button]:mr-2 [&>button]:align-middle",
          // Inline paragraph for task text
          "[&>p]:inline [&>p]:m-0",
          className,
        )}
        {...domProps}
      >
        {children}
      </li>
    );
  }

  return (
    <li className={cn("mt-0.5 leading-6", className)} {...domProps}>
      {children}
    </li>
  );
};
