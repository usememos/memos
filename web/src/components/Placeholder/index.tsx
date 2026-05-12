import { type ReactNode, useMemo } from "react";
import { cn } from "@/lib/utils";
import { type MotionStyle, type PlaceholderVariant, pickPiece } from "./ascii-pool";
import { DEFAULT_MESSAGES } from "./messages";
import "./Placeholder.css";

interface PlaceholderProps {
  variant: PlaceholderVariant;
  message?: string;
  children?: ReactNode;
  className?: string;
}

const MOTION_CLASS: Record<MotionStyle, string> = {
  bob: "placeholder-motion-bob",
  flutter: "placeholder-motion-flutter",
  none: "",
};

const Placeholder = ({ variant, message, children, className }: PlaceholderProps) => {
  const piece = useMemo(() => pickPiece(variant), [variant]);
  const resolvedMessage = message ?? DEFAULT_MESSAGES[variant];
  const isLoading = variant === "loading";

  return (
    <div
      role={isLoading ? "status" : undefined}
      aria-live={isLoading ? "polite" : undefined}
      className={cn("flex flex-col items-center justify-center max-w-md mx-auto px-4 py-8", className)}
    >
      <pre
        aria-hidden="true"
        className={cn("font-mono text-xs sm:text-sm leading-tight text-muted-foreground whitespace-pre m-0", MOTION_CLASS[piece.motion])}
      >
        {piece.ascii}
      </pre>
      <p className="mt-3 font-mono text-sm text-muted-foreground">{resolvedMessage}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
};

export default Placeholder;
