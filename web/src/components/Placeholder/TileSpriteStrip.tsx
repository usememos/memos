import { cn } from "@/lib/utils";
import type { TileSprite } from "./tileSprites";

interface TileSpriteStripProps {
  sprite: TileSprite;
  scale?: number;
  className?: string;
  testId?: string;
}

const DEFAULT_SCALE = 2;

const getAnimationName = (sprite: TileSprite, scale: number) => `tile-sprite-${sprite.name}-${scale}x`;

const TileSpriteStrip = ({ sprite, scale = DEFAULT_SCALE, className, testId }: TileSpriteStripProps) => {
  const stripWidth = sprite.frameWidth * sprite.frames;
  const displayStripWidth = stripWidth * scale;
  const displayStripHeight = sprite.frameHeight * scale;
  const displayFrameWidth = sprite.frameWidth * scale;
  const animationName = getAnimationName(sprite, scale);

  return (
    <>
      <style>{`
        @keyframes ${animationName} {
          from { transform: translateX(0); }
          to { transform: translateX(-${displayStripWidth}px); }
        }

        @media (prefers-reduced-motion: reduce) {
          [data-tile-sprite-strip="${animationName}"] {
            animation: none !important;
            transform: translateX(0) !important;
          }
        }
      `}</style>
      <div
        aria-hidden="true"
        data-testid={testId}
        className={cn("relative shrink-0 overflow-hidden", className)}
        style={{ width: displayFrameWidth, height: displayStripHeight, overflow: "hidden" }}
      >
        <img
          data-tile-sprite-strip={animationName}
          src={sprite.src}
          alt=""
          width={stripWidth}
          height={sprite.frameHeight}
          draggable={false}
          style={{
            display: "block",
            width: displayStripWidth,
            height: displayStripHeight,
            maxWidth: "none",
            imageRendering: "pixelated",
            animationName,
            animationDuration: `${sprite.duration}ms`,
            animationTimingFunction: `steps(${sprite.frames})`,
            animationIterationCount: "infinite",
          }}
        />
      </div>
    </>
  );
};

export default TileSpriteStrip;
