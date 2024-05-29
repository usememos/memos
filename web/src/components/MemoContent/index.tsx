import clsx from "clsx";
import { memo, useEffect, useRef, useState } from "react";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoStore } from "@/store/v1";
import { Node, NodeType } from "@/types/proto/api/v1/markdown_service";
import { useTranslate } from "@/utils/i18n";
import Renderer from "./Renderer";
import { RendererContext } from "./types";

// MAX_DISPLAY_HEIGHT is the maximum height of the memo content to display in compact mode.
const MAX_DISPLAY_HEIGHT = 256;

interface Props {
  nodes: Node[];
  memoName?: string;
  compact?: boolean;
  readonly?: boolean;
  disableFilter?: boolean;
  // embeddedMemos is a set of memo resource names that are embedded in the current memo.
  // This is used to prevent infinite loops when a memo embeds itself.
  embeddedMemos?: Set<string>;
  className?: string;
  contentClassName?: string;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
}

const MemoContent: React.FC<Props> = (props: Props) => {
  const { className, contentClassName, nodes, memoName, embeddedMemos, onClick, onDoubleClick } = props;
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const memoStore = useMemoStore();
  const memoContentContainerRef = useRef<HTMLDivElement>(null);
  const [showCompactMode, setShowCompactMode] = useState<boolean>(false);
  const memo = memoName ? memoStore.getMemoByName(memoName) : null;
  const allowEdit = !props.readonly && memo && currentUser?.name === memo.creator;

  // Initial compact mode.
  useEffect(() => {
    if (!props.compact) {
      return;
    }
    if (!memoContentContainerRef.current) {
      return;
    }

    if ((memoContentContainerRef.current as HTMLDivElement).getBoundingClientRect().height > MAX_DISPLAY_HEIGHT) {
      setShowCompactMode(true);
    }
  }, []);

  const handleMemoContentClick = async (e: React.MouseEvent) => {
    if (onClick) {
      onClick(e);
    }
  };

  const handleMemoContentDoubleClick = async (e: React.MouseEvent) => {
    if (onDoubleClick) {
      onDoubleClick(e);
    }
  };

  let prevNode: Node | null = null;
  let skipNextLineBreakFlag = false;

  return (
    <RendererContext.Provider
      value={{
        nodes,
        memoName: memoName,
        readonly: !allowEdit,
        disableFilter: props.disableFilter,
        embeddedMemos: embeddedMemos || new Set(),
      }}
    >
      <div className={`w-full flex flex-col justify-start items-start text-gray-800 dark:text-gray-400 ${className || ""}`}>
        <div
          ref={memoContentContainerRef}
          className={clsx(
            "w-full max-w-full word-break text-base leading-snug space-y-2 whitespace-pre-wrap",
            showCompactMode && "line-clamp-6",
            contentClassName,
          )}
          onClick={handleMemoContentClick}
          onDoubleClick={handleMemoContentDoubleClick}
        >
          {nodes.map((node, index) => {
            if (prevNode?.type !== NodeType.LINE_BREAK && node.type === NodeType.LINE_BREAK && skipNextLineBreakFlag) {
              skipNextLineBreakFlag = false;
              return null;
            }

            prevNode = node;
            skipNextLineBreakFlag = true;
            return <Renderer key={`${node.type}-${index}`} index={String(index)} node={node} />;
          })}
        </div>
        {showCompactMode && (
          <div className="w-full mt-1">
            <span
              className="w-auto flex flex-row justify-start items-center cursor-pointer text-sm text-blue-600 dark:text-blue-400 hover:opacity-80"
              onClick={() => setShowCompactMode(false)}
            >
              <span>{t("memo.show-more")}</span>
            </span>
          </div>
        )}
      </div>
    </RendererContext.Provider>
  );
};

export default memo(MemoContent);
