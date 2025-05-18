import { Resource } from "@/types/proto/api/v1/resource_service";
import { getResourceUrl } from "@/utils/resource";
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

  // If the selected content looks like a URL and no URL is provided,
  // create a link with empty text and the URL
  const urlRegex = /^(https?:\/\/[^\s]+)$/;
  if (!url && urlRegex.test(selectedContent.trim())) {
    editor.insertText(`[](${selectedContent})`);
    editor.setCursorPosition(cursorPosition + 1, cursorPosition + 1);
  } else {
    url = url ?? blankURL;

    editor.insertText(`[${selectedContent}](${url})`);

    if (url === blankURL) {
      const newCursorStart = cursorPosition + selectedContent.length + 3;
      editor.setCursorPosition(newCursorStart, newCursorStart + url.length);
    }
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

export function insertResourceText(editor: EditorRefActions, resources: Resource[], placeholder: string) {
  if (!placeholder) return;

  let text = editor.getContent();
  const pos = text.indexOf(placeholder);
  if (pos === -1) return;

  const insertingParts: string[] = [];
  for (const res of resources) {
    const isImage = String(res.type).startsWith("image/");
    const title = res.filename;
    const url = getResourceUrl(res);

    let part = `[${title}](${url})`;
    if (isImage) part = `!${part}`;

    insertingParts.push(part);
  }
  const inserting = insertingParts.join(" ");

  // compute new cursorPos
  let cursorPos = editor.getCursorPosition();
  let selectionLength = 0;

  if (cursorPos > pos + placeholder.length) {
    cursorPos += inserting.length - placeholder.length;
  } else if (cursorPos >= pos) {
    cursorPos = pos;
    selectionLength = inserting.length;
  }

  text = text.slice(0, pos) + inserting + text.slice(pos + placeholder.length);

  editor.setContent(text);
  editor.setCursorPosition(cursorPos, cursorPos + selectionLength);
}
