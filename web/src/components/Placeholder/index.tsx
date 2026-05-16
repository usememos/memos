import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { DEFAULT_MESSAGES, type PlaceholderVariant } from "./messages";
import TileSpriteStrip from "./TileSpriteStrip";
import { pickTileSprite } from "./tileSprites";

interface PlaceholderProps {
  variant: PlaceholderVariant;
  message?: string;
  children?: ReactNode;
  className?: string;
}

const DISPLAY_SCALE = 2;

const Placeholder = ({ variant, message, children, className }: PlaceholderProps) => {
  const [sprite] = useState(pickTileSprite);
  const resolvedMessage = message ?? DEFAULT_MESSAGES[variant];
  const isLoading = variant === "loading";

  return (
    <div
      role={isLoading ? "status" : undefined}
      aria-live={isLoading ? "polite" : undefined}
      className={cn("flex flex-col items-center justify-center max-w-md mx-auto px-4 py-8", className)}
    >
      <TileSpriteStrip sprite={sprite} scale={DISPLAY_SCALE} className="relative shrink-0" testId="placeholder-sprite" />
      <p className="mt-3 font-mono text-sm text-muted-foreground">{resolvedMessage}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
};

export default Placeholder;
