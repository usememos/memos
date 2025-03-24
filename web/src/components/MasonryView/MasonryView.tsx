import { useEffect, useRef, useState } from "react";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { cn } from "@/utils";

interface Props {
  memoList: Memo[];
  renderer: (memo: Memo) => JSX.Element;
  prefixElement?: JSX.Element;
  listMode?: boolean;
}

interface LocalState {
  columns: number;
}

const MINIMUM_MEMO_VIEWPORT_WIDTH = 512;

const MasonryView = (props: Props) => {
  const [state, setState] = useState<LocalState>({
    columns: 1,
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) {
        return;
      }
      if (props.listMode) {
        setState({
          columns: 1,
        });
        return;
      }

      const containerWidth = containerRef.current.offsetWidth;
      const scale = containerWidth / MINIMUM_MEMO_VIEWPORT_WIDTH;
      setState({
        columns: scale >= 2 ? Math.round(scale) : 1,
      });
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [props.listMode]);

  return (
    <div
      ref={containerRef}
      className={cn("w-full grid gap-2")}
      style={{
        gridTemplateColumns: `repeat(${state.columns}, 1fr)`,
      }}
    >
      {Array.from({ length: state.columns }).map((_, columnIndex) => (
        <div key={columnIndex} className="min-w-0 mx-auto w-full max-w-2xl">
          {props.prefixElement && columnIndex === 0 && <div className="mb-2">{props.prefixElement}</div>}
          {props.memoList.filter((_, index) => index % state.columns === columnIndex).map((memo) => props.renderer(memo))}
        </div>
      ))}
    </div>
  );
};

export default MasonryView;
