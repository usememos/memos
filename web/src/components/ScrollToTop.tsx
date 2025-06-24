import clsx from "clsx";
import { ArrowUpIcon } from "lucide-react";
import { useEffect, useState } from "react";

interface ScrollToTopProps {
  className?: string;
  style?: React.CSSProperties;
  enabled?: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
}

const ScrollToTop = ({ className, style, enabled = true, scrollContainerRef }: ScrollToTopProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;

    const handleScroll = () => {
      if (!scrollContainer) {
        return;
      }

      const shouldBeVisible = scrollContainer.scrollTop > 400;
      if (shouldBeVisible !== isVisible) {
        if (shouldBeVisible) {
          setShouldRender(true);
          setTimeout(() => setIsVisible(true), 50);
        } else {
          setIsVisible(false);
          setTimeout(() => setShouldRender(false), 200);
        }
      }
    };

    if (enabled && scrollContainer) {
      scrollContainer.addEventListener("scroll", handleScroll);
      return () => scrollContainer.removeEventListener("scroll", handleScroll);
    }
  }, [enabled, isVisible]);

  const scrollToTop = () => {
    if (!scrollContainerRef.current) {
      return;
    }
    scrollContainerRef.current.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  if (!enabled || !shouldRender) {
    return null;
  }

  return (
    <button
      onClick={scrollToTop}
      className={clsx(
        "p-3 bg-primary dark:bg-primary-dark hover:bg-primary-darker dark:hover:bg-primary-darker rounded-full shadow-lg",
        "transition-all duration-200",
        "opacity-0 scale-95",
        isVisible && "opacity-100 scale-100",
        className,
      )}
      style={style}
      aria-label="Scroll to top"
    >
      <ArrowUpIcon className="w-5 h-5 text-white" />
    </button>
  );
};

export default ScrollToTop;
