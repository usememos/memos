import { CornerDownLeftIcon, SearchIcon } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import { type MemoFilter, replaceFiltersByFactor, stringifyFilters, useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { useSpaceContext } from "@/contexts/SpaceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoViews } from "@/hooks/useUserQueries";
import { BUILTIN_TASKS_VIEW_ID, getMemoViewId, isMemoScopeRoute } from "@/lib/memo-views";
import { useTranslate } from "@/utils/i18n";
import { getRouteActionPolicy, getSidebarRouteKind } from "./routes";

export const buildQuickFindFilters = (query: string, currentFilters: MemoFilter[], preserveCurrentScope: boolean): MemoFilter[] => {
  const words = Array.from(new Set(query.trim().split(/\s+/).filter(Boolean)));
  const contentFilters: MemoFilter[] = words.map((value) => ({ factor: "contentSearch", value }));
  return preserveCurrentScope ? replaceFiltersByFactor(currentFilters, "contentSearch", contentFilters) : contentFilters;
};

export interface QuickFindSubmission {
  filters: MemoFilter[];
  destination?: string;
  switchToAll: boolean;
}

export const resolveQuickFindSubmission = (pathname: string, query: string, currentFilters: MemoFilter[]): QuickFindSubmission => {
  const routePolicy = getRouteActionPolicy(pathname);
  const filters = buildQuickFindFilters(query, currentFilters, routePolicy.searchScope !== "all");
  const filterQuery = stringifyFilters(filters);
  return {
    filters,
    destination: routePolicy.searchDestination
      ? filterQuery
        ? `${routePolicy.searchDestination}?filter=${filterQuery}`
        : routePolicy.searchDestination
      : undefined,
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
  const { clearSelectedSpace, selectedSpace, selectedSpaceName } = useSpaceContext();
  const { quickFindOpen, setQuickFindOpen } = useAppSidebar();
  const [query, setQuery] = useState("");
  const viewApplies = isMemoScopeRoute(location.pathname);
  const selectedMemoView = viewApplies ? memoViews.find((item) => getMemoViewId(item.name) === memoView) : undefined;
  const lensLabel =
    viewApplies && memoView === BUILTIN_TASKS_VIEW_ID ? t("common.tasks") : selectedMemoView?.title || getScopeLabel(location.pathname, t);
  const routePolicy = getRouteActionPolicy(location.pathname);
  const scopeLabel =
    routePolicy.searchScope === "remembered-collection" && selectedSpaceName
      ? `${selectedSpace?.title || t("space.current")} · ${lensLabel}`
      : lensLabel;

  useEffect(() => {
    if (!quickFindOpen) return;
    setQuery(
      filters
        .filter((filter) => filter.factor === "contentSearch")
        .map((filter) => filter.value)
        .join(" "),
    );
  }, [filters, quickFindOpen]);

  const submitQuery = () => {
    const submission = resolveQuickFindSubmission(location.pathname, query, filters);

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
