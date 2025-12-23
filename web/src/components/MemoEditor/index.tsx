import { observer } from "mobx-react-lite";
import { useMemo, useRef } from "react";
import { toast } from "react-hot-toast";
import useCurrentUser from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { EditorContent, EditorMetadata, EditorToolbar, FocusModeOverlay } from "./components";
import type { EditorRefActions } from "./Editor";
import { useAutoSave, useKeyboard, useMemoInit } from "./hooks";
import { cacheService, errorService, memoService, validationService } from "./services";
import { EditorProvider, useEditorContext } from "./state";
import { MemoEditorContext } from "./types";

export interface Props {
  className?: string;
  cacheKey?: string;
  placeholder?: string;
  memoName?: string;
  parentMemoName?: string;
  autoFocus?: boolean;
  onConfirm?: (memoName: string) => void;
  onCancel?: () => void;
}

const MemoEditor = observer((props: Props) => {
  const { className, cacheKey, memoName, parentMemoName, autoFocus, placeholder, onConfirm, onCancel } = props;

  return (
    <EditorProvider>
      <MemoEditorImpl
        className={className}
        cacheKey={cacheKey}
        memoName={memoName}
        parentMemoName={parentMemoName}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    </EditorProvider>
  );
});

const MemoEditorImpl: React.FC<Props> = ({
  className,
  cacheKey,
  memoName,
  parentMemoName,
  autoFocus,
  placeholder,
  onConfirm,
  onCancel,
}) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const editorRef = useRef<EditorRefActions>(null);
  const { state, actions, dispatch } = useEditorContext();

  // Bridge for old MemoEditorContext (used by InsertMenu and other components)
  const legacyContextValue = useMemo(
    () => ({
      attachmentList: state.metadata.attachments,
      relationList: state.metadata.relations,
      setAttachmentList: (attachments: typeof state.metadata.attachments) => dispatch(actions.setMetadata({ attachments })),
      setRelationList: (relations: typeof state.metadata.relations) => dispatch(actions.setMetadata({ relations })),
      memoName,
      addLocalFiles: (files: typeof state.localFiles) => {
        files.forEach((file) => dispatch(actions.addLocalFile(file)));
      },
      removeLocalFile: (previewUrl: string) => dispatch(actions.removeLocalFile(previewUrl)),
      localFiles: state.localFiles,
    }),
    [state.metadata.attachments, state.metadata.relations, state.localFiles, memoName, actions, dispatch],
  );

  // Initialize editor (load memo or cache)
  useMemoInit(editorRef, memoName, cacheKey, currentUser.name, autoFocus);

  // Auto-save content to localStorage
  useAutoSave(state.content, currentUser.name, cacheKey);

  // Keyboard shortcuts
  useKeyboard(editorRef, { onSave: handleSave });

  async function handleSave() {
    const { valid, reason } = validationService.canSave(state);
    if (!valid) {
      toast.error(reason || "Cannot save");
      return;
    }

    actions.setLoading("saving", true);

    try {
      const result = await memoService.save(state, { memoName, parentMemoName });

      if (!result.hasChanges) {
        toast.error(t("editor.no-changes-detected"));
        onCancel?.();
        return;
      }

      // Clear cache on successful save
      cacheService.clear(cacheService.key(currentUser.name, cacheKey));

      // Reset editor state
      actions.reset();

      // Notify parent
      onConfirm?.(result.memoName);

      toast.success("Saved successfully");
    } catch (error) {
      const message = errorService.handle(error, t);
      toast.error(message);
    } finally {
      actions.setLoading("saving", false);
    }
  }

  return (
    <MemoEditorContext.Provider value={legacyContextValue}>
      <FocusModeOverlay isActive={state.ui.isFocusMode} onToggle={actions.toggleFocusMode} />

      <div className={cn("memo-editor-wrapper", state.ui.isFocusMode && "focus-mode", className)}>
        <EditorToolbar onSave={handleSave} onCancel={onCancel} />
        <EditorContent ref={editorRef} placeholder={placeholder} autoFocus={autoFocus} />
        <EditorMetadata />
      </div>
    </MemoEditorContext.Provider>
  );
};

export default MemoEditor;
