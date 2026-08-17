import { CornerDownLeftIcon, SearchIcon } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import { type MemoFilter, stringifyFilters, useMemoFilterContext } from "@/contexts/MemoFilterContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoViews } from "@/hooks/useUserQueries";
import { BUILTIN_TASKS_VIEW_ID, getMemoViewId, isMemoScopeRoute } from "@/lib/memo-views";
import { ROUTES } from "@/router/routes";
import { useTranslate } from "@/utils/i18n";

export const isQuickFindCollectionRoute = (pathname: string) => isMemoScopeRoute(pathname) || pathname.startsWith("/u/");

const CEL_FIELDS = [
  "content",
  "creator",
  "creator_id",
  "created_ts",
  "updated_ts",
  "pinned",
  "visibility",
  "tag",
  "tags",
  "has_task_list",
  "has_link",
  "has_code",
  "has_incomplete_tasks",
  "has_location",
];
const CEL_BOOLEAN_FIELDS = ["pinned", "has_task_list", "has_link", "has_code", "has_incomplete_tasks", "has_location"];

const CEL_FIELD_PATTERN = new RegExp(`\\b(?:${CEL_FIELDS.join("|")})\\b`);
const CEL_BOOLEAN_PATTERN = new RegExp(`^!?\\s*(?:${CEL_BOOLEAN_FIELDS.join("|")})\\s*$`);
const CEL_OPERATOR_PATTERN = /&&|\|\||==|!=|<=|>=|\bin\b|(?:^|[^<>=!])<|(?:^|[^<>=!])>/;
// Quick Find classifies synchronously, so keep the client heuristic conservative.
// The server still performs the authoritative CEL validation when the memo list is requested.
const CEL_SUPPORTED_TEXT_METHODS = new Set(["contains", "startsWith", "endsWith", "matches"]);
const CEL_SUPPORTED_TAG_METHODS = new Set(["exists", "all", "exists_one"]);
const CEL_SUPPORTED_SET_METHODS = new Set(["contains", "intersects", "equivalent"]);
const CEL_SUPPORTED_FUNCTIONS = new Set(["size", "timestamp", "duration"]);
const CEL_SUPPORTED_TIMESTAMP_METHODS = new Set([
  "getFullYear",
  "getMonth",
  "getDate",
  "getDayOfMonth",
  "getDayOfWeek",
  "getDayOfYear",
  "getHours",
  "getMinutes",
  "getSeconds",
]);
const CEL_METHOD_CALL_PATTERN = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\.\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
const CEL_TAG_ITERATION_PATTERN = /\btags\s*\.\s*(?:exists|all|exists_one)\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*,/g;
const CEL_TIMESTAMP_METHOD_PATTERN = /\b(?:created_ts|updated_ts|now)\s*\.\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\(\s*\)/;
const CEL_COMPARISON_OPERATOR_PATTERN = /==|!=|<=|>=|<|>/;
const CEL_INCOMPLETE_OPERATOR_PATTERN = /(?:&&|\|\||==|!=|<=|>=|<|>|\bin\b)\s*$/;
const CEL_LEADING_OPERATOR_PATTERN = /^(?:&&|\|\||==|!=|<=|>=|<|>|\bin\b)/;
const CEL_ADJACENT_OPERATOR_PATTERN = /(?:&&|\|\||==|!=|<=|>=|<|>|\bin\b)\s*(?:&&|\|\||==|!=|<=|>=|<|>|\bin\b)/;
const CEL_EMPTY_ARGUMENT_METHOD_PATTERN =
  /\b[a-zA-Z_][a-zA-Z0-9_]*\s*\.\s*(?:contains|startsWith|endsWith|matches|exists|all|exists_one|intersects|equivalent)\s*\(\s*(?:,|\))/;

const stripCELStringLiterals = (query: string): string => query.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, "\"\"");

const hasBalancedCELDelimiters = (query: string): boolean => {
  const expectedClosers: string[] = [];
  const matchingClosers: Record<string, string> = { "(": ")", "[": "]" };
  let quote: string | undefined;
  let escaped = false;

  for (const character of query) {
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = undefined;
      }
      continue;
    }

    if (character === "\"" || character === "'") {
      quote = character;
    } else if (character in matchingClosers) {
      expectedClosers.push(matchingClosers[character]);
    } else if (character === ")" || character === "]") {
      if (expectedClosers.pop() !== character) return false;
    }
  }

  return !quote && expectedClosers.length === 0;
};

const hasValidCELInOperands = (query: string): boolean => {
  const sanitizedQuery = stripCELStringLiterals(query);
  const inOperators = sanitizedQuery.match(/\bin\b/g) ?? [];
  if (inOperators.length === 0) return true;

  const validInOperators =
    sanitizedQuery.match(
      new RegExp(
        "(?:\\b(?:" + CEL_FIELDS.join("|") + ")\\b|\"\")\\s+in\\s+(?:\\[[^\\]]*\\]|\\btags\\b)",
        "g",
      ),
    ) ?? [];
  return validInOperators.length === inOperators.length;
};

const validateCELMethods = (query: string): { valid: boolean; hasMethod: boolean } => {
  const iterationVariables = new Set([...query.matchAll(CEL_TAG_ITERATION_PATTERN)].map((match) => match[1]));
  let hasMethod = false;

  for (const match of query.matchAll(CEL_METHOD_CALL_PATTERN)) {
    const target = match[1];
    const method = match[2];
    hasMethod = true;

    const isTextMethod = (target === "content" || iterationVariables.has(target)) && CEL_SUPPORTED_TEXT_METHODS.has(method);
    const isTagMethod = target === "tags" && CEL_SUPPORTED_TAG_METHODS.has(method);
    const isSetMethod = target === "sets" && CEL_SUPPORTED_SET_METHODS.has(method);
    const isTimestampMethod =
      ["created_ts", "updated_ts", "now"].includes(target) && CEL_SUPPORTED_TIMESTAMP_METHODS.has(method);
    if (!isTextMethod && !isTagMethod && !isSetMethod && !isTimestampMethod) {
      return { valid: false, hasMethod };
    }
  }

  return { valid: !CEL_EMPTY_ARGUMENT_METHOD_PATTERN.test(query), hasMethod };
};

const validateCELIdentifiers = (query: string): boolean => {
  const iterationVariables = new Set([...query.matchAll(CEL_TAG_ITERATION_PATTERN)].map((match) => match[1]));
  const allowedIdentifiers = new Set([
    ...CEL_FIELDS,
    ...CEL_SUPPORTED_FUNCTIONS,
    "now",
    "true",
    "false",
    "null",
    "sets",
    ...iterationVariables,
  ]);

  for (const match of query.matchAll(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g)) {
    const identifier = match[0];
    if (identifier === "in") continue;
    const precedingText = query.slice(0, match.index ?? 0).trimEnd();
    if (precedingText.endsWith(".") || allowedIdentifiers.has(identifier)) continue;
    return false;
  }

  return true;
};

const hasCompleteCELOperands = (query: string): boolean => {
  const sanitizedQuery = stripCELStringLiterals(query).trim();
  return (
    hasBalancedCELDelimiters(query) &&
    !CEL_INCOMPLETE_OPERATOR_PATTERN.test(sanitizedQuery) &&
    !CEL_LEADING_OPERATOR_PATTERN.test(sanitizedQuery) &&
    !CEL_ADJACENT_OPERATOR_PATTERN.test(sanitizedQuery)
  );
};

/** Returns whether a quick-find query uses the memo CEL filter syntax. */
export const isCELQuery = (query: string): boolean => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return false;
  if (CEL_BOOLEAN_PATTERN.test(trimmedQuery)) return true;

  const sanitizedQuery = stripCELStringLiterals(trimmedQuery);
  if (!hasCompleteCELOperands(trimmedQuery) || !hasValidCELInOperands(trimmedQuery)) return false;

  const methodResult = validateCELMethods(sanitizedQuery);
  if (!methodResult.valid) return false;
  if (!validateCELIdentifiers(sanitizedQuery)) return false;
  if (CEL_TIMESTAMP_METHOD_PATTERN.test(sanitizedQuery) && !CEL_COMPARISON_OPERATOR_PATTERN.test(sanitizedQuery)) return false;

  if (!CEL_FIELD_PATTERN.test(sanitizedQuery)) return false;
  return CEL_OPERATOR_PATTERN.test(sanitizedQuery) || methodResult.hasMethod;
};

const replaceQuickFindSearchFilters = (currentFilters: MemoFilter[], replacements: MemoFilter[]): MemoFilter[] => [
  ...currentFilters.filter((filter) => filter.factor !== "contentSearch" && filter.factor !== "celSearch"),
  ...replacements,
];

export const buildQuickFindFilters = (query: string, currentFilters: MemoFilter[], preserveCurrentScope: boolean): MemoFilter[] => {
  const trimmedQuery = query.trim();
  const nextFilters: MemoFilter[] = isCELQuery(trimmedQuery)
    ? [{ factor: "celSearch", value: trimmedQuery }]
    : Array.from(new Set(trimmedQuery.split(/\s+/).filter(Boolean))).map((value) => ({ factor: "contentSearch", value }));
  return preserveCurrentScope ? replaceQuickFindSearchFilters(currentFilters, nextFilters) : nextFilters;
};

const getScopeLabel = (pathname: string, t: ReturnType<typeof useTranslate>) => {
  if (pathname === ROUTES.ARCHIVED) return t("common.archived");
  if (pathname === ROUTES.EXPLORE) return t("common.explore");
  if (pathname.startsWith("/u/")) return t("common.profile");
  return t("common.memos");
};

const QuickFindDialog = () => {
  const t = useTranslate();
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const { data: memoViews = [] } = useMemoViews(currentUser?.name);
  const { filters, setFilters, setMemoView, memoView } = useMemoFilterContext();
  const { quickFindOpen, setQuickFindOpen } = useAppSidebar();
  const [query, setQuery] = useState("");
  const collectionRoute = isQuickFindCollectionRoute(location.pathname);
  const viewApplies = isMemoScopeRoute(location.pathname);
  const selectedMemoView = viewApplies ? memoViews.find((item) => getMemoViewId(item.name) === memoView) : undefined;
  const scopeLabel =
    viewApplies && memoView === BUILTIN_TASKS_VIEW_ID ? t("common.tasks") : selectedMemoView?.title || getScopeLabel(location.pathname, t);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setQuickFindOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setQuickFindOpen]);

  useEffect(() => {
    if (!quickFindOpen) return;
    const celFilter = filters.find((filter) => filter.factor === "celSearch");
    if (celFilter) {
      setQuery(celFilter.value);
      return;
    }
    setQuery(filters.filter((filter) => filter.factor === "contentSearch").map((filter) => filter.value).join(" "));
  }, [filters, quickFindOpen]);

  const submitQuery = () => {
    const nextFilters = buildQuickFindFilters(query, filters, collectionRoute);

    if (collectionRoute) {
      setFilters(nextFilters);
    } else {
      const filterQuery = stringifyFilters(nextFilters);
      setFilters(nextFilters);
      setMemoView(undefined);
      navigate(filterQuery ? `${ROUTES.HOME}?filter=${filterQuery}` : ROUTES.HOME);
    }

    setQuickFindOpen(false);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submitQuery();
  };

  return (
    <Dialog open={quickFindOpen} onOpenChange={setQuickFindOpen}>
      <DialogContent
        size="lg"
        className="top-[12vh]! translate-y-0! overflow-hidden border-border/70 p-0! shadow-xl sm:top-[16vh]! [&>div:first-child]:gap-0!"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{t("common.search")}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("common.search")} {scopeLabel}
        </DialogDescription>
        <form onSubmit={handleSubmit} className="flex h-[52px] shrink-0 items-center gap-2.5 px-4">
          <SearchIcon className="size-[17px] shrink-0 text-muted-foreground" strokeWidth={1.8} />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              submitQuery();
            }}
            className="h-10 border-0 bg-transparent px-0 !text-[14px] shadow-none focus-visible:ring-0"
            placeholder={`${t("common.search")} ${scopeLabel}`}
            aria-label={`${t("common.search")} ${scopeLabel}`}
          />
          <Button
            type="submit"
            variant="ghost"
            size="icon-sm"
            className="size-7 shrink-0 rounded-md text-muted-foreground"
            aria-label={t("common.search")}
          >
            <CornerDownLeftIcon className="size-3.5" />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default QuickFindDialog;
