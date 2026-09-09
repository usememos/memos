import { useQueryClient } from "@tanstack/react-query";
import { MoreHorizontalIcon, PlusIcon, SquareCheckIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useLocation, useNavigate } from "react-router-dom";
import ConfirmDialog from "@/components/ConfirmDialog";
import MemoDisplaySettingMenu from "@/components/MemoDisplaySettingMenu";
import MemoViewIcon from "@/components/MemoViewIcon";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { userServiceClient } from "@/connect";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoViews, userKeys } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
import { BUILTIN_TASKS_VIEW_ID, getMemoViewId, isMemoCollectionRoute } from "@/lib/memo-views";
import { cn } from "@/lib/utils";
import { collectionPathForLocation, ROUTES } from "@/router/routes";
import type { MemoView } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import SidebarRow, {
  SIDEBAR_ROW_BOX_CLASSES,
  SIDEBAR_ROW_ICON_CLASSES,
  SIDEBAR_ROW_LABEL_CLASSES,
  SIDEBAR_ROW_SLOT_BUTTON_CLASSES,
  SIDEBAR_ROW_SLOT_CLASSES,
  sidebarRowStateAttributes,
  sidebarRowStateClasses,
} from "./SidebarRow";
import SidebarSection, { SIDEBAR_SECTION_ACTION_ICON_CLASSES } from "./SidebarSection";

/** The row's ⋯ menu: a trailing slot control that stays hidden until the row is engaged. */
const VIEW_MENU_TRIGGER_CLASSES = cn(
  SIDEBAR_ROW_SLOT_BUTTON_CLASSES,
  "text-muted-foreground transition-opacity md:opacity-0 md:group-hover/view:opacity-100 md:focus-visible:opacity-100 data-popup-open:opacity-100",
);

const ViewsSection = ({ manageActive = false }: { manageActive?: boolean }) => {
  const t = useTranslate();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const queryClient = useQueryClient();
  const { data: memoViews = [] } = useMemoViews(currentUser?.name);
  const { memoView: selectedMemoView, setMemoView } = useMemoFilterContext();
  const { setMobileOpen } = useAppSidebar();
  const [deleteTarget, setDeleteTarget] = useState<MemoView>();
  const location = useLocation();

  const handleView = (viewId: string) => {
    setMemoView(selectedMemoView === viewId ? undefined : viewId);
    if (!isMemoCollectionRoute(location.pathname))
      navigate({ pathname: collectionPathForLocation(ROUTES.HOME, location.pathname), search: location.search });
    setMobileOpen(false);
  };

  const handleCreate = () => {
    navigate(ROUTES.VIEWS, { state: { openCreate: true } });
    setMobileOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await userServiceClient.deleteMemoView({ name: deleteTarget.name });
      await queryClient.invalidateQueries({ queryKey: userKeys.memoViews(currentUser?.name) });
      if (selectedMemoView === getMemoViewId(deleteTarget.name)) setMemoView(undefined);
      toast.success(t("setting.memo-view.delete-success", { title: deleteTarget.title }));
    } catch (error: unknown) {
      handleError(error, toast.error, { context: "Delete memo view" });
    } finally {
      setDeleteTarget(undefined);
    }
  };

  return (
    <SidebarSection
      label={t("common.views")}
      action={
        !manageActive && (
          <div className="flex items-center gap-0.5">
            <MemoDisplaySettingMenu />
            <Button variant="quiet" size="icon-sm" onClick={handleCreate} aria-label={t("common.create")}>
              <PlusIcon className={SIDEBAR_SECTION_ACTION_ICON_CLASSES} strokeWidth={1.8} />
            </Button>
          </div>
        )
      }
    >
      <SidebarRow
        state={!manageActive && selectedMemoView === BUILTIN_TASKS_VIEW_ID ? "checked" : "idle"}
        icon={SquareCheckIcon}
        label={t("common.tasks")}
        onClick={() => handleView(BUILTIN_TASKS_VIEW_ID)}
      />
      {memoViews.map((memoView) => {
        const id = getMemoViewId(memoView.name);
        const active = !manageActive && selectedMemoView === id;
        const state = active ? "checked" : "idle";
        return (
          <div
            key={memoView.name}
            {...sidebarRowStateAttributes(state)}
            className={cn(SIDEBAR_ROW_BOX_CLASSES, "group/view", sidebarRowStateClasses(state))}
          >
            <button type="button" onClick={() => handleView(id)} aria-pressed={active || undefined} className={SIDEBAR_ROW_LABEL_CLASSES}>
              <span className={SIDEBAR_ROW_SLOT_CLASSES} aria-hidden="true">
                <MemoViewIcon icon={memoView.icon} className={cn(SIDEBAR_ROW_ICON_CLASSES, "text-base")} />
              </span>
              <span className="min-w-0 flex-1 truncate">{memoView.title}</span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger
                nativeButton={false}
                render={
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`${t("common.edit")} ${memoView.title}`}
                    className={VIEW_MENU_TRIGGER_CLASSES}
                  />
                }
              >
                <MoreHorizontalIcon className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={2} size="sm">
                <DropdownMenuItem
                  onClick={() => {
                    navigate(ROUTES.VIEWS, { state: { memoView } });
                    setMobileOpen(false);
                  }}
                >
                  {t("common.edit")}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(memoView)}>
                  {t("common.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}
      {manageActive && <SidebarRow state="current" icon={MoreHorizontalIcon} label={t("common.manage")} />}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={t("setting.memo-view.delete-confirm", { title: deleteTarget?.title ?? "" })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={handleDelete}
        confirmVariant="destructive"
      />
    </SidebarSection>
  );
};

export default ViewsSection;
