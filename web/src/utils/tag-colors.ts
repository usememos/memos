// File: /web/src/utils/tag-colors.ts
// Tag color utility for Memos

/**
 * Tag color configuration
 * Define your tag-to-color mappings here
 */
export const TAG_COLORS: Record<string, { bg: string; border: string; hover: string }> = {
  todo: {
    bg: "bg-purple-500/15",
    border: "border-l-purple-500",
    hover: "hover:bg-purple-500/25",
  },
  work: {
    bg: "bg-blue-500/15",
    border: "border-l-blue-500",
    hover: "hover:bg-blue-500/25",
  },
  personal: {
    bg: "bg-green-500/15",
    border: "border-l-green-500",
    hover: "hover:bg-green-500/25",
  },
  urgent: {
    bg: "bg-red-500/15",
    border: "border-l-red-500",
    hover: "hover:bg-red-500/25",
  },
  ideas: {
    bg: "bg-amber-500/15",
    border: "border-l-amber-500",
    hover: "hover:bg-amber-500/25",
  },
  programming: {
    bg: "bg-pink-500/15",
    border: "border-l-pink-500",
    hover: "hover:bg-pink-500/25",
  },
  reading: {
    bg: "bg-cyan-500/15",
    border: "border-l-cyan-500",
    hover: "hover:bg-cyan-500/25",
  },
  health: {
    bg: "bg-lime-500/15",
    border: "border-l-lime-500",
    hover: "hover:bg-lime-500/25",
  },
  finance: {
    bg: "bg-yellow-500/15",
    border: "border-l-yellow-500",
    hover: "hover:bg-yellow-500/25",
  },
  travel: {
    bg: "bg-teal-500/15",
    border: "border-l-teal-500",
    hover: "hover:bg-teal-500/25",
  },
};

/**
 * Get Tailwind classes for a memo based on its tags
 * @param tags - Array of tag strings from the memo
 * @returns Object with background, border, and hover classes
 */
export function getTagColorClasses(tags: string[]): {
  background: string;
  border: string;
  hover: string;
} {
  // Find the first tag that has a color configured
  const coloredTag = tags.find((tag) => tag in TAG_COLORS);

  if (!coloredTag) {
    return {
      background: "",
      border: "",
      hover: "",
    };
  }

  const colors = TAG_COLORS[coloredTag];
  return {
    background: colors.bg,
    border: `${colors.border} border-l-4`,
    hover: colors.hover,
  };
}

/**
 * Check if a memo has any colored tags
 * @param tags - Array of tag strings
 * @returns boolean
 */
export function hasColoredTag(tags: string[]): boolean {
  return tags.some((tag) => tag in TAG_COLORS);
}

/**
 * Get the primary colored tag from a list of tags
 * @param tags - Array of tag strings
 * @returns The first tag that has a color, or undefined
 */
export function getPrimaryColoredTag(tags: string[]): string | undefined {
  return tags.find((tag) => tag in TAG_COLORS);
}