import type { PlaceholderVariant } from "./ascii-pool";

// Future i18n: swap these for `t("placeholder.<variant>")` lookups via
// react-i18next without touching the component.
export const DEFAULT_MESSAGES: Record<PlaceholderVariant, string> = {
  empty: "No memos yet",
  loading: "Loading…",
  noResults: "Nothing matches that search",
  notFound: "This page flew the coop",
};
