import { last } from "lodash-es";
import { useEffect } from "react";
import { NodeType, OrderedListNode, TaskListNode, UnorderedListNode } from "@/types/node";
import { EditorRefActions } from "../Editor";

const useAutoComplete = (actions: EditorRefActions) => {
  useEffect(() => {
    const editor = actions.getEditor();
    if (!editor) return;

    editor.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        const cursorPosition = actions.getCursorPosition();
        const prevContent = actions.getContent().substring(0, cursorPosition);
        const lastNode = last(window.parse(prevContent));
        if (!lastNode) {
          return;
        }

        let insertText = "";
        if (lastNode.type === NodeType.TASK_LIST) {
          const { complete } = lastNode.value as TaskListNode;
          insertText = complete ? "- [x] " : "- [ ] ";
        } else if (lastNode.type === NodeType.UNORDERED_LIST) {
          const { symbol } = lastNode.value as UnorderedListNode;
          insertText = `${symbol} `;
        } else if (lastNode.type === NodeType.ORDERED_LIST) {
          const { number } = lastNode.value as OrderedListNode;
          insertText = `${Number(number) + 1}. `;
        }
        if (insertText) {
          actions.insertText(`\n${insertText}`);
          event.preventDefault();
        }
      }
    });
  }, []);
};

export default useAutoComplete;
