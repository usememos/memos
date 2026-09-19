import { EyeIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";

interface Props {
  blurred?: boolean;
  className?: string;
  contentClassName?: string;
  children: (concealed: boolean) => ReactNode;
}

const ConcealedMedia = ({ className, contentClassName, children }: Props) => {
  const t = useTranslate();
  const [revealed, setRevealed] = useState(false);
  return (
    <div className={cn("relative", className)}>
      <div className={cn(contentClassName, !revealed && "pointer-events-none select-none blur-lg")}>{children(!revealed)}</div>
      {!revealed && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-auto min-h-8 max-w-full whitespace-normal bg-card py-1.5 text-xs text-foreground shadow-sm"
            onClick={(event) => {
              event.stopPropagation();
              setRevealed(true);
            }}
          >
            <EyeIcon className="size-3.5 shrink-0" />
            <span className="min-w-0 wrap-break-word">{t("memo.click-to-show-sensitive-content")}</span>
          </Button>
        </div>
      )}
    </div>
  );
};

// Leaving the blurred state unmounts the reveal state, so enabling the rule
// again does not reuse a previous reveal. Callers key this boundary by media.
const BlurredMedia = (props: Props) => (props.blurred ? <ConcealedMedia {...props} /> : props.children(false));

export default BlurredMedia;
