import { observer } from "mobx-react-lite";
import { memo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import useCurrentUser from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { memoStore } from "@/store";
import { useTranslate } from "@/utils/i18n";
import { remarkDisableSetext } from "@/utils/remark-plugins/remark-disable-setext";
import { remarkPreserveType } from "@/utils/remark-plugins/remark-preserve-type";
import { remarkTag } from "@/utils/remark-plugins/remark-tag";
import { isSuperUser } from "@/utils/user";
import { CodeBlock } from "./CodeBlock";
import { createConditionalComponent, isTagNode, isTaskListItemNode } from "./ConditionalComponent";
import { SANITIZE_SCHEMA } from "./constants";
import { useCompactLabel, useCompactMode } from "./hooks";
import { MemoContentContext } from "./MemoContentContext";
import { Tag } from "./Tag";
import { TaskListItem } from "./TaskListItem";
import type { MemoContentProps } from "./types";

const MemoContent = observer((props: MemoContentProps) => {
  const { className, contentClassName, content, memoName, onClick, onDoubleClick } = props;
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const {
    containerRef: memoContentContainerRef,
    mode: showCompactMode,
    toggle: toggleCompactMode,
  } = useCompactMode(Boolean(props.compact));
  const memo = memoName ? memoStore.getMemoByName(memoName) : null;
  const allowEdit = !props.readonly && memo && (currentUser?.name === memo.creator || isSuperUser(currentUser));

  const contextValue = {
    memoName,
    readonly: !allowEdit,
    disableFilter: props.disableFilter,
    parentPage: props.parentPage,
    containerRef: memoContentContainerRef,
  };

  const compactLabel = useCompactLabel(showCompactMode, t as (key: string) => string);

  return (
    <MemoContentContext.Provider value={contextValue}>
      <div className={`w-full flex flex-col justify-start items-start text-foreground ${className || ""}`}>
        <div
          ref={memoContentContainerRef}
          className={cn(
            "markdown-content relative w-full max-w-full wrap-break-word text-base leading-6",
            showCompactMode === "ALL" && "line-clamp-6 max-h-60",
            contentClassName,
          )}
          onMouseUp={onClick}
          onDoubleClick={onDoubleClick}
        >
          <ReactMarkdown
            remarkPlugins={[remarkDisableSetext, remarkGfm, remarkBreaks, remarkMath, remarkTag, remarkPreserveType]}
            rehypePlugins={[rehypeRaw, rehypeKatex, [rehypeSanitize, SANITIZE_SCHEMA]]}
            components={{
              // Conditionally render custom components based on AST node type
              input: createConditionalComponent(TaskListItem, "input", isTaskListItemNode),
              span: createConditionalComponent(Tag, "span", isTagNode),
              pre: CodeBlock,
              a: ({ href, children, ...props }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                  {children}
                </a>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
        {showCompactMode === "ALL" && (
          <div className="absolute bottom-0 left-0 w-full h-12 bg-linear-to-b from-transparent to-background pointer-events-none"></div>
        )}
        {showCompactMode !== undefined && (
          <div className="w-full mt-1">
            <button
              type="button"
              className="w-auto flex flex-row justify-start items-center cursor-pointer text-sm text-primary hover:opacity-80 text-left"
              onClick={toggleCompactMode}
            >
              {compactLabel}
            </button>
          </div>
        )}
      </div>
    </MemoContentContext.Provider>
  );
});

export default memo(MemoContent);
