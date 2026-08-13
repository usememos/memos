import { EditorState } from "@codemirror/state";
import { placeholder as cmPlaceholder, EditorView } from "@codemirror/view";
import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";
import { useTagCounts } from "@/hooks/useUserQueries";
import { cn } from "@/lib/utils";
import type { EditorController } from "../types/editorController";
import { createController } from "./controller";
import "./editor.css";
import { buildEditorExtensions, placeholderCompartment } from "./extensions";
import { createFormattingController } from "./formatting";

interface EditorProps {
  className: string;
  initialContent: string;
  contentIsExternal?: boolean;
  placeholder: string;
  onContentChange: (content: string) => void;
  onExternalContentApplied?: (content: string) => void;
  onFiles: (files: File[], position: number) => void;
  /** Invoked by the in-editor save shortcut (Cmd/Ctrl+Enter). */
  onSubmit: () => void;
  isFocusMode?: boolean;
}

const Editor = forwardRef(function Editor(props: EditorProps, ref: React.ForwardedRef<EditorController>) {
  const {
    className,
    initialContent,
    contentIsExternal = true,
    placeholder,
    onContentChange,
    onExternalContentApplied,
    onFiles,
    onSubmit,
    isFocusMode,
  } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const controllerRef = useRef<EditorController | null>(null);
  const applyingExternalContentRef = useRef(false);
  const pendingExternalContentRef = useRef<string | null>(null);
  const onChangeRef = useRef(onContentChange);
  onChangeRef.current = onContentChange;
  const onExternalContentAppliedRef = useRef(onExternalContentApplied);
  onExternalContentAppliedRef.current = onExternalContentApplied;
  const onFilesRef = useRef(onFiles);
  onFilesRef.current = onFiles;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const placeholderRef = useRef(placeholder);
  const listenersRef = useRef(new Set<() => void>());
  // A user can only author their own memos. Reuse the current-user stats query
  // instead of fetching and aggregating every user's tags for autocomplete.
  const { data: tagData } = useTagCounts(true);
  const tags = useMemo(() => Object.keys(tagData ?? {}), [tagData]);
  const tagsRef = useRef(tags);
  tagsRef.current = tags;

  const applyExternalContent = useCallback((content: string) => {
    pendingExternalContentRef.current = null;
    const controller = controllerRef.current;
    if (!controller || controller.getMarkdown() === content) return;
    applyingExternalContentRef.current = true;
    try {
      controller.setMarkdown(content);
    } finally {
      applyingExternalContentRef.current = false;
    }
  }, []);

  // useLayoutEffect (not useEffect) so the EditorView — and its placeholder —
  // mount before the browser paints. With useEffect the first painted frame
  // shows an empty host, then the placeholder pops in (a load flicker).
  useLayoutEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      state: EditorState.create({
        doc: initialContent,
        extensions: buildEditorExtensions({
          placeholder,
          onChange: (md) => {
            if (!applyingExternalContentRef.current) onChangeRef.current(md);
          },
          onFiles: (files, position) => onFilesRef.current(files, position),
          onUpdate: () => listenersRef.current.forEach((l) => l()),
          onSubmit: () => onSubmitRef.current(),
          getTags: () => tagsRef.current,
        }),
      }),
      parent: hostRef.current,
    });
    viewRef.current = view;
    controllerRef.current = createController(view, createFormattingController(view, listenersRef.current));
    const handleCompositionEnd = () => {
      // CodeMirror may flush its final Firefox/Android DOM mutations in a
      // microtask after compositionend. Queue behind that flush before
      // replacing the document with a deferred external value.
      queueMicrotask(() => {
        if (viewRef.current !== view || view.compositionStarted) return;
        const pendingContent = pendingExternalContentRef.current;
        if (pendingContent === null) return;
        applyExternalContent(pendingContent);
        // The composition may have emitted a newer local value after this
        // deferred external value entered the store. Reassert the applied
        // external value there too.
        onExternalContentAppliedRef.current?.(pendingContent);
      });
    };
    view.contentDOM.addEventListener("compositionend", handleCompositionEnd);
    return () => {
      view.contentDOM.removeEventListener("compositionend", handleCompositionEnd);
      view.destroy();
      viewRef.current = null;
      controllerRef.current = null;
    };
    // Mount once; external sync handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (placeholderRef.current === placeholder) return;
    placeholderRef.current = placeholder;
    viewRef.current?.dispatch({ effects: placeholderCompartment.reconfigure(cmPlaceholder(placeholder)) });
  }, [placeholder]);

  useLayoutEffect(() => {
    if (!contentIsExternal) return;
    const view = viewRef.current;
    if (!view) return;
    if (view.compositionStarted) {
      pendingExternalContentRef.current = initialContent;
      return;
    }
    applyExternalContent(initialContent);
  }, [applyExternalContent, contentIsExternal, initialContent]);

  // The controller is created in the mount layout effect above, which runs
  // before this (also layout-phase) handle, so controllerRef.current is set.
  useImperativeHandle(ref, () => controllerRef.current as EditorController, []);

  return (
    <div
      className={cn("relative flex w-full flex-col items-start justify-start bg-inherit", isFocusMode && "min-h-0 flex-1", className)}
      data-focus-mode={isFocusMode || undefined}
    >
      <div ref={hostRef} className={cn("w-full text-base", isFocusMode && "min-h-0 flex-1")} />
    </div>
  );
});

export default Editor;
