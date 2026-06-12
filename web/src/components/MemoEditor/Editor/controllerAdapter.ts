import type { EditorController } from "../types/editorController";
import type { EditorRefActions } from "./index";
import { toggleTextStyle } from "./shortcuts";

const TASK_PREFIX = "- [ ] ";

/**
 * Adapts the textarea editor's imperative string-surgery API to the shared
 * EditorController contract. Takes a getter because the underlying ref is
 * populated after mount and may swap when the editor remounts.
 */
export function createTextareaController(getActions: () => EditorRefActions | null): EditorController {
  return {
    focus: () => getActions()?.focus(),
    hasFocus: () => {
      const element = getActions()?.getEditor();
      return Boolean(element) && document.activeElement === element;
    },
    isEmpty: () => (getActions()?.getContent() ?? "").trim() === "",
    getMarkdown: () => getActions()?.getContent() ?? "",
    setMarkdown: (markdown) => getActions()?.setContent(markdown),
    insertMarkdown: (markdown) => {
      const actions = getActions();
      if (!actions) return;
      if (!markdown) return;
      const content = actions.getContent();
      const cursor = actions.getCursorPosition();
      const before = content.slice(0, cursor);
      const after = content.slice(cursor);
      const prefix = before.length === 0 || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
      const suffix = after.length === 0 || after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
      actions.insertText(markdown, prefix, suffix);
    },
    scrollToCursor: () => getActions()?.scrollToCursor(),
    selectAll: () => {
      const actions = getActions();
      if (!actions) return;
      actions.setCursorPosition(0, actions.getContent().length);
    },
    toggleBold: () => {
      const actions = getActions();
      if (actions) toggleTextStyle(actions, "**");
    },
    toggleItalic: () => {
      const actions = getActions();
      if (actions) toggleTextStyle(actions, "*");
    },
    toggleTaskList: () => {
      const actions = getActions();
      if (!actions) return;
      const lineNumber = actions.getCursorLineNumber();
      const line = actions.getLine(lineNumber);
      const taskMatch = line.match(/^(\s*)- \[[ xX]\] /);
      if (taskMatch) {
        actions.setLine(lineNumber, taskMatch[1] + line.slice(taskMatch[0].length));
      } else {
        const indentMatch = line.match(/^(\s*)/);
        const indent = indentMatch?.[1] ?? "";
        actions.setLine(lineNumber, `${indent}${TASK_PREFIX}${line.slice(indent.length)}`);
      }
    },
  };
}
