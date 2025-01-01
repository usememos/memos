import { useEffect, useState } from "react";

interface MaskPosition {
  left: number;
  right: number;
  top: number;
  height: number;
}

interface ScrollMaskState {
  showLeftMask: boolean;
  showRightMask: boolean;
  maskPositions: MaskPosition;
}

export const useScrollMask = (containerRef: React.RefObject<HTMLElement>) => {
  const [maskState, setMaskState] = useState<ScrollMaskState>({
    showLeftMask: false,
    showRightMask: false,
    maskPositions: { left: 0, right: 0, top: 0, height: 0 },
  });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateMasks = () => {
      const { scrollLeft, scrollWidth, clientWidth } = element;
      const rect = element.getBoundingClientRect();

      setMaskState({
        showLeftMask: scrollLeft > 0,
        showRightMask: scrollLeft < scrollWidth - clientWidth,
        maskPositions: {
          left: rect.left,
          right: rect.right - 16,
          top: rect.top,
          height: rect.height,
        },
      });
    };

    element.addEventListener("scroll", updateMasks);
    window.addEventListener("resize", updateMasks);
    window.addEventListener("scroll", updateMasks);
    // Initial check
    updateMasks();

    return () => {
      element.removeEventListener("scroll", updateMasks);
      window.removeEventListener("resize", updateMasks);
      window.removeEventListener("scroll", updateMasks);
    };
  }, [containerRef]);

  return {
    ...maskState,
    ScrollMask: ({ className = "" }: { className?: string }) => (
      <>
        <span
          className={`fixed w-4 bg-gradient-to-r from-white/80 to-transparent pointer-events-none opacity-0 transition-opacity duration-300 ease-in-out ${className}`}
          style={{
            left: maskState.maskPositions.left,
            top: maskState.maskPositions.top,
            height: maskState.maskPositions.height,
            opacity: maskState.showLeftMask ? 1 : 0,
          }}
        />
        <span
          className={`fixed w-4 bg-gradient-to-l from-white/80 to-transparent pointer-events-none opacity-0 transition-opacity duration-300 ease-in-out ${className}`}
          style={{
            left: maskState.maskPositions.right,
            top: maskState.maskPositions.top,
            height: maskState.maskPositions.height,
            opacity: maskState.showRightMask ? 1 : 0,
          }}
        />
      </>
    ),
  };
};
