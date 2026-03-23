import type { Element } from "hast";
import { useLocation } from "react-router-dom";
import { useInstance } from "@/contexts/InstanceContext";
import { type MemoFilter, stringifyFilters, useMemoFilterContext } from "@/contexts/MemoFilterContext";
import useNavigateTo from "@/hooks/useNavigateTo";
import { colorToHex } from "@/lib/color";
import { findTagMetadata } from "@/lib/tag";
import { cn } from "@/lib/utils";
import { Routes } from "@/router";
import { useMemoViewContext } from "../MemoView/MemoViewContext";

interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  node?: Element; // AST node from react-markdown
  "data-tag"?: string;
  children?: React.ReactNode;
}

export const Tag: React.FC<TagProps> = ({ "data-tag": dataTag, children, className, style, node: _node, ...props }) => {
  const { parentPage } = useMemoViewContext();
  const location = useLocation();
  const navigateTo = useNavigateTo();
  const { getFiltersByFactor, removeFilter, addFilter } = useMemoFilterContext();
  const { tagsSetting } = useInstance();

  const tag = dataTag || "";

  // Custom color from admin tag metadata. Dynamic hex values must use inline styles
  // because Tailwind can't scan dynamically constructed class names.
  // Text uses a darkened variant (40% color + black) for contrast on light backgrounds.
  const bgHex = colorToHex(findTagMetadata(tag, tagsSetting)?.backgroundColor);
  const tagStyle: React.CSSProperties | undefined = bgHex
    ? {
        borderColor: bgHex,
        color: `color-mix(in srgb, ${bgHex} 60%, black)`,
        backgroundColor: `color-mix(in srgb, ${bgHex} 15%, transparent)`,
        ...style,
      }
    : style;

  const handleTagClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // If the tag is clicked in a memo detail page, we should navigate to the memo list page.
    if (location.pathname.startsWith("/m")) {
      const pathname = parentPage || Routes.ROOT;
      const searchParams = new URLSearchParams();

      searchParams.set("filter", stringifyFilters([{ factor: "tagSearch", value: tag }]));
      navigateTo(`${pathname}?${searchParams.toString()}`);
      return;
    }

    const isActive = getFiltersByFactor("tagSearch").some((filter: MemoFilter) => filter.value === tag);
    if (isActive) {
      removeFilter((f: MemoFilter) => f.factor === "tagSearch" && f.value === tag);
    } else {
      // Remove all existing tag filters first, then add the new one
      removeFilter((f: MemoFilter) => f.factor === "tagSearch");
      addFilter({
        factor: "tagSearch",
        value: tag,
      });
    }
  };

  return (
    <span
      className={cn(
        "inline-flex items-center align-baseline px-1.5 py-0.5 text-[0.9em] leading-none font-normal rounded-full border cursor-pointer transition-opacity hover:opacity-75",
        !bgHex && "border-primary text-primary bg-primary/15",
        className,
      )}
      style={tagStyle}
      data-tag={tag}
      {...props}
      onClick={handleTagClick}
    >
      {children}
    </span>
  );
};
