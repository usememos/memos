import type { EditorRefActions } from "./index";

const SHORTCUTS = {
  BOLD: { key: "b", delimiter: "**" },
  ITALIC: { key: "i", delimiter: "*" },
  LINK: { key: "k" },
} as const;

const URL_PLACEHOLDER = "url";
const URL_REGEX = /^https?:\/\/[^\s]+$/;
const LINK_OFFSET = 3; // Length of "]()"

export function handleMarkdownShortcuts(event: React.KeyboardEvent, editor: EditorRefActions): void {
  const key = event.key.toLowerCase();
  if (key === SHORTCUTS.BOLD.key) {
    event.preventDefault();
    toggleTextStyle(editor, SHORTCUTS.BOLD.delimiter);
  } else if (key === SHORTCUTS.ITALIC.key) {
    event.preventDefault();
    toggleTextStyle(editor, SHORTCUTS.ITALIC.delimiter);
  } else if (key === SHORTCUTS.LINK.key) {
    event.preventDefault();
    insertHyperlink(editor);
  }
}

export function insertHyperlink(editor: EditorRefActions, url?: string): void {
  const cursorPosition = editor.getCursorPosition();
  const selectedContent = editor.getSelectedContent();
  const isUrlSelected = !url && URL_REGEX.test(selectedContent.trim());

  if (isUrlSelected) {
    editor.insertText(`[](${selectedContent})`);
    editor.setCursorPosition(cursorPosition + 1, cursorPosition + 1);
    return;
  }

  const href = url ?? URL_PLACEHOLDER;
  editor.insertText(`[${selectedContent}](${href})`);

  if (href === URL_PLACEHOLDER) {
    const urlStart = cursorPosition + selectedContent.length + LINK_OFFSET;
    editor.setCursorPosition(urlStart, urlStart + href.length);
  }
}

function toggleTextStyle(editor: EditorRefActions, delimiter: string): void {
  const cursorPosition = editor.getCursorPosition();
  const selectedContent = editor.getSelectedContent();
  const isStyled = selectedContent.startsWith(delimiter) && selectedContent.endsWith(delimiter);

  if (isStyled) {
    const unstyled = selectedContent.slice(delimiter.length, -delimiter.length);
    editor.insertText(unstyled);
    editor.setCursorPosition(cursorPosition, cursorPosition + unstyled.length);
  } else {
    editor.insertText(`${delimiter}${selectedContent}${delimiter}`);
    editor.setCursorPosition(cursorPosition + delimiter.length, cursorPosition + delimiter.length + selectedContent.length);
  }
}

export function hyperlinkHighlightedText(editor: EditorRefActions, url: string): void {
  const selectedContent = editor.getSelectedContent();
  const cursorPosition = editor.getCursorPosition();

  editor.insertText(`[${selectedContent}](${url})`);

  const newPosition = cursorPosition + selectedContent.length + url.length + 4;
  editor.setCursorPosition(newPosition, newPosition);
}
