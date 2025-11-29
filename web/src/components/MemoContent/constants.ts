export const MAX_DISPLAY_HEIGHT = 256;

export const COMPACT_STATES: Record<"ALL" | "SNIPPET", { textKey: string; next: "ALL" | "SNIPPET" }> = {
  ALL: { textKey: "memo.show-more", next: "SNIPPET" },
  SNIPPET: { textKey: "memo.show-less", next: "ALL" },
};
