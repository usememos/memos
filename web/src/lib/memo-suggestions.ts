import { uniqBy } from "lodash-es";
import type { LucideIcon } from "lucide-react";
import type { MemoFilter } from "@/contexts/MemoFilterContext";
import type { Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { getContextSuggestionCandidates } from "./context-suggestions";
import { getTagSuggestionCandidates } from "./tag-suggestions";

export type SuggestionSource = "selection" | "search" | "view";

/** Shared presentation contract; the bar does not interpret suggestion payloads. */
export interface SuggestionItem {
  id: string;
  label: string;
  accessibleLabel?: string;
  icon?: LucideIcon;
}

/** Add future suggestion kinds to this discriminated union, with their own payloads. */
export type MemoSuggestion = {
  id: string;
  source: SuggestionSource;
} & ({ kind: "tag"; tag: string } | { kind: "checklist" } | { kind: "visibility"; visibility: Visibility });

export const MAX_MEMO_SUGGESTIONS = 3;

const sourcePriority: Record<SuggestionSource, number> = { selection: 0, search: 1, view: 2 };

/** Merge providers by context priority and retain the strongest source for each id. */
export function getMemoSuggestions(filters: MemoFilter[], viewFilter?: string): MemoSuggestion[] {
  const candidates: MemoSuggestion[] = getTagSuggestionCandidates(filters, viewFilter).map(({ tag, source }) => ({
    id: `tag:${tag}`,
    kind: "tag",
    source,
    tag,
  }));
  candidates.push(...getContextSuggestionCandidates(filters, viewFilter));
  candidates.sort((left, right) => sourcePriority[left.source] - sourcePriority[right.source]);
  return uniqBy(candidates, "id");
}
