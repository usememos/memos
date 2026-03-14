import { useEffect, useRef } from "react";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import dayjs from "dayjs";
import { MasonryItemProps } from "./types";

export function MasonryItem({ memo, renderer, renderContext, onHeightChange }: MasonryItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const displayDate = memo.displayTime ? dayjs(timestampDate(memo.displayTime)).format("YYYY-MM-DD") : undefined;

  useEffect(() => {
    if (!itemRef.current) return;

    const measureHeight = () => {
      if (itemRef.current) {
        const height = itemRef.current.offsetHeight;
        onHeightChange(memo.name, height);
      }
    };

    // Initial measurement
    measureHeight();

    // Set up ResizeObserver to track dynamic content changes
    resizeObserverRef.current = new ResizeObserver(measureHeight);
    resizeObserverRef.current.observe(itemRef.current);

    // Cleanup on unmount
    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, [memo.name, onHeightChange]);

  return (
    <div ref={itemRef} className="mb-3" data-display-date={displayDate} data-memo-name={memo.name}>
      {renderer(memo, renderContext)}
    </div>
  );
}
