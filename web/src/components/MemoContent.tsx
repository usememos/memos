import { useEffect, useRef, useState } from "react";
import { marked } from "../labs/marked";
import Icon from "./Icon";
import "../less/memo-content.less";

export interface DisplayConfig {
  enableExpand: boolean;
}

interface Props {
  content: string;
  className?: string;
  displayConfig?: Partial<DisplayConfig>;
  onMemoContentClick?: (e: React.MouseEvent) => void;
  onMemoContentDoubleClick?: (e: React.MouseEvent) => void;
}

type ExpandButtonStatus = -1 | 0 | 1;

interface State {
  expandButtonStatus: ExpandButtonStatus;
}

const defaultDisplayConfig: DisplayConfig = {
  enableExpand: true,
};

const MAX_MEMO_CONTAINER_HEIGHT = 384;

const MemoContent: React.FC<Props> = (props: Props) => {
  const { className, content, onMemoContentClick, onMemoContentDoubleClick } = props;
  const [state, setState] = useState<State>({
    expandButtonStatus: -1,
  });
  const memoContentContainerRef = useRef<HTMLDivElement>(null);
  const displayConfig = {
    ...defaultDisplayConfig,
    ...props.displayConfig,
  };

  useEffect(() => {
    if (!memoContentContainerRef) {
      return;
    }

    if (displayConfig.enableExpand) {
      if (Number(memoContentContainerRef.current?.clientHeight) > MAX_MEMO_CONTAINER_HEIGHT) {
        setState({
          ...state,
          expandButtonStatus: 0,
        });
      }
    }
  }, []);

  const handleMemoContentClick = async (e: React.MouseEvent) => {
    if (onMemoContentClick) {
      onMemoContentClick(e);
    }
  };

  const handleMemoContentDoubleClick = async (e: React.MouseEvent) => {
    if (onMemoContentDoubleClick) {
      onMemoContentDoubleClick(e);
    }
  };

  const handleExpandBtnClick = () => {
    const expandButtonStatus = Boolean(!state.expandButtonStatus);
    setState({
      expandButtonStatus: Number(expandButtonStatus) as ExpandButtonStatus,
    });
  };

  return (
    <div className={`memo-content-wrapper ${className || ""}`}>
      <div
        ref={memoContentContainerRef}
        className={`memo-content-text ${state.expandButtonStatus === 0 ? "expanded" : ""}`}
        onClick={handleMemoContentClick}
        onDoubleClick={handleMemoContentDoubleClick}
        dangerouslySetInnerHTML={{ __html: marked(content) }}
      ></div>
      {state.expandButtonStatus !== -1 && (
        <div className="expand-btn-container">
          <span className={`btn ${state.expandButtonStatus === 0 ? "expand-btn" : "fold-btn"}`} onClick={handleExpandBtnClick}>
            {state.expandButtonStatus === 0 ? "Expand" : "Fold"}
            <Icon.ChevronRight className="icon-img" />
          </span>
        </div>
      )}
    </div>
  );
};

export default MemoContent;
