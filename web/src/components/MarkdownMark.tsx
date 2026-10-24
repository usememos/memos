import type { SVGProps } from "react";

/**
 * The Markdown Mark (Dustin Curtis, public domain) drawn as a stroke icon on Lucide's
 * 24-unit grid, so it sits with the other menu glyphs: the mark's rounded box at its
 * aspect ratio, an M and a down arrow. It names the Markdown mode of the composer.
 */
export const MarkdownMark = ({ strokeWidth = 2, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <path d="M6 15v-6l3 3 3-3v6" />
    <path d="M17 9v6" />
    <path d="m15 13 2 2 2-2" />
  </svg>
);
