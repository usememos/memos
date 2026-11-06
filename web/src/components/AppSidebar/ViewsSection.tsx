import { useQueryClient } from "@tanstack/react-query";
import { Button, Menu, Tooltip } from "@usememos/ui";
import { MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ConfirmDialog from "@/components/ConfirmDialog";
import MemoViewIcon from "@/components/MemoViewIcon";
import { userServiceClient } from "@/connect";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoViews, userKeys } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
import { getMemoViewId, isMemoCollectionRoute } from "@/lib/memo-views";
import { showErrorToast, toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { getCollectionHomePath, ROUTES } from "@/router/routes";
import type { MemoView } from "@/types/proto/api/user_service_pb";
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
import SidebarSection from "./SidebarSection";

/** The row's ⋯ menu: a trailing slot control that stays hidden until the row is engaged. */
const VIEW_MENU_TRIGGER_CLASSES = cn(
  SIDEBAR_ROW_SLOT_BUTTON_CLASSES,
  "text-mu-ink-muted transition-opacity md:opacity-0 md:group-hover/view:opacity-100 md:focus-visible:opacity-100 data-popup-open:opacity-100",
);

const ViewsSection = ({ manageActive = false }: { manageActive?: boolean }) => {
  const t = useTranslate();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const queryClient = useQueryClient();
  const { data: memoViews = [], isPending, isError } = useMemoViews(currentUser?.name);
  const { memoView: selectedMemoView, setMemoView } = useMemoFilterContext();
  const { setMobileOpen } = useAppSidebar();
  const [deleteTarget, setDeleteTarget] = useState<MemoView>();
  const location = useLocation();

  const handleView = (viewId: string) => {
    setMemoView(selectedMemoView === viewId ? undefined : viewId);
    if (!isMemoCollectionRoute(location.pathname)) navigate({ pathname: getCollectionHomePath(location), search: location.search });
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
      toast.add({ title: t("setting.memo-view.delete-success", { title: deleteTarget.title }), type: "success" });
    } catch (error: unknown) {
      handleError(error, showErrorToast, { context: "Delete memo view" });
    } finally {
      setDeleteTarget(undefined);
    }
  };

  return (
    <SidebarSection
      label={t("common.views")}
      action={
        !manageActive &&
        (memoViews.length > 0 || isError) && (
          <Tooltip.Root>
            <Tooltip.Trigger
              render={
                <Button variant="ghost" size="xs" onClick={handleCreate} aria-label={t("setting.memo-view.create")} icon={<PlusIcon />} />
              }
            />
            <Tooltip.Popup>{t("setting.memo-view.create")}</Tooltip.Popup>
          </Tooltip.Root>
        )
      }
    >
      {!isPending && !isError && memoViews.length === 0 && (
        <SidebarRow icon={PlusIcon} label={t("setting.memo-view.create")} onClick={handleCreate} />
      )}
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
                <MemoViewIcon icon={memoView.icon} className={cn(SIDEBAR_ROW_ICON_CLASSES, "text-sm")} />
              </span>
              <span className="min-w-0 flex-1 truncate">{memoView.title}</span>
            </button>
            <Menu.Root modal={false} size="sm">
              <Menu.Trigger
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
                <MoreHorizontalIcon className="mu-icon-sm" />
              </Menu.Trigger>
              <Menu.Popup align="end">
                <Menu.Item
                  onClick={() => {
                    navigate(ROUTES.VIEWS, { state: { memoView } });
                    setMobileOpen(false);
                  }}
                >
                  {t("common.edit")}
                </Menu.Item>
                <Menu.Item onClick={() => setDeleteTarget(memoView)} danger>
                  {t("common.delete")}
                </Menu.Item>
              </Menu.Popup>
            </Menu.Root>
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
        confirmVariant="danger"
      />
    </SidebarSection>
  );
};

export default ViewsSection;
