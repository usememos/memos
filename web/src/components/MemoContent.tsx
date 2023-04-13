import copy from "copy-to-clipboard";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { marked } from "@/labs/marked";
import Icon from "./Icon";
import "@/less/memo-content.less";

const MAX_EXPAND_HEIGHT = 384;

interface Props {
  content: string;
  className?: string;
  showFull?: boolean;
  onMemoContentClick?: (e: React.MouseEvent) => void;
  onMemoContentDoubleClick?: (e: React.MouseEvent) => void;
}

type ExpandButtonStatus = -1 | 0 | 1;

interface State {
  expandButtonStatus: ExpandButtonStatus;
}

const MemoContent: React.FC<Props> = (props: Props) => {
  const { className, content, showFull, onMemoContentClick, onMemoContentDoubleClick } = props;
  const { t } = useTranslation();

  const [state, setState] = useState<State>({
    expandButtonStatus: -1,
  });
  const memoContentContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showFull) {
      return;
    }

    if (memoContentContainerRef.current) {
      const height = memoContentContainerRef.current.clientHeight;
      if (height > MAX_EXPAND_HEIGHT) {
        setState({
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

  const handleKeyDown =  (event: React.KeyboardEvent<HTMLInputElement>)=>{
    event.preventDefault();
    const rawStr = (event.target as HTMLElement).innerText;
    const code = event.which || event.keyCode;

    let charCode = String.fromCharCode(code).toLowerCase();
    if ((event.ctrlKey || event.metaKey) && charCode === 'c'){
      const splitString = rawStr.split("\n\n");
      const brList = [];
      for (let i = 0; i < splitString.length; i++) {
        brList.push(splitString[i])
        if(i!==splitString.length-1){
          brList.push("\n")
        }
      }
    const text = brList.join("")
    copy(text);
    }
  }
  
  return (
    <div className={`memo-content-wrapper ${className || ""}`}>
      <div
        ref={memoContentContainerRef}
        className={`memo-content-text ${state.expandButtonStatus === 0 ? "max-h-64 overflow-y-hidden" : ""}`}
        onClick={handleMemoContentClick}
        onDoubleClick={handleMemoContentDoubleClick}
        onKeyDown={handleKeyDown} 
        tabIndex={0}
      >
        {marked(content)}
      </div>
      {state.expandButtonStatus !== -1 && (
        <div className={`expand-btn-container ${state.expandButtonStatus === 0 && "!-mt-7"}`}>
          <div className="absolute top-0 left-0 w-full h-full blur-lg bg-white dark:bg-zinc-700"></div>
          <span className={`btn z-10 ${state.expandButtonStatus === 0 ? "expand-btn" : "fold-btn"}`} onClick={handleExpandBtnClick}>
            {state.expandButtonStatus === 0 ? t("common.expand") : t("common.fold")}
            <Icon.ChevronRight className="icon-img opacity-80" />
          </span>
        </div>
      )}
    </div>
  );
};

export default MemoContent;
