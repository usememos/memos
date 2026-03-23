import { cn } from "@/lib/utils";
import type { HeadingItem } from "@/utils/markdown-manipulation";

interface MemoOutlineProps {
  headings: HeadingItem[];
}

const levelIndent: Record<number, string> = {
  1: "ml-0",
  2: "ml-3",
  3: "ml-6",
  4: "ml-8",
};

/** Outline navigation for memo headings (h1–h4). */
const MemoOutline = ({ headings }: MemoOutlineProps) => {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, slug: string) => {
    e.preventDefault();
    const el = document.getElementById(slug);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", `#${slug}`);
    }
  };

  return (
    <nav className="relative flex flex-col">
      {headings.map((heading, index) => (
        <a
          key={`${heading.slug}-${index}`}
          href={`#${heading.slug}`}
          onClick={(e) => handleClick(e, heading.slug)}
          className={cn(
            "group relative block py-[5px] pr-1 text-[13px] leading-snug truncate",
            "text-muted-foreground/60 hover:text-foreground/90",
            "transition-colors duration-200 ease-out",
            levelIndent[heading.level],
            heading.level === 1 && "font-medium text-muted-foreground/80",
          )}
          title={heading.text}
        >
          <span className="relative">
            {heading.text}
            <span className="absolute -bottom-px left-0 h-px w-0 bg-foreground/30 transition-all duration-200 group-hover:w-full" />
          </span>
        </a>
      ))}
    </nav>
  );
};

export default MemoOutline;
