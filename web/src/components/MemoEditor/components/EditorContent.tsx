import { XIcon } from "lucide-react";
import { forwardRef } from "react";
import Editor, { type EditorRefActions } from "../Editor";
import { useBlobUrls, useDragAndDrop } from "../hooks";
import { useEditorContext } from "../state";
import type { EditorContentProps } from "../types";
import type { LocalFile } from "../types/attachment";
import { toAttachmentItems } from "../types/attachment";

export const EditorContent = forwardRef<EditorRefActions, EditorContentProps>(({ placeholder }, ref) => {
  const { state, actions, dispatch } = useEditorContext();
  const { createBlobUrl } = useBlobUrls();

  const { dragHandlers } = useDragAndDrop((files: FileList) => {
    const localFiles: LocalFile[] = Array.from(files).map((file) => ({
      file,
      previewUrl: createBlobUrl(file),
    }));
    localFiles.forEach((localFile) => dispatch(actions.addLocalFile(localFile)));
  });

  const handleCompositionStart = () => {
    dispatch(actions.setComposing(true));
  };

  const handleCompositionEnd = () => {
    dispatch(actions.setComposing(false));
  };

  const handleContentChange = (content: string) => {
    dispatch(actions.updateContent(content));
  };

  const handlePaste = (event: React.ClipboardEvent<Element>) => {
    const clipboard = event.clipboardData;
    if (!clipboard) return;

    const files: File[] = [];
    if (clipboard.items && clipboard.items.length > 0) {
      for (const item of Array.from(clipboard.items)) {
        if (item.kind !== "file") continue;
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    } else if (clipboard.files && clipboard.files.length > 0) {
      files.push(...Array.from(clipboard.files));
    }

    if (files.length === 0) return;

    const localFiles: LocalFile[] = files.map((file) => ({
      file,
      previewUrl: createBlobUrl(file),
    }));
    localFiles.forEach((localFile) => dispatch(actions.addLocalFile(localFile)));
    event.preventDefault();
  };

  return (
    <div className="w-full flex flex-col flex-1" {...dragHandlers}>
      <Editor
        ref={ref}
        className="memo-editor-content"
        initialContent={state.content}
        placeholder={placeholder || ""}
        isFocusMode={state.ui.isFocusMode}
        isInIME={state.ui.isComposing}
        onContentChange={handleContentChange}
        onPaste={handlePaste}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
      />
      {/* Inline image previews for editor uploads: placed after editor content */}
      {(() => {
        const items = toAttachmentItems(state.metadata.attachments, state.localFiles);
        const imageItems = items.filter((it) => it.category === "image");
        if (imageItems.length === 0) return null;

        // Show images in rows with max 3 columns per row (unlimited rows)
        const imagesToShow = imageItems;

        const handleRemoveImage = (id: string, isLocal: boolean) => {
          if (isLocal) {
            dispatch(actions.removeLocalFile(id));
            return;
          }
          dispatch(actions.removeAttachment(id));
        };

        return (
          <div className="mt-3 grid gap-2 grid-cols-3">
            {imagesToShow.map((img) => (
              <div key={img.id} className="relative group">
                <img src={img.thumbnailUrl} alt={img.filename} className="w-full h-28 object-cover rounded" />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(img.id, img.isLocal)}
                  className="absolute top-1 right-1 inline-flex items-center justify-center size-5 rounded-full bg-black/60 text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                  aria-label="移除图片"
                  title="移除图片"
                >
                  <XIcon className="size-3" />
                </button>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
});

EditorContent.displayName = "EditorContent";
