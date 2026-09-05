import { CornerDownLeftIcon, SearchIcon } from "lucide-react";
import { type ChangeEvent, type FormEvent, type KeyboardEvent, useEffect, useId, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { tabsTriggerVariants } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import { getFilterSearch, isSearchFilter, type MemoFilter, useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { useSpaceContext } from "@/contexts/SpaceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoViews } from "@/hooks/useUserQueries";
import { BUILTIN_TASKS_VIEW_ID, getMemoViewId, isMemoCollectionRoute } from "@/lib/memo-views";
import { extractSpaceUidFromName, formatSpaceUidForDisplay } from "@/lib/space-display";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { getRouteActionPolicy, getSidebarRouteKind } from "./routes";

export type QuickFindMode = "text" | "cel";

const buildSearchFilters = (query: string, mode: QuickFindMode): MemoFilter[] => {
  const trimmed = query.trim();
  if (mode === "cel") return trimmed ? [{ factor: "celSearch", value: trimmed }] : [];
  return Array.from(new Set(trimmed.split(/\s+/).filter(Boolean))).map((value) => ({ factor: "contentSearch", value }));
};

export const buildQuickFindFilters = (
  query: string,
  currentFilters: MemoFilter[],
  preserveCurrentScope: boolean,
  mode: QuickFindMode,
): MemoFilter[] => {
  const scopeFilters = preserveCurrentScope ? currentFilters.filter((filter) => !isSearchFilter(filter)) : [];
  return [...scopeFilters, ...buildSearchFilters(query, mode)];
};

/** The inverse of buildQuickFindFilters: the query and mode that the active filters were submitted with. */
export const readQuickFindQuery = (filters: MemoFilter[]): { query: string; mode: QuickFindMode } => {
  const celSearch = filters.find((filter) => filter.factor === "celSearch");
  if (celSearch) return { query: celSearch.value, mode: "cel" };
  return {
    query: filters
      .filter((filter) => filter.factor === "contentSearch")
      .map((filter) => filter.value)
      .join(" "),
    mode: "text",
  };
};

export interface QuickFindSubmission {
  filters: MemoFilter[];
  destination?: string;
  switchToAll: boolean;
}

export const resolveQuickFindSubmission = (
  pathname: string,
  query: string,
  currentFilters: MemoFilter[],
  mode: QuickFindMode,
): QuickFindSubmission => {
  const routePolicy = getRouteActionPolicy(pathname);
  const filters = buildQuickFindFilters(query, currentFilters, routePolicy.searchScope !== "all", mode);
  return {
    filters,
    destination: routePolicy.searchDestination ? `${routePolicy.searchDestination}${getFilterSearch(filters)}` : undefined,
    switchToAll: routePolicy.searchScope === "all",
  };
};

const getScopeLabel = (pathname: string, t: ReturnType<typeof useTranslate>) => {
  const routeKind = getSidebarRouteKind(pathname);
  if (routeKind === "archived") return t("common.archived");
  if (routeKind === "explore") return t("common.explore");
  if (routeKind === "profile") return t("common.profile");
  return t("common.memos");
};

const QuickFindDialog = () => {
  const t = useTranslate();
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const { data: memoViews = [] } = useMemoViews(currentUser?.name);
  const { filters, setFilters, setMemoView, memoView } = useMemoFilterContext();
  const { clearSelectedSpace, duplicateSpaceTitles, selectedSpace, selectedSpaceName } = useSpaceContext();
  const { quickFindOpen, setQuickFindOpen } = useAppSidebar();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<QuickFindMode>("text");
  const hintId = useId();
  const viewApplies = isMemoCollectionRoute(location.pathname);
  const selectedMemoView = viewApplies ? memoViews.find((item) => getMemoViewId(item.name) === memoView) : undefined;
  const lensLabel =
    viewApplies && memoView === BUILTIN_TASKS_VIEW_ID ? t("common.tasks") : selectedMemoView?.title || getScopeLabel(location.pathname, t);
  const routePolicy = getRouteActionPolicy(location.pathname);
  const selectedSpaceUid = selectedSpaceName ? extractSpaceUidFromName(selectedSpaceName) : "";
  const selectedSpaceUidDisplay = selectedSpaceName ? formatSpaceUidForDisplay(selectedSpaceName) : "";
  const showSelectedSpaceUid = selectedSpace ? duplicateSpaceTitles.has(selectedSpace.title) : Boolean(selectedSpaceName);
  const selectedSpaceLabel = `${selectedSpace?.title || t("space.current")}${
    showSelectedSpaceUid && selectedSpaceUid ? ` (${selectedSpaceUid})` : ""
  }`;
  const compactSelectedSpaceLabel = `${selectedSpace?.title || t("space.current")}${
    showSelectedSpaceUid && selectedSpaceUidDisplay ? ` (${selectedSpaceUidDisplay})` : ""
  }`;
  const scopeLabel =
    routePolicy.searchScope === "remembered-collection" && selectedSpaceName ? `${selectedSpaceLabel} · ${lensLabel}` : lensLabel;
  const compactScopeLabel =
    routePolicy.searchScope === "remembered-collection" && selectedSpaceName ? `${compactSelectedSpaceLabel} · ${lensLabel}` : lensLabel;

  useEffect(() => {
    if (!quickFindOpen) return;
    const active = readQuickFindQuery(filters);
    setMode(active.mode);
    setQuery(active.query);
  }, [filters, quickFindOpen]);

  const submitQuery = () => {
    const submission = resolveQuickFindSubmission(location.pathname, query, filters, mode);

    if (submission.switchToAll) {
      // This is an explicit cross-Space action, so switch the collection state
      // to All without inserting an intermediate Home history entry.
      clearSelectedSpace();
    }

    setFilters(submission.filters);

    if (submission.destination) {
      setMemoView(undefined);
      navigate(submission.destination);
    }

    setQuickFindOpen(false);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submitQuery();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // Shift+Enter inserts a newline in an expression; every other Enter submits.
    if (event.key !== "Enter" || (mode === "cel" && event.shiftKey)) return;
    // Enter that commits an IME composition must not also submit the search.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    submitQuery();
  };

  const fieldProps = {
    autoFocus: true,
    value: query,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setQuery(event.target.value),
    onKeyDown: handleKeyDown,
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
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-2">
            <span className="min-w-0 truncate text-xs text-muted-foreground" title={scopeLabel}>
              {compactScopeLabel}
            </span>
            <div role="tablist" aria-label={t("search.mode")} className="flex shrink-0 items-center gap-0.5 rounded-md bg-muted/60 p-0.5">
              {(["text", "cel"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={mode === value}
                  onClick={() => setMode(value)}
                  className={cn(tabsTriggerVariants({ variant: "segmented", active: mode === value }), "h-6 px-2 py-0 text-xs")}
                >
                  {value === "cel" ? t("search.expression-mode") : t("search.text")}
                </button>
              ))}
            </div>
          </div>
          {mode === "cel" ? (
            <div className="space-y-3 p-4">
              <Textarea
                {...fieldProps}
                rows={3}
                className="field-sizing-fixed max-h-[40dvh] resize-y font-mono text-sm leading-6"
                placeholder={'"work" in tags && !content.contains("GitHub")'}
                aria-label={t("search.expression")}
                aria-describedby={hintId}
              />
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0 space-y-1 text-xs text-muted-foreground">
                  <p id={hintId}>{t("search.keyboard-hint")}</p>
                  <a
                    href="https://usememos.com/docs/usage/shortcuts#filter-expression-syntax"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block underline underline-offset-2 hover:text-foreground"
                  >
                    {t("search.syntax-help")}
                  </a>
                </div>
                <Button type="submit" size="sm" className="shrink-0">
                  {t("common.search")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex h-[52px] shrink-0 items-center gap-2.5 px-4">
              <SearchIcon className="size-[17px] shrink-0 text-muted-foreground" strokeWidth={1.8} />
              <Input
                {...fieldProps}
                className="h-10 border-0 bg-transparent px-0 !text-[14px] shadow-none focus-visible:ring-0"
                placeholder={`${t("common.search")} ${compactScopeLabel}`}
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
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default QuickFindDialog;
