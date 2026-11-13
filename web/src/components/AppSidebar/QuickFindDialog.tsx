import { Button, Dialog, Textarea, Toggle, ToggleGroup, Tooltip } from "@usememos/ui";
import { CornerDownLeftIcon, SearchIcon } from "lucide-react";
import { type ChangeEvent, type FormEvent, type KeyboardEvent, useEffect, useId, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import { getFilterSearch, isSearchFilter, type MemoFilter, useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { useSpaceContext } from "@/contexts/SpaceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoViews } from "@/hooks/useUserQueries";
import { getMemoViewId, isMemoCollectionRoute } from "@/lib/memo-views";
import { extractSpaceUidFromName, formatSpaceUidForDisplay } from "@/lib/space-display";
import { getCollectionCreator, withCollectionCreator } from "@/router/routes";
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
}

export const resolveQuickFindSubmission = (
  pathname: string,
  query: string,
  currentFilters: MemoFilter[],
  mode: QuickFindMode,
  search = "",
): QuickFindSubmission => {
  const routePolicy = getRouteActionPolicy(pathname, search);
  const filters = buildQuickFindFilters(query, currentFilters, routePolicy.searchScope !== "all", mode);
  return {
    filters,
    destination: routePolicy.searchDestination
      ? `${routePolicy.searchDestination}${withCollectionCreator(getFilterSearch(filters), routePolicy.searchScope === "route-collection" ? getCollectionCreator(search) : undefined)}`
      : undefined,
  };
};

const getScopeLabel = (pathname: string, t: ReturnType<typeof useTranslate>) => {
  const routeKind = getSidebarRouteKind(pathname);
  if (routeKind === "archived") return t("common.archived");
  if (routeKind === "explore") return t("common.explore");
  return t("common.memos");
};

const QuickFindDialog = () => {
  const t = useTranslate();
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const { data: memoViews = [] } = useMemoViews(currentUser?.name);
  const { filters, setFilters, setMemoView, memoView } = useMemoFilterContext();
  const { duplicateSpaceTitles, selectedSpace, selectedSpaceName } = useSpaceContext();
  const { quickFindOpen, setQuickFindOpen } = useAppSidebar();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<QuickFindMode>("text");
  const [autoFocusField, setAutoFocusField] = useState(true);
  const hintId = useId();
  const viewApplies = isMemoCollectionRoute(location.pathname);
  const selectedMemoView = viewApplies ? memoViews.find((item) => getMemoViewId(item.name) === memoView) : undefined;
  const lensLabel = selectedMemoView?.title || getScopeLabel(location.pathname, t);
  const selectedSpaceUid = selectedSpaceName ? extractSpaceUidFromName(selectedSpaceName) : "";
  const selectedSpaceUidDisplay = selectedSpaceName ? formatSpaceUidForDisplay(selectedSpaceName) : "";
  const showSelectedSpaceUid = selectedSpace ? duplicateSpaceTitles.has(selectedSpace.title) : Boolean(selectedSpaceName);
  const selectedSpaceLabel = `${selectedSpace?.title || t("space.current")}${
    showSelectedSpaceUid && selectedSpaceUid ? ` (${selectedSpaceUid})` : ""
  }`;
  const compactSelectedSpaceLabel = `${selectedSpace?.title || t("space.current")}${
    showSelectedSpaceUid && selectedSpaceUidDisplay ? ` (${selectedSpaceUidDisplay})` : ""
  }`;
  const scopeLabel = selectedSpaceName ? `${selectedSpaceLabel} · ${lensLabel}` : lensLabel;
  const compactScopeLabel = selectedSpaceName ? `${compactSelectedSpaceLabel} · ${lensLabel}` : lensLabel;

  useEffect(() => {
    if (!quickFindOpen) return;
    setAutoFocusField(true);
    const active = readQuickFindQuery(filters);
    setMode(active.mode);
    setQuery(active.query);
  }, [filters, quickFindOpen]);

  const submitQuery = () => {
    const submission = resolveQuickFindSubmission(location.pathname, query, filters, mode, location.search);

    if (submission.destination) {
      setMemoView(undefined);
      navigate(submission.destination);
    } else {
      setFilters(submission.filters);
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
    autoFocus: autoFocusField,
    value: query,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setQuery(event.target.value),
    onKeyDown: handleKeyDown,
  };

  return (
    <Dialog.Root open={quickFindOpen} onOpenChange={setQuickFindOpen}>
      {/* Anchored near the top, not centered, so switching modes grows the panel downward instead of shifting it. */}
      <Dialog.Popup
        variant="bare"
        sheet={false}
        className="w-lg self-start mt-[max(0px,calc(12vh-var(--mu-space-6)))] sm:mt-[max(0px,calc(16vh-var(--mu-space-6)))]"
      >
        <Dialog.Title className="mu-visually-hidden">{t("common.search")}</Dialog.Title>
        <Dialog.Description className="mu-visually-hidden">
          {t("common.search")} {scopeLabel}
        </Dialog.Description>
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between gap-3 border-b border-mu-line/50 px-4 py-2">
            <span className="min-w-0 truncate mu-caption text-mu-text-secondary" title={scopeLabel}>
              {compactScopeLabel}
            </span>
            <ToggleGroup
              size="sm"
              className="shrink-0"
              aria-label={t("search.mode")}
              value={[mode]}
              onValueChange={([next]: string[]) => next && setMode(next as QuickFindMode)}
              // Keyboard choices keep focus on the switch; clicking a mode focuses its field.
              onKeyDownCapture={() => setAutoFocusField(false)}
              onClickCapture={() => setAutoFocusField(true)}
            >
              {(["text", "cel"] as const).map((value) => (
                <Toggle key={value} value={value}>
                  {value === "cel" ? t("search.expression-mode") : t("search.text")}
                </Toggle>
              ))}
            </ToggleGroup>
          </div>
          {mode === "cel" ? (
            <div className="space-y-3 p-4">
              <Textarea
                {...fieldProps}
                rows={3}
                className="field-sizing-fixed max-h-[40dvh] resize-y font-mono"
                placeholder={'"work" in tags && !content.contains("GitHub")'}
                aria-label={t("search.expression")}
                aria-describedby={hintId}
              />
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0 space-y-1 mu-caption text-mu-text-secondary">
                  <p id={hintId}>{t("search.keyboard-hint")}</p>
                  <a
                    href="https://usememos.com/docs/usage/shortcuts#filter-expression-syntax"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block underline underline-offset-2 hover:text-mu-text"
                  >
                    {t("search.syntax-help")}
                  </a>
                </div>
                <Button variant="primary" type="submit" size="sm" className="shrink-0">
                  {t("common.search")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex h-[52px] shrink-0 items-center gap-2.5 px-4">
              <SearchIcon className="mu-icon size-[17px] shrink-0 text-mu-text-secondary" />
              {/* The dialog's own field, focused whenever it is open: the caret marks focus, as in a
                  command palette, so it draws no outline around the borderless header. */}
              <input
                {...fieldProps}
                className="h-10 min-w-0 flex-1 bg-transparent mu-body outline-none placeholder:text-mu-text-secondary"
                placeholder={`${t("common.search")} ${compactScopeLabel}`}
                aria-label={`${t("common.search")} ${scopeLabel}`}
              />
              <Tooltip.Root>
                <Tooltip.Trigger
                  render={<Button type="submit" variant="ghost" size="sm" aria-label={t("common.search")} icon={<CornerDownLeftIcon />} />}
                />
                <Tooltip.Popup>{t("common.search")}</Tooltip.Popup>
              </Tooltip.Root>
            </div>
          )}
        </form>
      </Dialog.Popup>
    </Dialog.Root>
  );
};

export default QuickFindDialog;
