import { RefObject, useEffect, useRef, useState } from "react";

const MIN_SPEED_UP = 500;
const MIN_SPEED_DOWN = 250;

export function useScrollDirection(ref: RefObject<HTMLElement>) {
  const [scrollDirection, setScrollDirection] = useState<"up" | "down">("down");
  const lastScrollTopRef = useRef(0);
  const lastScrollTopTime = useRef(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const handleScroll = () => {
      const { scrollTop } = element;
      const delta = scrollTop - lastScrollTopRef.current;
      const speed = (Math.abs(delta) / (+Date.now() - lastScrollTopTime.current)) * 1000;
      if (delta > 0 && speed > MIN_SPEED_DOWN) setScrollDirection("down");
      if (delta < 0 && speed > MIN_SPEED_UP) setScrollDirection("up");
      lastScrollTopRef.current = scrollTop;
      lastScrollTopTime.current = +Date.now();
    };
    element.addEventListener("scroll", handleScroll);
    return () => element.removeEventListener("scroll", handleScroll);
  }, [ref]);
  return [scrollDirection];
}
