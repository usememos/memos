import { observer } from "mobx-react-lite";
import { memo, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import useCurrentUser from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { memoStore } from "@/store";
import { useTranslate } from "@/utils/i18n";
import { remarkPreserveType } from "@/utils/remark-plugins/remark-preserve-type";
import { remarkTag } from "@/utils/remark-plugins/remark-tag";
import { isSuperUser } from "@/utils/user";
import { createConditionalComponent, isTagNode, isTaskListItemNode } from "./ConditionalComponent";
import { MemoContentContext } from "./MemoContentContext";
import { Tag } from "./Tag";
import { TaskListItem } from "./TaskListItem";

// MAX_DISPLAY_HEIGHT is the maximum height of the memo content to display in compact mode.
const MAX_DISPLAY_HEIGHT = 256;

interface Props {
  content: string;
  memoName?: string;
  compact?: boolean;
  readonly?: boolean;
  disableFilter?: boolean;
  className?: string;
  contentClassName?: string;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  parentPage?: string;
}

type ContentCompactView = "ALL" | "SNIPPET";

const MemoContent = observer((props: Props) => {
  const { className, contentClassName, content, memoName, onClick, onDoubleClick } = props;
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const memoContentContainerRef = useRef<HTMLDivElement>(null);
  const [showCompactMode, setShowCompactMode] = useState<ContentCompactView | undefined>(undefined);
  const memo = memoName ? memoStore.getMemoByName(memoName) : null;
  const allowEdit = !props.readonly && memo && (currentUser?.name === memo.creator || isSuperUser(currentUser));

  // Context for custom components
  const contextValue = {
    memoName,
    readonly: !allowEdit,
    disableFilter: props.disableFilter,
    parentPage: props.parentPage,
  };

  // Initial compact mode.
  useEffect(() => {
    if (!props.compact) {
      return;
    }
    if (!memoContentContainerRef.current) {
      return;
    }

    if ((memoContentContainerRef.current as HTMLDivElement).getBoundingClientRect().height > MAX_DISPLAY_HEIGHT) {
      setShowCompactMode("ALL");
    }
  }, []);

  const onMemoContentClick = async (e: React.MouseEvent) => {
    // Image clicks and other handlers
    if (onClick) {
      onClick(e);
    }
  };

  const onMemoContentDoubleClick = async (e: React.MouseEvent) => {
    if (onDoubleClick) {
      onDoubleClick(e);
    }
  };

  const compactStates = {
    ALL: { text: t("memo.show-more"), nextState: "SNIPPET" },
    SNIPPET: { text: t("memo.show-less"), nextState: "ALL" },
  };

  return (
    <MemoContentContext.Provider value={contextValue}>
      <div className={`w-full flex flex-col justify-start items-start text-foreground ${className || ""}`}>
        <div
          ref={memoContentContainerRef}
          className={cn(
            "markdown-content relative w-full max-w-full break-words text-base leading-6",
            showCompactMode == "ALL" && "line-clamp-6 max-h-60",
            contentClassName,
          )}
          onClick={onMemoContentClick}
          onDoubleClick={onMemoContentDoubleClick}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkTag, remarkPreserveType]}
            rehypePlugins={[rehypeRaw]}
            components={{
              // Conditionally render custom components based on AST node type
              input: createConditionalComponent(TaskListItem, "input", isTaskListItemNode),
              span: createConditionalComponent(Tag, "span", isTagNode),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
        {showCompactMode == "ALL" && (
          <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-b from-transparent to-background pointer-events-none"></div>
        )}
        {showCompactMode != undefined && (
          <div className="w-full mt-1">
            <span
              className="w-auto flex flex-row justify-start items-center cursor-pointer text-sm text-primary hover:opacity-80"
              onClick={() => {
                setShowCompactMode(compactStates[showCompactMode].nextState as ContentCompactView);
              }}
            >
              {compactStates[showCompactMode].text}
            </span>
          </div>
        )}
      </div>
    </MemoContentContext.Provider>
  );
});

export default memo(MemoContent);
