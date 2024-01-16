import { EditorRefActions } from "./Editor";

export const handleEditorKeydownWithMarkdownShortcuts = (event: React.KeyboardEvent, editorRef: EditorRefActions) => {
  if (event.key === "b") {
    const boldDelimiter = "**";
    event.preventDefault();
    styleHighlightedText(editorRef, boldDelimiter);
  } else if (event.key === "i") {
    const italicsDelimiter = "*";
    event.preventDefault();
    styleHighlightedText(editorRef, italicsDelimiter);
  } else if (event.key === "k") {
    event.preventDefault();
    hyperlinkHighlightedText(editorRef);
  }
};

export const hyperlinkHighlightedText = (editor: EditorRefActions, url?: string) => {
  const cursorPosition = editor.getCursorPosition();
  const selectedContent = editor.getSelectedContent();
  const blankURL = "url";
  url = url ?? blankURL;

  editor.insertText(`[${selectedContent}](${url})`);

  if (url === blankURL) {
    const newCursorStart = cursorPosition + selectedContent.length + 3;
    editor.setCursorPosition(newCursorStart, newCursorStart + url.length);
  }
};

const styleHighlightedText = (editor: EditorRefActions, delimiter: string) => {
  const cursorPosition = editor.getCursorPosition();
  const selectedContent = editor.getSelectedContent();
  if (selectedContent.startsWith(delimiter) && selectedContent.endsWith(delimiter)) {
    editor.insertText(selectedContent.slice(delimiter.length, -delimiter.length));
    const newContentLength = selectedContent.length - delimiter.length * 2;
    editor.setCursorPosition(cursorPosition, cursorPosition + newContentLength);
  } else {
    editor.insertText(`${delimiter}${selectedContent}${delimiter}`);
    editor.setCursorPosition(cursorPosition + delimiter.length, cursorPosition + delimiter.length + selectedContent.length);
  }
};
