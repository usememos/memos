import { useEffect, useMemo, useRef, useState } from "react";
import { SIDEBAR_ROW_BOX_CLASSES } from "@/components/AppSidebar/SidebarRow";
import type { HeadingItem } from "@/components/MemoContent/pipeline";
import { cn } from "@/lib/utils";
import { findAnchorTarget, findMemoContentRoot } from "@/utils/markdown-manipulation";

interface MemoOutlineProps {
  headings: HeadingItem[];
  memoName: string;
}

/** Distance from the viewport top of the "reading line" used to decide the active section. */
const READING_LINE_OFFSET = 100;

/** Outline navigation for memo headings (h1–h4) with active-section tracking. */
const MemoOutline = ({ headings, memoName }: MemoOutlineProps) => {
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const rafRef = useRef(0);

  const minLevel = useMemo(() => Math.min(...headings.map((heading) => heading.level)), [headings]);

  useEffect(() => {
    const update = () => {
      rafRef.current = 0;
      let current: string | null = null;
      const memoContent = findMemoContentRoot(document, memoName);
      if (!memoContent) return;
      for (const heading of headings) {
        const el = findAnchorTarget(memoContent, heading.slug);
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
  }, [headings, memoName]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, slug: string) => {
    e.preventDefault();
    const memoContent = findMemoContentRoot(document, memoName);
    const el = memoContent && findAnchorTarget(memoContent, slug);
    if (el) {
      setActiveSlug(slug);
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", `#${slug}`);
    }
  };

  return (
    <nav className="relative flex flex-col gap-0.5">
      {headings.map((heading, index) => {
        const active = heading.slug === activeSlug;
        return (
          <a
            key={`${heading.slug}-${index}`}
            href={`#${heading.slug}`}
            onClick={(e) => handleClick(e, heading.slug)}
            aria-current={active ? "location" : undefined}
            className={cn(
              SIDEBAR_ROW_BOX_CLASSES,
              "relative",
              heading.level === minLevel && "font-medium",
              active ? "text-foreground" : "text-muted-foreground/70 hover:bg-sidebar-accent/65 hover:text-foreground",
            )}
            style={{ paddingInlineStart: 8 + (heading.level - minLevel) * 12 }}
          >
            <span
              className={cn(
                "absolute start-0.5 top-1/2 h-[13px] w-[2px] -translate-y-1/2 rounded-full transition-colors",
                active ? "bg-primary" : "bg-border",
              )}
            />
            <span className="min-w-0 flex-1 truncate">{heading.text}</span>
          </a>
        );
      })}
    </nav>
  );
};

export default MemoOutline;
