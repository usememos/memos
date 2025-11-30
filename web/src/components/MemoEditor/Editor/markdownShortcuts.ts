import type { EditorRefActions } from "./index";

/**
 * Handles keyboard shortcuts for markdown formatting
 * Requires Cmd/Ctrl key to be pressed
 */
export function handleMarkdownShortcuts(event: React.KeyboardEvent, editor: EditorRefActions): void {
  switch (event.key.toLowerCase()) {
    case "b":
      event.preventDefault();
      toggleTextStyle(editor, "**"); // Bold
      break;
    case "i":
      event.preventDefault();
      toggleTextStyle(editor, "*"); // Italic
      break;
    case "k":
      event.preventDefault();
      insertHyperlink(editor);
      break;
  }
}

/**
 * Inserts a hyperlink for the selected text
 * If selected text is a URL, creates a link with empty text
 * Otherwise, creates a link with placeholder URL
 */
export function insertHyperlink(editor: EditorRefActions, url?: string): void {
  const cursorPosition = editor.getCursorPosition();
  const selectedContent = editor.getSelectedContent();
  const placeholderUrl = "url";
  const urlRegex = /^https?:\/\/[^\s]+$/;

  // If selected content looks like a URL and no URL provided, use it as the href
  if (!url && urlRegex.test(selectedContent.trim())) {
    editor.insertText(`[](${selectedContent})`);
    // Move cursor between brackets for text input
    editor.setCursorPosition(cursorPosition + 1, cursorPosition + 1);
    return;
  }

  const href = url ?? placeholderUrl;
  editor.insertText(`[${selectedContent}](${href})`);

  // If using placeholder URL, select it for easy replacement
  if (href === placeholderUrl) {
    const urlStart = cursorPosition + selectedContent.length + 3; // After "]("
    editor.setCursorPosition(urlStart, urlStart + href.length);
  }
}

/**
 * Toggles text styling (bold, italic, etc.)
 * If already styled, removes the style; otherwise adds it
 */
function toggleTextStyle(editor: EditorRefActions, delimiter: string): void {
  const cursorPosition = editor.getCursorPosition();
  const selectedContent = editor.getSelectedContent();

  // Check if already styled - remove style
  if (selectedContent.startsWith(delimiter) && selectedContent.endsWith(delimiter)) {
    const unstyled = selectedContent.slice(delimiter.length, -delimiter.length);
    editor.insertText(unstyled);
    editor.setCursorPosition(cursorPosition, cursorPosition + unstyled.length);
  } else {
    // Add style
    editor.insertText(`${delimiter}${selectedContent}${delimiter}`);
    editor.setCursorPosition(cursorPosition + delimiter.length, cursorPosition + delimiter.length + selectedContent.length);
  }
}

/**
 * Hyperlinks the currently highlighted/selected text with the given URL
 * Used when pasting a URL while text is selected
 */
export function hyperlinkHighlightedText(editor: EditorRefActions, url: string): void {
  const selectedContent = editor.getSelectedContent();
  const cursorPosition = editor.getCursorPosition();

  editor.insertText(`[${selectedContent}](${url})`);

  // Position cursor after the link
  const newPosition = cursorPosition + selectedContent.length + url.length + 4; // []()
  editor.setCursorPosition(newPosition, newPosition);
}
