import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { markdownStyles } from "@/lib/markdownStyles";
import { cn } from "@/lib/utils";
import { TASK_LIST_CLASS, TASK_LIST_ITEM_CLASS } from "../constants";
import { NestedMarkdownRenderContext } from "../MarkdownRenderContext";
import type { ReactMarkdownProps } from "./types";

interface TaskListChildProps {
  children?: ReactNode;
  node?: {
    tagName?: string;
    properties?: {
      type?: unknown;
    };
  };
  type?: string;
}

const isCheckboxInput = (child: ReactNode): child is ReactElement<TaskListChildProps> => {
  return (
    isValidElement<TaskListChildProps>(child) && (child.props.type === "checkbox" || child.props.node?.properties?.type === "checkbox")
  );
};

const isParagraphElement = (child: ReactNode): child is ReactElement<TaskListChildProps> => {
  return isValidElement<TaskListChildProps>(child) && (child.type === "p" || child.props.node?.tagName === "p");
};

const splitTaskListItemChildren = (children: ReactNode) => {
  let checkbox: ReactNode;
  const content: ReactNode[] = [];

  Children.toArray(children).forEach((child) => {
    if (!checkbox && isCheckboxInput(child)) {
      checkbox = child;
      return;
    }

    if (!checkbox && isParagraphElement(child)) {
      const paragraphChildren: ReactNode[] = [];

      Children.toArray(child.props.children).forEach((paragraphChild) => {
        if (!checkbox && isCheckboxInput(paragraphChild)) {
          checkbox = paragraphChild;
          return;
        }
        paragraphChildren.push(paragraphChild);
      });

      if (checkbox) {
        if (paragraphChildren.length > 0) {
          content.push(cloneElement(child, undefined, ...paragraphChildren));
        }
        return;
      }
    }

    content.push(child);
  });

  return { checkbox, content };
};

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
  // Task list indentation is handled by task item grid columns; regular lists
  // use the shared token (padding + list style).
  const listClass = isTaskList ? "my-0 mb-2 list-outside list-none" : ordered ? markdownStyles.orderedList : markdownStyles.bulletList;

  return (
    <Component className={cn(listClass, className)} {...domProps}>
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
    const { checkbox, content } = splitTaskListItemChildren(children);

    return (
      <li
        className={cn(
          "mt-0.5 min-w-0 leading-6 list-none grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 [&>[data-slot=checkbox]]:mt-1",
          className,
        )}
        {...domProps}
      >
        <NestedMarkdownRenderContext>
          {checkbox}
          <div className="min-w-0 [overflow-wrap:anywhere] [&>*:last-child]:mb-0">{content}</div>
        </NestedMarkdownRenderContext>
      </li>
    );
  }

  return (
    <li className={cn(markdownStyles.listItem, className)} {...domProps}>
      <NestedMarkdownRenderContext>{children}</NestedMarkdownRenderContext>
    </li>
  );
};
