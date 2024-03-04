import classNames from "classnames";
import { memo, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoStore } from "@/store/v1";
import { Node, NodeType } from "@/types/node";
import { useTranslate } from "@/utils/i18n";
import Icon from "../Icon";
import Renderer from "./Renderer";
import { RendererContext } from "./types";

// MAX_DISPLAY_HEIGHT is the maximum height of the memo content to display in compact mode.
const MAX_DISPLAY_HEIGHT = 256;

interface Props {
  content: string;
  memoId?: number;
  compact?: boolean;
  readonly?: boolean;
  disableFilter?: boolean;
  // embeddedMemos is a set of memo resource names that are embedded in the current memo.
  // This is used to prevent infinite loops when a memo embeds itself.
  embeddedMemos?: Set<string>;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

const MemoContent: React.FC<Props> = (props: Props) => {
  const { className, content, memoId, embeddedMemos, onClick } = props;
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const memoStore = useMemoStore();
  const memoContentContainerRef = useRef<HTMLDivElement>(null);
  const [showCompactMode, setShowCompactMode] = useState<boolean>(false);
  const memo = memoId ? memoStore.getMemoById(memoId) : null;
  const nodes = window.parse(content);
  const allowEdit = !props.readonly && memo && currentUser?.id === memo.creatorId;

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

  let prevNode: Node | null = null;
  let skipNextLineBreakFlag = false;

  return (
    <>
      <RendererContext.Provider
        value={{
          nodes,
          memoId,
          readonly: !allowEdit,
          disableFilter: props.disableFilter,
          embeddedMemos: embeddedMemos || new Set(),
        }}
      >
        <div className={`w-full flex flex-col justify-start items-start text-gray-800 dark:text-gray-300 ${className || ""}`}>
          <div
            ref={memoContentContainerRef}
            className={classNames(
              "w-full max-w-full word-break text-base leading-6 space-y-1 whitespace-pre-wrap",
              showCompactMode && "line-clamp-6",
            )}
            onClick={handleMemoContentClick}
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
        </div>
      </RendererContext.Provider>
      {memo && showCompactMode && (
        <div className="w-full mt-2">
          <Link
            className="w-auto inline-flex flex-row justify-start items-center text-sm text-blue-600 dark:text-blue-400 hover:underline"
            to={`/m/${memo.name}`}
          >
            <span>{t("memo.show-more")}</span>
            <Icon.ChevronRight className="w-4 h-auto" />
          </Link>
        </div>
      )}
    </>
  );
};

export default memo(MemoContent);
