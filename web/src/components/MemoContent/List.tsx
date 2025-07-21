import { head } from "lodash-es";
import React from "react";
import { cn } from "@/lib/utils";
import { ListNode_Kind, Node, NodeType } from "@/types/proto/api/v1/markdown_service";
import Renderer from "./Renderer";

interface Props {
  index: string;
  kind: ListNode_Kind;
  indent: number;
  children: Node[];
}

const List: React.FC<Props> = ({ kind, indent, children }: Props) => {
  let prevNode: Node | null = null;
  let skipNextLineBreakFlag = false;

  const getListContainer = () => {
    switch (kind) {
      case ListNode_Kind.ORDERED:
        return "ol";
      case ListNode_Kind.UNORDERED:
        return "ul";
      case ListNode_Kind.DESCRIPTION:
        return "dl";
      default:
        return "div";
    }
  };

  const getAttributes = () => {
    const attrs: any = {
      style: { paddingLeft: `${indent > 0 ? indent * 10 : 20}px` },
    };
    const firstChild = head(children);
    if (firstChild?.type === NodeType.ORDERED_LIST_ITEM) {
      attrs.start = firstChild.orderedListItemNode?.number;
    } else if (firstChild?.type === NodeType.TASK_LIST_ITEM) {
      attrs.style = { paddingLeft: `${indent * 8}px` };
    }
    return attrs;
  };

  return React.createElement(
    getListContainer(),
    {
      className: cn(kind === ListNode_Kind.ORDERED ? "list-decimal" : kind === ListNode_Kind.UNORDERED ? "list-disc" : "list-none"),
      ...getAttributes(),
    },
    children.map((child, index) => {
      if (prevNode?.type !== NodeType.LINE_BREAK && child.type === NodeType.LINE_BREAK && skipNextLineBreakFlag) {
        skipNextLineBreakFlag = false;
        return null;
      }

      prevNode = child;
      skipNextLineBreakFlag = true;
      return <Renderer key={`${child.type}-${index}`} index={String(index)} node={child} />;
    }),
  );
};

export default List;
