import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";

// A collapsed section shows this much content; anything taller folds behind a fade.
export const CLAMP_PREVIEW_HEIGHT_PX = 360;
// Only fold when content is taller than this, so cards barely over the preview aren't
// clamped for the sake of a few hidden pixels.
export const CLAMP_TRIGGER_HEIGHT_PX = 420;

interface ClampedSectionProps {
  /** When false, children render untouched with no measurement. */
  enabled: boolean;
  children: ReactNode;
}

/**
 * The one truncation mechanism for compact cards: measure the content, and when it is
 * tall enough, collapse it to a fixed-height preview with a fade and a Show more/less
 * toggle. The inner div is never clamped, so observing it keeps the measurement live
 * while images and embeds load.
 */
const ClampedSection = ({ enabled, children }: ClampedSectionProps) => {
  const t = useTranslate();
  const measureRef = useRef<HTMLDivElement>(null);
  const [clamped, setClamped] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const el = measureRef.current;
    if (!enabled || !el) {
      setClamped(false);
      return;
    }
    const check = () => setClamped(el.offsetHeight > CLAMP_TRIGGER_HEIGHT_PX);
    check();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled]);

  const collapsed = clamped && !expanded;

  return (
    <>
      <div
        className={cn("relative w-full", collapsed && "overflow-hidden")}
        style={collapsed ? { maxHeight: CLAMP_PREVIEW_HEIGHT_PX } : undefined}
      >
        <div ref={measureRef} className="w-full flex flex-col justify-start items-start gap-2">
          {children}
        </div>
        {collapsed && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-card from-0% via-card/60 via-40% to-transparent to-100%" />
        )}
      </div>
      {clamped && (
        <Button variant="quiet" size="sm" onClick={() => setExpanded((prev) => !prev)}>
          {t(collapsed ? "memo.show-more" : "memo.show-less")}
          {collapsed ? (
            <ChevronDownIcon className="size-3.5" strokeWidth={1.8} />
          ) : (
            <ChevronUpIcon className="size-3.5" strokeWidth={1.8} />
          )}
        </Button>
      )}
    </>
  );
};

export default ClampedSection;
