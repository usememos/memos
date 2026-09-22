import type { MemoFilter } from "@/contexts/MemoFilterContext";
import type { SuggestionSource } from "@/lib/memo-suggestions";
import { isCompleteTagValue } from "@/utils/tag-grammar";
import { parseSuggestionExpression, readStringList, type SuggestionExpression, type SuggestionToken } from "./suggestion-expression";

interface TagConditions {
  candidates: string[];
  excluded: Set<string>;
}

function literalTags(tokens: SuggestionToken[]): string[] {
  if (tokens.length === 3 && tokens[0].value !== undefined && tokens[1].text === "in" && tokens[2].text === "tags") {
    return [tokens[0].value];
  }
  if (tokens[0]?.text !== "tag" || tokens[1]?.text !== "in") return [];
  return readStringList(tokens.slice(2)) ?? [];
}

function analyze(expression: SuggestionExpression, negated = false): TagConditions {
  if (expression.kind === "not") return analyze(expression.child, !negated);
  if (expression.kind === "atom") {
    const tags = literalTags(expression.tokens);
    return negated ? { candidates: [], excluded: new Set(tags) } : { candidates: tags, excluded: new Set() };
  }
  const left = analyze(expression.left, negated);
  const right = analyze(expression.right, negated);
  const conjunction = (expression.kind === "and") !== negated;
  const excluded = conjunction
    ? new Set([...left.excluded, ...right.excluded])
    : new Set([...left.excluded].filter((tag) => right.excluded.has(tag)));
  return { candidates: [...left.candidates, ...right.candidates].filter((tag) => !excluded.has(tag)), excluded };
}

export function extractTagConditions(source: string): TagConditions {
  try {
    const expression = parseSuggestionExpression(source);
    if (expression) return analyze(expression);
  } catch {
    // Excessively deep Boolean expressions are not useful suggestions.
  }
  return { candidates: [], excluded: new Set() };
}

/** Tag provider: extraction and tag-specific exclusions, without presentation policy. */
export function getTagSuggestionCandidates(filters: MemoFilter[], viewFilter?: string): { tag: string; source: SuggestionSource }[] {
  const conditions = [
    ...filters
      .filter((filter) => filter.factor === "celSearch")
      .map((filter) => ({ source: "search" as const, ...extractTagConditions(filter.value) })),
    ...(viewFilter ? [{ source: "view" as const, ...extractTagConditions(viewFilter) }] : []),
  ];
  const excluded = new Set(conditions.flatMap((condition) => [...condition.excluded]));
  // Emission order is priority order: explicit selection, then search, then the saved View.
  const candidates = [
    ...filters.filter((filter) => filter.factor === "tagSearch").map((filter) => ({ tag: filter.value, source: "selection" as const })),
    ...conditions.flatMap((condition) => condition.candidates.map((tag) => ({ tag, source: condition.source }))),
  ];
  return candidates.filter(({ tag }) => !excluded.has(tag) && isCompleteTagValue(tag));
}
