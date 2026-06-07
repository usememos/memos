import type { EditorRefActions } from "./index";

const SHORTCUTS = {
  BOLD: { key: "b", delimiter: "**" },
  ITALIC: { key: "i", delimiter: "*" },
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
  const isStyled = isTextStyled(selectedContent, delimiter);

  if (isStyled) {
    const unstyled = selectedContent.slice(delimiter.length, -delimiter.length);
    editor.insertText(unstyled);
    editor.setCursorPosition(cursorPosition, cursorPosition + unstyled.length);
  } else {
    editor.insertText(`${delimiter}${selectedContent}${delimiter}`);
    editor.setCursorPosition(cursorPosition + delimiter.length, cursorPosition + delimiter.length + selectedContent.length);
  }
}

function isTextStyled(text: string, delimiter: string): boolean {
  if (!text.startsWith(delimiter) || !text.endsWith(delimiter)) {
    return false;
  }

  if (delimiter !== "*") {
    return true;
  }

  const leadingAsterisks = countConsecutive(text, "*", "start");
  const trailingAsterisks = countConsecutive(text, "*", "end");
  return leadingAsterisks % 2 === 1 && trailingAsterisks % 2 === 1;
}

function countConsecutive(text: string, character: string, position: "start" | "end"): number {
  let count = 0;
  let index = position === "start" ? 0 : text.length - 1;

  while (index >= 0 && index < text.length && text[index] === character) {
    count += 1;
    index += position === "start" ? 1 : -1;
  }

  return count;
}

export function hyperlinkHighlightedText(editor: EditorRefActions, url: string): void {
  const selectedContent = editor.getSelectedContent();
  const cursorPosition = editor.getCursorPosition();

  editor.insertText(`[${selectedContent}](${url})`);

  const newPosition = cursorPosition + selectedContent.length + url.length + 4;
  editor.setCursorPosition(newPosition, newPosition);
}

export function getMarkdownLinkForPastedUrl(selectedContent: string, pastedText: string): string | undefined {
  const url = pastedText.trim();

  if (!selectedContent || !URL_REGEX.test(url) || URL_REGEX.test(selectedContent.trim())) {
    return undefined;
  }

  return `[${selectedContent}](${url})`;
}
