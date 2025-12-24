import { observer } from "mobx-react-lite";
import { useMemo, useRef } from "react";
import { toast } from "react-hot-toast";
import useCurrentUser from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { EditorContent, EditorMetadata, EditorToolbar, FocusModeExitButton, FocusModeOverlay } from "./components";
import { FOCUS_MODE_STYLES } from "./constants";
import type { EditorRefActions } from "./Editor";
import { useAutoSave, useFocusMode, useKeyboard, useMemoInit } from "./hooks";
import { cacheService, errorService, memoService, validationService } from "./services";
import { EditorProvider, useEditorContext } from "./state";
import { MemoEditorContext } from "./types";

export interface MemoEditorProps {
  className?: string;
  cacheKey?: string;
  placeholder?: string;
  memoName?: string;
  parentMemoName?: string;
  autoFocus?: boolean;
  onConfirm?: (memoName: string) => void;
  onCancel?: () => void;
}

const MemoEditor = observer((props: MemoEditorProps) => {
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

const MemoEditorImpl: React.FC<MemoEditorProps> = ({
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

  // Focus mode management with body scroll lock
  useFocusMode(state.ui.isFocusMode);

  const handleToggleFocusMode = () => {
    dispatch(actions.toggleFocusMode());
  };

  // Keyboard shortcuts
  useKeyboard(editorRef, { onSave: handleSave, onToggleFocusMode: handleToggleFocusMode });

  async function handleSave() {
    const { valid, reason } = validationService.canSave(state);
    if (!valid) {
      toast.error(reason || "Cannot save");
      return;
    }

    dispatch(actions.setLoading("saving", true));

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
      dispatch(actions.reset());

      // Notify parent
      onConfirm?.(result.memoName);

      toast.success("Saved successfully");
    } catch (error) {
      const message = errorService.handle(error, t);
      toast.error(message);
    } finally {
      dispatch(actions.setLoading("saving", false));
    }
  }

  return (
    <MemoEditorContext.Provider value={legacyContextValue}>
      <FocusModeOverlay isActive={state.ui.isFocusMode} onToggle={handleToggleFocusMode} />

      {/*
        Layout structure:
        - Uses justify-between to push content to top and bottom
        - In focus mode: becomes fixed with specific spacing, editor grows to fill space
        - In normal mode: stays relative with max-height constraint
      */}
      <div
        className={cn(
          "group relative w-full flex flex-col justify-between items-start bg-card px-4 pt-3 pb-1 rounded-lg border border-border",
          FOCUS_MODE_STYLES.transition,
          state.ui.isFocusMode && cn(FOCUS_MODE_STYLES.container.base, FOCUS_MODE_STYLES.container.spacing),
          className,
        )}
      >
        {/* Exit button is absolutely positioned in top-right corner when active */}
        <FocusModeExitButton isActive={state.ui.isFocusMode} onToggle={handleToggleFocusMode} title={t("editor.exit-focus-mode")} />

        {/* Editor content grows to fill available space in focus mode */}
        <EditorContent ref={editorRef} placeholder={placeholder} autoFocus={autoFocus} />

        {/* Metadata and toolbar grouped together at bottom */}
        <div className="w-full flex flex-col gap-2">
          <EditorMetadata />
          <EditorToolbar onSave={handleSave} onCancel={onCancel} />
        </div>
      </div>
    </MemoEditorContext.Provider>
  );
};

export default MemoEditor;
