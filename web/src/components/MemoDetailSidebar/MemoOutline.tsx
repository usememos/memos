import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { HeadingItem } from "@/utils/markdown-manipulation";

interface MemoOutlineProps {
  headings: HeadingItem[];
}

/** Distance from the viewport top of the "reading line" used to decide the active section. */
const READING_LINE_OFFSET = 100;

/** Outline navigation for memo headings (h1–h4) with active-section tracking. */
const MemoOutline = ({ headings }: MemoOutlineProps) => {
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const rafRef = useRef(0);

  const minLevel = useMemo(() => Math.min(...headings.map((heading) => heading.level)), [headings]);

  useEffect(() => {
    const update = () => {
      rafRef.current = 0;
      let current: string | null = null;
      for (const heading of headings) {
        const el = document.getElementById(heading.slug);
        if (!el) continue;
        if (el.getBoundingClientRect().top > READING_LINE_OFFSET) break;
        current = heading.slug;
      }
      setActiveSlug(current ?? headings[0]?.slug ?? null);
    };
    const requestUpdate = () => {
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(update);
      }
    };
    update();
    // Capture-phase listener so scrolls of any nested container are observed too.
    window.addEventListener("scroll", requestUpdate, true);
    window.addEventListener("resize", requestUpdate);
    return () => {
      window.removeEventListener("scroll", requestUpdate, true);
      window.removeEventListener("resize", requestUpdate);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [headings]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, slug: string) => {
    e.preventDefault();
    const el = document.getElementById(slug);
    if (el) {
      setActiveSlug(slug);
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", `#${slug}`);
    }
  };

  return (
    <nav className="relative flex flex-col">
      {headings.map((heading, index) => {
        const active = heading.slug === activeSlug;
        return (
          <a
            key={`${heading.slug}-${index}`}
            href={`#${heading.slug}`}
            onClick={(e) => handleClick(e, heading.slug)}
            aria-current={active ? "location" : undefined}
            className={cn(
              "relative block truncate rounded-md py-[3px] pr-1.5 -mx-1.5 text-[13px] leading-5 transition-colors",
              heading.level === minLevel && "font-medium",
              active ? "text-foreground" : "text-muted-foreground/70 hover:bg-accent hover:text-foreground",
            )}
            style={{ paddingLeft: 14 + (heading.level - minLevel) * 12 }}
          >
            <span
              className={cn(
                "absolute left-1.5 top-1/2 h-[13px] w-[2px] -translate-y-1/2 rounded-full transition-colors",
                active ? "bg-primary" : "bg-border",
              )}
            />
            {heading.text}
          </a>
        );
      })}
    </nav>
  );
};

export default MemoOutline;
