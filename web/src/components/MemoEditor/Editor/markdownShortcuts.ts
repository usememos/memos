import type { EditorRefActions } from "./index";

export function handleMarkdownShortcuts(event: React.KeyboardEvent, editor: EditorRefActions): void {
  switch (event.key.toLowerCase()) {
    case "b":
      event.preventDefault();
      toggleTextStyle(editor, "**");
      break;
    case "i":
      event.preventDefault();
      toggleTextStyle(editor, "*");
      break;
    case "k":
      event.preventDefault();
      insertHyperlink(editor);
      break;
  }
}

export function insertHyperlink(editor: EditorRefActions, url?: string): void {
  const cursorPosition = editor.getCursorPosition();
  const selectedContent = editor.getSelectedContent();
  const placeholderUrl = "url";
  const urlRegex = /^https?:\/\/[^\s]+$/;

  if (!url && urlRegex.test(selectedContent.trim())) {
    editor.insertText(`[](${selectedContent})`);
    editor.setCursorPosition(cursorPosition + 1, cursorPosition + 1);
    return;
  }

  const href = url ?? placeholderUrl;
  editor.insertText(`[${selectedContent}](${href})`);

  if (href === placeholderUrl) {
    const urlStart = cursorPosition + selectedContent.length + 3;
    editor.setCursorPosition(urlStart, urlStart + href.length);
  }
}

function toggleTextStyle(editor: EditorRefActions, delimiter: string): void {
  const cursorPosition = editor.getCursorPosition();
  const selectedContent = editor.getSelectedContent();

  if (selectedContent.startsWith(delimiter) && selectedContent.endsWith(delimiter)) {
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
