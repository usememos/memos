import { forwardRef, useLayoutEffect, useRef } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslate } from "@/utils/i18n";
import Editor from "../Editor";
import { useEditorContext, useEditorSelector } from "../state";
import type { EditorContentProps } from "../types";
import type { EditorController } from "../types/editorController";

// Imported eagerly (not React.lazy): the editor is the always-present compose
// box on the home route, which is already code-split — so deferring the
// editor bundle separately bought nothing and made the editor paint empty
// for a beat before its placeholder appeared (a visible flicker on load).

/**
 * Hosts the Markdown Editor behind the EditorController contract. The
 * editor writes into state.content on every change.
 */
export const EditorContent = forwardRef<EditorController, EditorContentProps>(
  ({ placeholder, sourceMode, onSubmit, onFiles, tagsSetting }, ref) => {
    const t = useTranslate();
    const wrapperRef = useRef<HTMLDivElement>(null);
    const sourceTagRef = useRef<HTMLButtonElement>(null);
    const isSourceMode = sourceMode.isSourceMode;
    const sourceLabel = t("editor.source");
    // The first line of the text leaves room for the tag; its width varies by language.
    useLayoutEffect(() => {
      const width = isSourceMode ? sourceTagRef.current?.offsetWidth : undefined;
      wrapperRef.current?.style.setProperty("--memo-source-tag-width", width ? `${width}px` : "0px");
    }, [isSourceMode, sourceLabel]);
    const { actions, dispatch } = useEditorContext();
    const content = useEditorSelector((s) => s.content);
    const isFocusMode = useEditorSelector((s) => s.ui.isFocusMode);
    const attachments = useEditorSelector((s) => s.metadata.attachments);

    const handleContentChange = (content: string) => {
      dispatch(actions.updateContent(content));
    };

    return (
      <div ref={wrapperRef} className="relative w-full flex flex-col flex-1">
        <Editor
          ref={ref}
          className="memo-editor-content"
          value={content}
          placeholder={placeholder || ""}
          isFocusMode={isFocusMode}
          mode={isSourceMode ? "source" : "rich"}
          attachments={attachments}
          tagsSetting={tagsSetting}
          onContentChange={handleContentChange}
          onFiles={onFiles}
          onSubmit={onSubmit}
        />
        {/* Source mode names itself in the corner, as a code block names its language, and switches back from there.
            It fills on hover like the toolbar's quiet buttons, so it reads as a button once pointed at. */}
        {isSourceMode && (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  ref={sourceTagRef}
                  type="button"
                  onClick={sourceMode.onToggle}
                  className="absolute end-0 top-0.5 flex h-5 cursor-pointer items-center rounded px-1 text-2xs text-muted-foreground outline-none transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:bg-muted/60 focus-visible:text-foreground"
                />
              }
            >
              {sourceLabel}
            </TooltipTrigger>
            <TooltipContent side="top">{t("editor.switch-to-rich-text")}</TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  },
);

EditorContent.displayName = "EditorContent";
