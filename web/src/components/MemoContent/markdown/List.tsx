import { cn } from "@/lib/utils";
import { TASK_LIST_CLASS, TASK_LIST_ITEM_CLASS } from "../constants";
import { NestedMarkdownRenderContext } from "../MarkdownRenderContext";
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
          ? // Task list indentation is handled by task item grid columns.
            "list-none"
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
 */
export const ListItem = ({ children, className, node: _node, ...domProps }: ListItemProps) => {
  const isTaskListItem = className?.includes(TASK_LIST_ITEM_CLASS);

  if (isTaskListItem) {
    return (
      <li
        className={cn(
          "mt-0.5 leading-6 list-none grid grid-cols-[auto_1fr] items-start gap-x-2 [&>[data-slot=checkbox]]:mt-1",
          "[&>ul]:col-start-2 [&>ul]:col-span-1 [&>ol]:col-start-2 [&>ol]:col-span-1",
          "[&>p:first-child]:contents [&>p:not(:first-child)]:col-start-2 [&>p:not(:first-child)]:col-span-1",
          className,
        )}
        {...domProps}
      >
        <NestedMarkdownRenderContext>{children}</NestedMarkdownRenderContext>
      </li>
    );
  }

  return (
    <li className={cn("mt-0.5 leading-6", className)} {...domProps}>
      <NestedMarkdownRenderContext>{children}</NestedMarkdownRenderContext>
    </li>
  );
};
