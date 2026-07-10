import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";
import { useTagCounts } from "@/hooks/useUserQueries";
import { cn } from "@/lib/utils";
import type { EditorController } from "../types/editorController";
import { createController } from "./controller";
import "./editor.css";
import { buildEditorExtensions } from "./extensions";
import { createFormattingController } from "./formatting";

interface EditorProps {
  className: string;
  initialContent: string;
  placeholder: string;
  onContentChange: (content: string) => void;
  onPaste: (event: React.ClipboardEvent) => void;
  /** Invoked by the in-editor save shortcut (Cmd/Ctrl+Enter). */
  onSubmit: () => void;
  isFocusMode?: boolean;
}

const Editor = forwardRef(function Editor(props: EditorProps, ref: React.ForwardedRef<EditorController>) {
  const { className, initialContent, placeholder, onContentChange, onPaste, onSubmit, isFocusMode } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const controllerRef = useRef<EditorController | null>(null);
  const onChangeRef = useRef(onContentChange);
  onChangeRef.current = onContentChange;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const listenersRef = useRef(new Set<() => void>());
  const { data: tagData } = useTagCounts();
  const tags = useMemo(() => Object.keys(tagData ?? {}), [tagData]);
  const tagsRef = useRef(tags);
  tagsRef.current = tags;

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
          onChange: (md) => onChangeRef.current(md),
          onUpdate: () => listenersRef.current.forEach((l) => l()),
          onSubmit: () => onSubmitRef.current(),
          getTags: () => tagsRef.current,
        }),
      }),
      parent: hostRef.current,
    });
    viewRef.current = view;
    controllerRef.current = createController(view, createFormattingController(view, listenersRef.current));
    return () => {
      view.destroy();
      viewRef.current = null;
      controllerRef.current = null;
    };
    // Mount once; external sync handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (view.state.doc.toString() === initialContent) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: initialContent } });
  }, [initialContent]);

  // The controller is created in the mount layout effect above, which runs
  // before this (also layout-phase) handle, so controllerRef.current is set.
  useImperativeHandle(ref, () => controllerRef.current as EditorController, []);

  return (
    <div
      className={cn("relative flex w-full flex-col items-start justify-start bg-inherit", isFocusMode && "min-h-0 flex-1", className)}
      data-focus-mode={isFocusMode || undefined}
    >
      <div ref={hostRef} className={cn("w-full text-base", isFocusMode && "min-h-0 flex-1")} onPaste={onPaste} />
    </div>
  );
});

export default Editor;
