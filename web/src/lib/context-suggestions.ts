import type { MemoFilter } from "@/contexts/MemoFilterContext";
import type { Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { VISIBILITY_OPTIONS } from "@/utils/memo";
import type { MemoSuggestion, SuggestionSource } from "./memo-suggestions";
import { parseSuggestionExpression, readStringList, type SuggestionExpression, type SuggestionToken } from "./suggestion-expression";

interface ContextConditions {
  checklist: boolean;
  excludesChecklist: boolean;
  audiences: Set<Visibility>;
  explicitAudiences: Set<Visibility>;
}

const emptyConditions = (): ContextConditions => ({
  checklist: false,
  excludesChecklist: false,
  audiences: new Set(VISIBILITY_OPTIONS.map((option) => option.value)),
  explicitAudiences: new Set(),
});

function readAtom(tokens: SuggestionToken[], negated: boolean): ContextConditions {
  const result = emptyConditions();
  const [left, operator, right] = tokens;
  if (!left) return result;
  if (["has_task_list", "has_incomplete_tasks"].includes(left.text)) {
    let positive: boolean;
    if (tokens.length === 1) positive = true;
    else if (tokens.length === 3 && ["==", "!="].includes(operator.text) && ["true", "false"].includes(right.text)) {
      positive = (right.text === "true") === (operator.text === "==");
    } else return result;
    result.checklist = positive !== negated;
    // A new checklist starts unchecked, so a ban on incomplete tasks also excludes it.
    result.excludesChecklist = !result.checklist;
    return result;
  }

  let names: string[] | undefined;
  let excludes = negated;
  if (tokens.length === 3 && ["==", "!="].includes(operator.text)) {
    const name = left.text === "visibility" ? right.value : right.text === "visibility" ? left.value : undefined;
    if (name === undefined) return result;
    names = [name];
    excludes = (operator.text === "!=") !== negated;
  } else if (left.text === "visibility" && operator?.text === "in") {
    names = readStringList(tokens.slice(2));
  }
  if (!names) return result;
  const values = new Set(VISIBILITY_OPTIONS.filter((option) => names.includes(option.name)).map((option) => option.value));
  result.audiences = excludes ? new Set([...result.audiences].filter((value) => !values.has(value))) : values;
  result.explicitAudiences = excludes ? new Set() : values;
  return result;
}

function analyze(expression: SuggestionExpression, negated = false): ContextConditions {
  if (expression.kind === "not") return analyze(expression.child, !negated);
  if (expression.kind === "atom") return readAtom(expression.tokens, negated);
  const left = analyze(expression.left, negated);
  const right = analyze(expression.right, negated);
  const conjunction = (expression.kind === "and") !== negated;
  const excludesChecklist = conjunction
    ? left.excludesChecklist || right.excludesChecklist
    : left.excludesChecklist && right.excludesChecklist;
  return {
    checklist: (left.checklist || right.checklist) && !excludesChecklist,
    excludesChecklist,
    audiences: conjunction
      ? new Set([...left.audiences].filter((value) => right.audiences.has(value)))
      : new Set([...left.audiences, ...right.audiences]),
    explicitAudiences: new Set([...left.explicitAudiences, ...right.explicitAudiences]),
  };
}

function readConditions(source: string): ContextConditions {
  try {
    const expression = parseSuggestionExpression(source);
    return expression ? analyze(expression) : emptyConditions();
  } catch {
    return emptyConditions();
  }
}

/** Checklist and audience providers share the same Boolean reader as tags. */
export function getContextSuggestionCandidates(filters: MemoFilter[], viewFilter?: string): MemoSuggestion[] {
  const conditions = filters.flatMap<ContextConditions & { source: SuggestionSource }>((filter) => {
    if (filter.factor === "celSearch") return [{ ...readConditions(filter.value), source: "search" as const }];
    if (filter.factor === "visibility") {
      return [{ ...readConditions(`visibility == ${JSON.stringify(filter.value)}`), source: "selection" as const }];
    }
    if (filter.factor === "property.hasTaskList") return [{ ...readConditions("has_task_list"), source: "selection" as const }];
    return [];
  });
  if (viewFilter) conditions.push({ ...readConditions(viewFilter), source: "view" });
  const candidates: MemoSuggestion[] = [];
  if (!conditions.some((condition) => condition.excludesChecklist)) {
    for (const condition of conditions) {
      if (condition.checklist) candidates.push({ id: "checklist", kind: "checklist", source: condition.source });
    }
  }
  // An audience is one value: alternatives, exclusions alone, and conflicts don't guess.
  const audiences = VISIBILITY_OPTIONS.filter((option) => conditions.every((condition) => condition.audiences.has(option.value)));
  if (audiences.length === 1) {
    const audience = audiences[0];
    for (const condition of conditions) {
      if (condition.explicitAudiences.has(audience.value)) {
        candidates.push({ id: `visibility:${audience.name}`, kind: "visibility", source: condition.source, visibility: audience.value });
      }
    }
  }
  return candidates;
}
